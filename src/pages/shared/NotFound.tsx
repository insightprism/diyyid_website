import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-xl text-gray-600 mt-4">Page not found</p>
        <Link to="/" className="btn-primary inline-block mt-6">
          Go Home
        </Link>
      </div>
    </div>
  );
}
