import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';

interface AppNavigationProps {
  isNavOpen: boolean;
  items: ReactNode;
}

export function AppNavigation({ isNavOpen, items }: AppNavigationProps) {
  return (
    <nav
      id="primary-navigation"
      className={cn(
        'flex flex-col gap-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow transition-all',
        'md:max-w-xs md:border-0 md:bg-transparent md:p-0 md:shadow-none md:flex',
        isNavOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0 md:max-h-full md:opacity-100'
      )}
    >
      {items}
    </nav>
  );
}
