import { useEffect, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Button } from './components/atoms/Button';
import { InitialSetupDialog } from './components/InitialSetupDialog';
import { OfflineSyncStatus } from './components/OfflineSyncStatus';
import { QuickExpenseCapture } from './components/QuickExpenseCapture';
import { NavItem } from './components/molecules/NavItem';
import { AppHeader } from './components/organisms/AppHeader/AppHeader';
import { AppNavigation } from './components/organisms/AppNavigation/AppNavigation';
import { AppShell } from './components/organisms/AppShell/AppShell';
import { BalanceSheetView } from './views/BalanceSheetView';
import { DashboardView } from './views/DashboardView';
import { GoalSimulatorView } from './views/GoalSimulatorView';
import { IncomeManagementView } from './views/IncomeManagementView';
import { InsightsView } from './views/InsightsView';
import { RecurringExpensesView } from './views/RecurringExpensesView';
import { SmartBudgetingView } from './views/SmartBudgetingView';
import { TrendAnalysisView } from './views/TrendAnalysisView';
import { WealthAcceleratorView } from './views/WealthAcceleratorView';
import { useFinancialStore } from './store/FinancialStoreProvider';

const NAV_LINKS = [
  { to: '/', label: 'CEO Dashboard', end: true },
  { to: '/balance', label: 'Unified Balance Sheet' },
  { to: '/trends', label: 'Trend Analysis' },
  { to: '/budgeting', label: 'Smart Budgeting' },
  { to: '/income', label: 'Income & Categories' },
  { to: '/recurring', label: 'Recurring Expenses Hub' },
  { to: '/goals', label: 'Goal Setting & Simulation' },
  { to: '/insights', label: 'Actionable Insights' },
  { to: '/accelerator', label: 'Wealth Accelerator Intelligence' }
] as const;

export default function App() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const location = useLocation();
  const { isInitialised, hasDismissedInitialSetup, requestInitialSetup } = useFinancialStore();

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:gap-6">
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold text-accent">Wealth Accelerator</h1>
              <p className="text-sm text-slate-400">
                Offline-first financial intelligence engine for Indian CEOs & households
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsNavOpen((open) => !open)}
              className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold md:hidden"
              aria-expanded={isNavOpen}
              aria-controls="primary-navigation"
            >
              <span aria-hidden className="text-lg leading-none">☰</span>
              Menu
            </button>
          </div>
          <div className="flex flex-col items-stretch gap-2 md:min-w-[260px]">
            <OfflineSyncStatus />
            {!isInitialised && hasDismissedInitialSetup ? (
              <button
                type="button"
                onClick={requestInitialSetup}
                className="rounded-lg border border-accent/50 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/10"
              >
                Resume ledger setup
              </button>
            ) : null}
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row">
        <nav
          id="primary-navigation"
          className={`flex flex-col gap-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow transition-[max-height,opacity] md:w-64 md:flex-shrink-0 md:border-0 md:bg-transparent md:p-0 md:shadow-none ${
            isNavOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0'
          } md:flex md:max-h-none md:opacity-100 md:overflow-visible`}
        >
          Resume ledger setup
        </Button>
      ) : null}
    </>
  );

  return (
    <AppShell
      header={
        <AppHeader
          title="Wealth Accelerator"
          subtitle="Offline-first financial intelligence engine for Indian CEOs & households"
          isNavOpen={isNavOpen}
          onToggleNav={() => setIsNavOpen((open) => !open)}
          rightSlot={headerRightSlot}
        />
      }
      navigation={
        <AppNavigation
          isNavOpen={isNavOpen}
          items={NAV_LINKS.map((link) => (
            <NavItem key={link.to} to={link.to} end={link.end} label={link.label} />
          ))}
        />
      }
      footer={
        <>
          <QuickExpenseCapture />
          <InitialSetupDialog />
        </>
      }
    >
      <Routes>
        <Route path="/" element={<DashboardView />} />
        <Route path="/balance" element={<BalanceSheetView />} />
        <Route path="/trends" element={<TrendAnalysisView />} />
        <Route path="/budgeting" element={<SmartBudgetingView />} />
        <Route path="/income" element={<IncomeManagementView />} />
        <Route path="/recurring" element={<RecurringExpensesView />} />
        <Route path="/goals" element={<GoalSimulatorView />} />
        <Route path="/insights" element={<InsightsView />} />
        <Route path="/accelerator" element={<WealthAcceleratorView />} />
      </Routes>
    </AppShell>
  );
}
