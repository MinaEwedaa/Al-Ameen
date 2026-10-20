import { useEffect, useRef, useState } from 'react';
import { Check, Info, TriangleAlert, X } from 'lucide-react';
import { ToastContext } from './ToastContext';
import type { ToastTone } from './ToastContext';
import { getTranslation } from '../../core/i18n';
import { useLanguage } from '../../core/i18n/useLanguage';
import './Toast.css';

interface ToastMessage {
  id: number;
  message: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutIds = useRef<number[]>([]);
  const { language } = useLanguage();

  useEffect(() => () => timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId)), []);

  const dismiss = (id: number) => setToasts((current) => current.filter((toast) => toast.id !== id));
  const notify = (message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    timeoutIds.current.push(window.setTimeout(() => dismiss(id), 4500));
  };

  return (
    <ToastContext.Provider value={{ notify, showToast: notify }}>
      {children}
      <div className="ui-toast-region" aria-live="polite" aria-relevant="additions removals">
        {toasts.map((toast) => (
          <div className={`ui-toast ui-toast--${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'} key={toast.id}>
            {toast.tone === 'success' ? (
              <Check aria-hidden="true" />
            ) : toast.tone === 'info' ? (
              <Info aria-hidden="true" />
            ) : (
              <TriangleAlert aria-hidden="true" />
            )}
            <span>{toast.message}</span>
            <button type="button" aria-label={getTranslation(language, 'toast.dismiss')} onClick={() => dismiss(toast.id)}><X aria-hidden="true" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
