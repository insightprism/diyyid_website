import { Timestamp } from 'firebase/firestore';
import { CategoryValue } from '../config/app_config';

export type RequestStatus = 'pending' | 'claimed' | 'in_session' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded' | 'failed' | 'cancelled';

export interface Request {
  id: string;
  customer_id: string;
  customer_phone: string;

  description: string;
  category: CategoryValue;
  photo_urls: string[];

  status: RequestStatus;

  helper_id?: string;
  claimed_at?: Timestamp;
  session_id?: string;

  payment_intent_id?: string;
  payment_status: PaymentStatus;
  amount: number;

  created_at: Timestamp;
  updated_at: Timestamp;
}
