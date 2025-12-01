import { useState } from 'react';

interface SafetyChecklistProps {
  on_complete: () => void;
  on_cancel: () => void;
}

const SAFETY_ITEMS = [
  { id: 'power', label: 'Is the power turned OFF at the breaker?' },
  { id: 'water', label: 'Is the water supply shut off (if applicable)?' },
  { id: 'ventilation', label: 'Is the area well-ventilated?' },
  { id: 'ppe', label: 'Is the customer wearing safety gear if needed?' },
  { id: 'stable', label: 'Is the customer on stable footing?' },
];

export function SafetyChecklist({ on_complete, on_cancel }: SafetyChecklistProps) {
  const [checked, set_checked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set_checked(next);
  };

  const all_checked = checked.size === SAFETY_ITEMS.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-3xl">⚠️</span>
          <div>
            <h2 className="text-xl font-bold">Safety Checklist</h2>
            <p className="text-sm text-gray-600">Confirm with customer before proceeding</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {SAFETY_ITEMS.map((item) => (
            <label
              key={item.id}
              className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer border ${
                checked.has(item.id)
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={checked.has(item.id)}
                onChange={() => toggle(item.id)}
                className="h-5 w-5"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        <div className="flex space-x-3">
          <button onClick={on_cancel} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={on_complete}
            disabled={!all_checked}
            className={`flex-1 py-2 rounded-lg font-medium ${
              all_checked
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
