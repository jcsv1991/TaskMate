import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ToastContainer } from 'react-bootstrap';
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, danger: TriangleAlert, info: Info };
const MAX_VISIBLE = 4;

/**
 * One notification. Built from Bootstrap's toast classes instead of the
 * react-bootstrap <Toast>, which hard-codes role="alert" + aria-live="assertive"
 * and would make a screen reader interrupt itself for "Task added". Only errors
 * are announced assertively here; everything else is polite.
 */
function ToastItem({ toast, onDismiss }) {
  const { id, variant, message } = toast;
  const Icon = ICONS[variant] || Info;
  const urgent = variant === 'danger';

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), urgent ? 7000 : 4000);
    return () => clearTimeout(timer);
  }, [id, urgent, onDismiss]);

  return (
    <div className="toast show" role={urgent ? 'alert' : 'status'} aria-live={urgent ? 'assertive' : 'polite'} aria-atomic="true">
      <div className="toast-body d-flex align-items-start gap-2">
        <Icon size={18} className={`mt-1 flex-shrink-0 text-${variant}`} aria-hidden="true" />
        <span className="flex-grow-1">{message}</span>
        <button type="button" className="btn-close ms-2" aria-label="Dismiss" onClick={() => onDismiss(id)} />
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const push = useCallback((variant, message) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((all) => [...all.slice(-(MAX_VISIBLE - 1)), { id, variant, message }]);
  }, []);

  const api = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('danger', message),
      info: (message) => push('info', message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer position="bottom-end" className="p-3 tm-toasts" style={{ zIndex: 2000, position: 'fixed' }}>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
