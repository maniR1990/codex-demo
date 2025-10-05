import type { PropsWithChildren } from 'react';

interface DialogContainerProps {
  align?: 'center' | 'top';
}

export function DialogContainer({ children, align = 'top' }: PropsWithChildren<DialogContainerProps>) {
  const alignmentClass = align === 'center' ? 'items-center' : 'items-start';
  return (
    <div className={`fixed inset-0 z-50 flex ${alignmentClass} justify-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur`}>
      {children}
    </div>
  );
}
