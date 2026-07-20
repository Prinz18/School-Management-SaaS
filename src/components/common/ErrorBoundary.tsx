// src/components/common/ErrorBoundary.tsx
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 text-red-900 p-8">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-red-200">
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-3xl font-extrabold mb-2">Something went wrong</h1>
          <p className="text-red-700 max-w-md text-center mb-6">
            We encountered an unexpected error while rendering this page.
          </p>
          <div className="bg-white/80 backdrop-blur rounded-lg p-4 border border-red-200 font-mono text-sm overflow-auto max-w-full w-full max-w-lg mb-8">
            {this.state.error?.message}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 hover:bg-red-700 transition"
          >
            Refresh Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
