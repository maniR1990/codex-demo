import type { PropsWithChildren } from 'react';

interface DialogSurfaceProps {
  size?: 'md' | 'lg';
}

export function DialogSurface({ children, size = 'lg' }: PropsWithChildren<DialogSurfaceProps>) {
  const widthClass = size === 'lg' ? 'max-w-4xl' : 'max-w-2xl';
  return (
    <div className={`w-full ${widthClass} rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl`}>{children}</div>
  );
}
