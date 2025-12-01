import { useState, createContext, useContext, ReactNode, useCallback } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  show_toast: (message: string, type?: Toast['type']) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, set_toasts] = useState<Toast[]>([]);

  const show_toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now().toString();
    set_toasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      set_toasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: string) => {
    set_toasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ show_toast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 animate-slide-up ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : toast.type === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-white'
            }`}
          >
            <span>{toast.message}</span>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-white/80 hover:text-white"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
