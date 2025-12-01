import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  has_error: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { has_error: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { has_error: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, info);
  }

  render() {
    if (this.state.has_error) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="card max-w-md text-center">
              <span className="text-4xl block mb-4">⚠️</span>
              <h1 className="text-xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 mb-4">
                We're sorry, but something unexpected happened.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary"
              >
                Refresh Page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
