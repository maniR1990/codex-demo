import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Checkbox(
  { className = '', ...props },
  ref
) {
  const baseClass = 'h-4 w-4 rounded border border-slate-700 bg-slate-950 text-accent focus:ring-accent';
  return <input ref={ref} type="checkbox" className={[baseClass, className].filter(Boolean).join(' ')} {...props} />;
});
