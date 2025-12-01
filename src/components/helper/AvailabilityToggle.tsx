import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase_client';
import { useAuth } from '../../hooks/use_auth';

export function AvailabilityToggle() {
  const { user } = useAuth();
  const [is_updating, set_is_updating] = useState(false);

  if (!user) return null;

  const is_available = user.is_available ?? false;

  const toggle_availability = async () => {
    set_is_updating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        is_available: !is_available,
        updated_at: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating availability:', error);
    } finally {
      set_is_updating(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm text-gray-600">
        {is_available ? 'Available for jobs' : 'Not available'}
      </span>
      <button
        onClick={toggle_availability}
        disabled={is_updating}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          ${is_available ? 'bg-green-500' : 'bg-gray-300'}
          ${is_updating ? 'opacity-50' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${is_available ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}
