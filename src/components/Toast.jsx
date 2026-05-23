import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

const colors = {
  success: { bg: 'var(--success)', text: 'white' },
  error: { bg: 'var(--danger)', text: 'white' },
  warning: { bg: 'var(--warning)', text: 'white' },
  info: { bg: 'var(--accent-color)', text: 'white' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={{
        position: 'fixed',
        top: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: 'calc(100% - 32px)',
        maxWidth: '400px',
        pointerEvents: 'none',
      }}>
        {toasts.map(t => {
          const Icon = icons[t.type] || CheckCircle;
          const c = colors[t.type] || colors.success;
          return (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '12px',
                backgroundColor: c.bg,
                color: c.text,
                fontSize: '0.85rem',
                fontWeight: 600,
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                pointerEvents: 'auto',
                animation: 'slideDown 0.25s ease',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button
                onClick={() => removeToast(t.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  opacity: 0.7,
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
