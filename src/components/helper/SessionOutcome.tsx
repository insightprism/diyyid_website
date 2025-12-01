import { useState } from 'react';
import { SessionOutcome as OutcomeType } from '../../types';

interface SessionOutcomeProps {
  on_submit: (outcome: OutcomeType, notes: string) => Promise<void>;
  is_loading: boolean;
}

const OUTCOMES: { value: OutcomeType; label: string; icon: string }[] = [
  { value: 'resolved', label: 'Issue Resolved', icon: '✓' },
  { value: 'unresolved', label: 'Not Resolved', icon: '✗' },
  { value: 'escalated', label: 'Needs In-Person Visit', icon: '🔧' },
];

export function SessionOutcome({ on_submit, is_loading }: SessionOutcomeProps) {
  const [outcome, set_outcome] = useState<OutcomeType | null>(null);
  const [notes, set_notes] = useState('');

  const handle_submit = async () => {
    if (!outcome) return;
    await on_submit(outcome, notes);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">How did the session go?</h3>

      <div className="grid grid-cols-3 gap-3">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => set_outcome(o.value)}
            className={`p-4 rounded-lg border-2 text-center transition-all ${
              outcome === o.value
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span className="text-2xl block mb-1">{o.icon}</span>
            <span className="text-sm">{o.label}</span>
          </button>
        ))}
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => set_notes(e.target.value)}
          rows={3}
          className="input-field resize-none"
          placeholder="Any notes about the session..."
        />
      </div>

      <button
        onClick={handle_submit}
        disabled={!outcome || is_loading}
        className="btn-primary w-full"
      >
        {is_loading ? 'Saving...' : 'Complete Session'}
      </button>
    </div>
  );
}
