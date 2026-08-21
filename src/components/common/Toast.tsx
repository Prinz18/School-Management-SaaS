import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  type: 'success' | 'error';
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onDismiss }) => {
  if (!message) return null;

  const isSuccess = type === 'success';
  const bgColor = isSuccess
    ? 'bg-emerald-600 border-emerald-400 shadow-emerald-600/20'
    : 'bg-red-600 border-red-400 shadow-red-600/20';
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;
  const iconColor = isSuccess ? 'text-emerald-200' : 'text-red-200';

  return (
    <div
      className={`fixed top-4 right-4 left-4 sm:top-24 sm:right-10 sm:left-auto sm:max-w-md ${bgColor} text-white font-bold text-xs uppercase tracking-wider px-4 sm:px-6 py-4 rounded-2xl shadow-xl z-50 flex items-center gap-3 border animate-in slide-in-from-right duration-300`}
      role="alert"
    >
      <Icon className={`w-5 h-5 ${iconColor} shrink-0`} />
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ml-2 p-1 rounded-lg hover:bg-white/10 transition"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
