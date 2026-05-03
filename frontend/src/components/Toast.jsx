import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (toast) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, ...toast }]);
      setTimeout(() => dismiss(id), toast.duration ?? 4000);
    },
    [dismiss],
  );

  const value = {
    success: (message) => push({ kind: 'success', message }),
    error: (message) => push({ kind: 'error', message, duration: 6000 }),
    info: (message) => push({ kind: 'info', message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md px-4 py-2 text-sm font-medium shadow-lg ring-1 ring-black/5 ${
              t.kind === 'success'
                ? 'bg-green-600 text-white'
                : t.kind === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-800 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
