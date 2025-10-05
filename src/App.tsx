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

  const headerRightSlot = (
    <>
      <OfflineSyncStatus />
      {!isInitialised && hasDismissedInitialSetup ? (
        <Button
          type="button"
          onClick={requestInitialSetup}
          variant="secondary"
          className="border-accent/50 text-xs font-semibold text-accent hover:bg-accent/10"
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
