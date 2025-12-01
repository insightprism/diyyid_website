import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase_client';
import { useAuth } from './use_auth';

interface Notification {
  id: string;
  type: string;
  request_id: string;
  category: string;
  description: string;
  amount: number;
  created_at: Timestamp;
  read: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, set_notifications] = useState<Notification[]>([]);
  const [unread_count, set_unread_count] = useState(0);

  useEffect(() => {
    if (!user || user.role !== 'helper') return;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('read', '==', false),
      orderBy('created_at', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];

      set_notifications(items);
      set_unread_count(items.length);
    });

    return () => unsubscribe();
  }, [user]);

  const mark_as_read = async (notification_id: string) => {
    if (!user) return;
    await updateDoc(
      doc(db, 'users', user.uid, 'notifications', notification_id),
      { read: true }
    );
  };

  const mark_all_read = async () => {
    if (!user) return;
    const updates = notifications.map((n) =>
      updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), {
        read: true,
      })
    );
    await Promise.all(updates);
  };

  return { notifications, unread_count, mark_as_read, mark_all_read };
}
