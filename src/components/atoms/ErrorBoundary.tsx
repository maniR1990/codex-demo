import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

type ErrorBoundaryFallback = ReactNode | ErrorBoundaryFallbackRender;

export type ErrorBoundaryFallbackRender = (props: ErrorBoundaryFallbackProps) => ReactNode;

export interface ErrorBoundaryFallbackProps {
  error: Error;
  reset: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ErrorBoundaryFallback;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { onError } = this.props;

    if (typeof onError === 'function') {
      onError(error, info);
    }

    if (import.meta.env.DEV) {
      console.error('ErrorBoundary captured an error', error, info);
    }
  }

  private resetBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      const safeError = error ?? new Error('Unknown error');

      if (typeof fallback === 'function') {
        return fallback({ error: safeError, reset: this.resetBoundary });
      }

      if (fallback) {
        return fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-center text-red-100">
          <div>
            <p className="text-lg font-semibold">Something went wrong.</p>
            <p className="text-sm text-red-100/80">Try the action again or refresh the page.</p>
          </div>
          {import.meta.env.DEV ? (
            <pre className="max-w-full overflow-auto rounded bg-slate-950/70 p-4 text-left text-xs text-red-200">
              {safeError.message}
            </pre>
          ) : null}
          <Button type="button" variant="secondary" onClick={this.resetBoundary}>
            Try again
          </Button>
        </div>
      );
    }

    return children;
  }
}
