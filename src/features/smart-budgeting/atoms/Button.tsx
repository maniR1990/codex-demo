import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-slate-900 hover:bg-accent/90 disabled:opacity-60 disabled:hover:bg-accent',
  secondary:
    'border border-slate-700 text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-50',
  ghost: 'text-slate-300 hover:text-slate-100 hover:bg-slate-900/60 disabled:opacity-40',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:opacity-60'
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  className = '',
  fullWidth,
  children,
  ...rest
}: PropsWithChildren<ButtonProps>) {
  const baseStyles =
    'inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
  const widthClass = fullWidth ? 'w-full' : '';
  const variantClass = VARIANT_STYLES[variant];
  const composedClassName = [baseStyles, variantClass, widthClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={composedClassName} {...rest}>
      {children}
    </button>
  );
}
