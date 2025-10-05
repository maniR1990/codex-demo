import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', ...props },
  ref
) {
  const baseClass = 'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/60 disabled:opacity-60';
  return <input ref={ref} className={[baseClass, className].filter(Boolean).join(' ')} {...props} />;
});
