import { useState } from 'react';
import { Request } from '../../types';
import { app_config } from '../../config/app_config';
import { format_distance_to_now } from '../../utils/date_utils';

interface RequestCardProps {
  request: Request;
  on_claim: (request_id: string) => Promise<void>;
  is_claiming: boolean;
}

export function RequestCard({ request, on_claim, is_claiming }: RequestCardProps) {
  const [selected_image, set_selected_image] = useState<string | null>(null);

  const category = app_config.categories.find((c) => c.value === request.category);
  const category_icon = category?.icon || '🏠';
  const category_label = category?.label || 'Other';

  const handle_claim = async () => {
    await on_claim(request.id);
  };

  return (
    <div className="card hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{category_icon}</span>
          <div>
            <span className="font-medium text-gray-900">{category_label}</span>
            <p className="text-sm text-gray-500">
              {format_distance_to_now(request.created_at)}
            </p>
          </div>
        </div>
        <span className="text-lg font-bold text-green-600">
          ${(request.amount / 100).toFixed(2)}
        </span>
      </div>

      {/* Description */}
      <div className="mb-4">
        <p className="text-gray-700 line-clamp-3">{request.description}</p>
      </div>

      {/* Photos */}
      {request.photo_urls.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-4 gap-2">
            {request.photo_urls.slice(0, 4).map((url, index) => (
              <button
                key={index}
                type="button"
                onClick={() => set_selected_image(url)}
                className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
              >
                <img
                  src={url}
                  alt={`Issue photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
          {request.photo_urls.length > 4 && (
            <p className="text-sm text-gray-500 mt-1">
              +{request.photo_urls.length - 4} more photos
            </p>
          )}
        </div>
      )}

      {/* Claim Button */}
      <button
        onClick={handle_claim}
        disabled={is_claiming}
        className="btn-primary w-full"
      >
        {is_claiming ? 'Claiming...' : 'Claim This Job'}
      </button>

      {/* Image Modal */}
      {selected_image && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => set_selected_image(null)}
        >
          <div className="max-w-4xl max-h-[90vh]">
            <img
              src={selected_image}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
          <button
            onClick={() => set_selected_image(null)}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
}
