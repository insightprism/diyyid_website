import { Timestamp } from 'firebase/firestore';

export function format_distance_to_now(timestamp: Timestamp | undefined): string {
  if (!timestamp) return 'Unknown';

  const date = timestamp.toDate();
  const now = new Date();
  const diff_seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff_seconds < 60) {
    return 'Just now';
  }

  const diff_minutes = Math.floor(diff_seconds / 60);
  if (diff_minutes < 60) {
    return `${diff_minutes}m ago`;
  }

  const diff_hours = Math.floor(diff_minutes / 60);
  if (diff_hours < 24) {
    return `${diff_hours}h ago`;
  }

  const diff_days = Math.floor(diff_hours / 24);
  return `${diff_days}d ago`;
}

export function format_time(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function format_date(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}
