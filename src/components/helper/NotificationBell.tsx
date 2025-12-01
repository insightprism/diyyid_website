import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/use_notifications';
import { format_distance_to_now } from '../../utils/date_utils';
import { app_config } from '../../config/app_config';
import { Timestamp } from 'firebase/firestore';

interface NotificationItem {
  id: string;
  category: string;
  description: string;
  amount: number;
  created_at: Timestamp;
}

export function NotificationBell() {
  const { notifications, unread_count, mark_as_read, mark_all_read } =
    useNotifications();
  const [is_open, set_is_open] = useState(false);
  const navigate = useNavigate();

  const handle_click = async (notification: NotificationItem) => {
    await mark_as_read(notification.id);
    set_is_open(false);
    navigate('/helper/dashboard');
  };

  return (
    <div className="relative">
      <button
        onClick={() => set_is_open(!is_open)}
        className="relative p-2 text-gray-600 hover:text-gray-900"
      >
        <span className="text-xl">🔔</span>
        {unread_count > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unread_count > 9 ? '9+' : unread_count}
          </span>
        )}
      </button>

      {is_open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => set_is_open(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
            <div className="p-3 border-b flex justify-between items-center">
              <span className="font-semibold">Notifications</span>
              {unread_count > 0 && (
                <button
                  onClick={mark_all_read}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No new notifications
                </div>
              ) : (
                notifications.map((notification) => {
                  const category = app_config.categories.find(
                    (c) => c.value === notification.category
                  );
                  return (
                    <button
                      key={notification.id}
                      onClick={() => handle_click(notification)}
                      className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-0"
                    >
                      <div className="flex items-start space-x-2">
                        <span className="text-xl">{category?.icon || '🏠'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            New {category?.label} Request
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {notification.description}
                          </p>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-gray-400">
                              {format_distance_to_now(notification.created_at)}
                            </span>
                            <span className="text-xs font-medium text-green-600">
                              ${(notification.amount / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
