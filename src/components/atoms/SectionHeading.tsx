import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function SectionHeading({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-slate-100', className)} {...props} />;
}
