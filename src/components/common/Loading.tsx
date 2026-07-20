// src/components/common/Loading.tsx
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
  fullScreen?: boolean;
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ fullScreen = true, message = 'Loading...' }) => {
  if (fullScreen) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-600">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-sm font-medium animate-pulse">{message}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4 text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      <span>{message}</span>
    </div>
  );
};
