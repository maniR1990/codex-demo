import { ReactNode } from 'react';

type BadgeProps = {
  tone: 'default' | 'success' | 'danger' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
};

const toneClassMap: Record<BadgeProps['tone'], string> = {
  default: 'bg-slate-800 text-slate-300',
  success: 'bg-success/20 text-success',
  danger: 'bg-danger/20 text-danger',
  warning: 'bg-warning/20 text-warning',
  info: 'bg-sky-500/20 text-sky-300'
};

export function Badge({ tone, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClassMap[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
