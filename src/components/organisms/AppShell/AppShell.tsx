import type { ReactNode } from 'react';

interface AppShellProps {
  header: ReactNode;
  navigation: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function AppShell({ header, navigation, children, footer }: AppShellProps) {
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      {header}
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row">
        {navigation}
        <main className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">{children}</main>
      </div>
      {footer}
    </div>
  );
}
