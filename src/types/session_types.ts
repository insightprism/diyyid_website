import { Timestamp } from 'firebase/firestore';

export type SessionStatus = 'created' | 'waiting' | 'active' | 'ended';
export type SessionOutcome = 'resolved' | 'unresolved' | 'escalated';

export interface Session {
  id: string;
  request_id: string;
  customer_id: string;
  helper_id: string;

  zoho_session_id?: string;
  technician_url?: string;
  customer_join_url?: string;

  status: SessionStatus;
  safety_checklist_completed: boolean;

  sms_sent_at?: Timestamp;
  started_at?: Timestamp;
  ended_at?: Timestamp;
  duration?: number;

  outcome?: SessionOutcome;
  notes?: string;

  created_at: Timestamp;
  updated_at: Timestamp;
}
