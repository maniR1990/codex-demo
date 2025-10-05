import type { ReactNode } from 'react';
import { Button } from '../atoms/Button';

interface SectionErrorFallbackProps {
  section: string;
  error: Error;
  onRetry: () => void;
  layout?: 'inline' | 'full';
  actionLabel?: string;
  additionalContent?: ReactNode;
}

const isDevEnvironment = import.meta.env.DEV;

export function SectionErrorFallback({
  section,
  error,
  onRetry,
  layout = 'inline',
  actionLabel = 'Try again',
  additionalContent
}: SectionErrorFallbackProps) {
  if (layout === 'full') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-center text-slate-100">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">We hit a snag.</h1>
          <p className="max-w-xl text-sm text-slate-400">
            The {section} is currently unavailable. Please try again in a moment or reload the page.
          </p>
        </div>
        {isDevEnvironment ? (
          <pre className="max-w-xl overflow-auto rounded-lg border border-slate-800 bg-slate-900 p-4 text-left text-xs text-red-200">
            {error.message}
          </pre>
        ) : null}
        <Button type="button" variant="secondary" onClick={onRetry}>
          {actionLabel}
        </Button>
        {additionalContent}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
      <div className="space-y-1">
        <p className="font-semibold">{section} is temporarily unavailable.</p>
        <p className="text-xs text-red-100/80">Try the action again. If the problem persists, reload the page.</p>
      </div>
      {isDevEnvironment ? (
        <pre className="max-h-32 overflow-auto rounded bg-slate-950/70 p-3 text-xs text-red-200">{error.message}</pre>
      ) : null}
      <div>
        <Button type="button" variant="secondary" onClick={onRetry}>
          {actionLabel}
        </Button>
      </div>
      {additionalContent}
    </div>
  );
}
