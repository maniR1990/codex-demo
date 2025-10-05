import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', children, ...props },
  ref
) {
  const baseClass = 'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/60 disabled:opacity-60';
  return (
    <select ref={ref} className={[baseClass, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </select>
  );
});
