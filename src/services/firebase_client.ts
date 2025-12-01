import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebase_cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// DEBUG: Log Firebase configuration
console.log('=== FIREBASE CONFIGURATION ===');
console.log('Project ID:', firebase_cfg.projectId);
console.log('Auth Domain:', firebase_cfg.authDomain);
console.log('API Key (first 10 chars):', firebase_cfg.apiKey?.substring(0, 10) + '...');
console.log('USE_EMULATORS:', import.meta.env.VITE_USE_EMULATORS);
console.log('DEV mode:', import.meta.env.DEV);
console.log('==============================');

const app = initializeApp(firebase_cfg);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  console.log('>>> CONNECTING TO EMULATORS <<<');
  connectAuthEmulator(auth, 'http://localhost:18899');
  connectFirestoreEmulator(db, 'localhost', 18880);
  connectStorageEmulator(storage, 'localhost', 18898);
  connectFunctionsEmulator(functions, 'localhost', 18884);
} else {
  console.log('>>> USING PRODUCTION FIREBASE <<<');
}
