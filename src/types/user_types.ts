import { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'helper';

export interface User {
  uid: string;
  email: string;
  phone: string;
  display_name: string;
  role: UserRole;
  created_at: Timestamp;
  updated_at: Timestamp;

  // Helper-specific
  is_available?: boolean;
  specialties?: string[];
  completed_sessions?: number;
}

export interface AuthState {
  user: User | null;
  is_loading: boolean;
  error: string | null;
}
