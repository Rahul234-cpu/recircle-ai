import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

const ToastContext = createContext(null);
let nextId = 1;

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-brand-600" />,
  error: <XCircle className="h-5 w-5 text-red-600" />,
  info: <Info className="h-5 w-5 text-sky-600" />,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((type, message, title) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, type, message, title }]);
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : 4000);
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, t) => push('success', m, t),
    error: (m, t) => push('error', m, t),
    info: (m, t) => push('info', m, t),
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-lg">
            {ICONS[t.type]}
            <div className="flex-1 text-sm">
              {t.title && <p className="font-semibold text-ink">{t.title}</p>}
              <p className="text-gray-600">{t.message}</p>
            </div>
            <button type="button" onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-600" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
