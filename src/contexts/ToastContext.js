'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const ToastContext = createContext(null);
let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback((message, { type = 'success', duration = 3200, action } = {}) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, message, type, action }]);
    if (duration) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({
    show,
    success: (m, o) => show(m, { ...o, type: 'success' }),
    error: (m, o) => show(m, { ...o, type: 'error', duration: 5000 }),
    info: (m, o) => show(m, { ...o, type: 'info' }),
    dismiss,
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-full px-5 py-3 text-sm font-medium shadow-lg ${
                t.type === 'error' ? 'bg-red-600 text-white' : t.type === 'info' ? 'bg-ink text-white' : 'bg-ink text-white'
              }`}
              role={t.type === 'error' ? 'alert' : 'status'}
            >
              <span>{t.type === 'error' ? '⚠' : t.type === 'success' ? '✓' : 'ℹ'}</span>
              <span>{t.message}</span>
              {t.action && (
                <button
                  className="ml-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold hover:bg-white/25"
                  onClick={() => {
                    t.action.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
