import type { ReactNode } from 'react';
import { Button } from '../../atoms/Button';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  isNavOpen: boolean;
  onToggleNav: () => void;
  rightSlot?: ReactNode;
}

export function AppHeader({ title, subtitle, isNavOpen, onToggleNav, rightSlot }: AppHeaderProps) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-accent">{title}</h1>
            {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          <Button
            type="button"
            onClick={onToggleNav}
            className="md:hidden"
            variant="secondary"
            aria-expanded={isNavOpen}
            aria-controls="primary-navigation"
          >
            <span aria-hidden className="text-lg leading-none">☰</span>
            Menu
          </Button>
        </div>
        {rightSlot ? <div className="flex flex-col items-stretch gap-2 md:min-w-[260px]">{rightSlot}</div> : null}
      </div>
    </header>
  );
}
