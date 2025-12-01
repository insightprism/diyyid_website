import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase_client';
import { User, UserRole } from '../types';

interface AuthContextType {
  firebase_user: FirebaseUser | null;
  user: User | null;
  is_loading: boolean;
  error: string | null;
  sign_in: (email: string, password: string) => Promise<void>;
  sign_up: (
    email: string,
    password: string,
    display_name: string,
    phone: string,
    role: UserRole
  ) => Promise<void>;
  sign_out: () => Promise<void>;
  clear_error: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebase_user, set_firebase_user] = useState<FirebaseUser | null>(null);
  const [user, set_user] = useState<User | null>(null);
  const [is_loading, set_is_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);

  // Listen for auth state changes and user profile updates
  useEffect(() => {
    console.log('[Auth] Setting up auth listener...');
    let unsubscribe_profile: (() => void) | null = null;

    const unsubscribe_auth = onAuthStateChanged(auth, async (fb_user) => {
      console.log('[Auth] Auth state changed:', fb_user ? fb_user.uid : 'null');
      set_firebase_user(fb_user);

      // Clean up previous profile listener
      if (unsubscribe_profile) {
        unsubscribe_profile();
        unsubscribe_profile = null;
      }

      if (fb_user) {
        console.log('[Auth] User logged in, fetching profile from Firestore...');
        // Set up real-time listener for user profile
        unsubscribe_profile = onSnapshot(
          doc(db, 'users', fb_user.uid),
          (doc_snapshot) => {
            console.log('[Auth] Firestore snapshot received, exists:', doc_snapshot.exists());
            if (doc_snapshot.exists()) {
              set_user({
                uid: fb_user.uid,
                ...doc_snapshot.data(),
              } as User);
            } else {
              console.log('[Auth] No user profile found in Firestore');
              set_user(null);
            }
            set_is_loading(false);
          },
          (err) => {
            console.error('[Auth] Error listening to user profile:', err);
            set_is_loading(false);
          }
        );
      } else {
        console.log('[Auth] No user, setting is_loading to false');
        set_user(null);
        set_is_loading(false);
      }
    });

    return () => {
      unsubscribe_auth();
      if (unsubscribe_profile) {
        unsubscribe_profile();
      }
    };
  }, []);

  const sign_in = async (email: string, password: string) => {
    set_error(null);
    set_is_loading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const firebase_error = err as { code?: string };
      const message = get_auth_error_message(firebase_error.code || '');
      set_error(message);
      set_is_loading(false);
      throw new Error(message);
    }
  };

  const sign_up = async (
    email: string,
    password: string,
    display_name: string,
    phone: string,
    role: UserRole
  ) => {
    console.log('[SignUp] Starting sign up process...');
    console.log('[SignUp] Email:', email);
    console.log('[SignUp] Role:', role);

    set_error(null);
    set_is_loading(true);

    let user_uid: string | null = null;

    try {
      console.log('[SignUp] Step 1: Creating Firebase Auth user...');
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      user_uid = credential.user.uid;
      console.log('[SignUp] Step 1 SUCCESS: User created with UID:', user_uid);

      console.log('[SignUp] Step 2: Creating Firestore user document...');
      console.log('[SignUp] Firestore db object:', db);
      console.log('[SignUp] Document path: users/' + user_uid);

      const user_doc_ref = doc(db, 'users', user_uid);
      console.log('[SignUp] Document reference created:', user_doc_ref.path);

      const user_data = {
        email,
        display_name,
        phone,
        role,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        ...(role === 'helper' && {
          is_available: false,
          specialties: [],
          completed_sessions: 0,
        }),
      };
      console.log('[SignUp] User data to write:', JSON.stringify(user_data, null, 2));

      await setDoc(user_doc_ref, user_data);
      console.log('[SignUp] Step 2 SUCCESS: Firestore document created!');

    } catch (err: unknown) {
      console.error('[SignUp] === ERROR DETAILS ===');
      console.error('[SignUp] Full error object:', err);
      console.error('[SignUp] Error type:', typeof err);
      console.error('[SignUp] Error constructor:', (err as object)?.constructor?.name);

      const firebase_error = err as { code?: string; message?: string; stack?: string };
      console.error('[SignUp] Error code:', firebase_error.code);
      console.error('[SignUp] Error message:', firebase_error.message);
      console.error('[SignUp] Error stack:', firebase_error.stack);
      console.error('[SignUp] User UID at failure:', user_uid);
      console.error('[SignUp] ======================');

      const message = get_auth_error_message(firebase_error.code || '');
      set_error(message);
      set_is_loading(false);
      throw new Error(message);
    }
  };

  const sign_out = async () => {
    await firebaseSignOut(auth);
  };

  const clear_error = () => set_error(null);

  return (
    <AuthContext.Provider
      value={{
        firebase_user,
        user,
        is_loading,
        error,
        sign_in,
        sign_up,
        sign_out,
        clear_error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Helper to convert Firebase error codes to user-friendly messages
function get_auth_error_message(code: string): string {
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/invalid-email': 'Invalid email address',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
  };

  return messages[code] || 'An error occurred. Please try again.';
}
