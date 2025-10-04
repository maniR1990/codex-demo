import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardView } from './views/DashboardView';
import { BalanceSheetView } from './views/BalanceSheetView';
import { TrendAnalysisView } from './views/TrendAnalysisView';
import { SmartBudgetingView } from './views/SmartBudgetingView';
import { IncomeManagementView } from './views/IncomeManagementView';
import { RecurringExpensesView } from './views/RecurringExpensesView';
import { GoalSimulatorView } from './views/GoalSimulatorView';
import { InsightsView } from './views/InsightsView';
import { WealthAcceleratorView } from './views/WealthAcceleratorView';
import { OfflineSyncStatus } from './components/OfflineSyncStatus';
import { InitialSetupDialog } from './components/InitialSetupDialog';
import { QuickExpenseCapture } from './components/QuickExpenseCapture';
import { useFinancialStore } from './store/FinancialStoreProvider';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
    isActive ? 'bg-accent text-slate-900' : 'bg-slate-800 hover:bg-slate-700'
  }`;

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
          className={`flex flex-col gap-2 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow transition-all md:max-w-xs md:border-0 md:bg-transparent md:p-0 md:shadow-none ${
            isNavOpen ? 'max-h-[32rem] opacity-100' : 'max-h-0 opacity-0 md:max-h-full md:opacity-100'
          } md:flex`}
        >
          <NavLink to="/" end className={navLinkClass}>
            CEO Dashboard
          </NavLink>
          <NavLink to="/balance" className={navLinkClass}>
            Unified Balance Sheet
          </NavLink>
          <NavLink to="/trends" className={navLinkClass}>
            Trend Analysis
          </NavLink>
          <NavLink to="/budgeting" className={navLinkClass}>
            Smart Budgeting
          </NavLink>
          <NavLink to="/income" className={navLinkClass}>
            Income & Categories
          </NavLink>
          <NavLink to="/recurring" className={navLinkClass}>
            Recurring Expenses Hub
          </NavLink>
          <NavLink to="/goals" className={navLinkClass}>
            Goal Setting & Simulation
          </NavLink>
          <NavLink to="/insights" className={navLinkClass}>
            Actionable Insights
          </NavLink>
          <NavLink to="/accelerator" className={navLinkClass}>
            Wealth Accelerator Intelligence
          </NavLink>
        </nav>
        <main className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg sm:p-6">
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
        </main>
      </div>
      <QuickExpenseCapture />
      <InitialSetupDialog />
    </div>
  );
}
