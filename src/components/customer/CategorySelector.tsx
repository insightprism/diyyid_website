import { app_config, CategoryValue } from '../../config/app_config';

interface CategorySelectorProps {
  value: CategoryValue | '';
  on_change: (category: CategoryValue) => void;
}

export function CategorySelector({ value, on_change }: CategorySelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {app_config.categories.map((category) => (
        <button
          key={category.value}
          type="button"
          onClick={() => on_change(category.value)}
          className={`p-4 rounded-lg border-2 text-left transition-all ${
            value === category.value
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <span className="text-2xl block mb-1">{category.icon}</span>
          <span className="font-medium text-gray-900">{category.label}</span>
        </button>
      ))}
    </div>
  );
}
