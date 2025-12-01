import { Request } from '../../types';
import { format_distance_to_now } from '../../utils/date_utils';
import { app_config } from '../../config/app_config';

interface ClaimedJobsProps {
  requests: Request[];
  on_start_session: (request: Request) => void;
}

export function ClaimedJobs({ requests, on_start_session }: ClaimedJobsProps) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Your Claimed Jobs ({requests.length})
      </h2>
      <div className="space-y-4">
        {requests.map((request) => {
          const category = app_config.categories.find(
            (c) => c.value === request.category
          );
          return (
            <div
              key={request.id}
              className="card bg-blue-50 border-blue-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded mb-2">
                    Claimed {format_distance_to_now(request.claimed_at)}
                  </span>
                  <h3 className="font-medium text-gray-900 flex items-center">
                    <span className="mr-2">{category?.icon}</span>
                    {category?.label}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {request.description}
                  </p>
                </div>
                <button
                  onClick={() => on_start_session(request)}
                  className="btn-primary whitespace-nowrap ml-4"
                >
                  Start Session
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
