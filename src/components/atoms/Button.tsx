import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  isLoading?: boolean;
};

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-slate-900 hover:bg-accent/90 focus-visible:outline-accent border border-accent/80',
  secondary:
    'bg-slate-800 text-slate-100 hover:bg-slate-700 focus-visible:outline-slate-400 border border-slate-700',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 focus-visible:outline-slate-500 border border-transparent'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, children, variant = 'primary', isLoading, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
          variantStyles[variant],
          className
        )}
        disabled={disabled || isLoading}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
