import type { ComponentType } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Button } from './components/atoms/Button';
import { ErrorBoundary } from './components/atoms/ErrorBoundary';
import type { ErrorBoundaryFallbackProps } from './components/atoms/ErrorBoundary';
import { InitialSetupDialog } from './components/InitialSetupDialog';
import { OfflineSyncStatus } from './components/OfflineSyncStatus';
import { QuickExpenseCapture } from './components/QuickExpenseCapture';
import { SectionErrorFallback } from './components/molecules/SectionErrorFallback';
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

type RouteComponent = ComponentType<Record<string, never>>;

type RouteConfig = {
  path: string;
  label: string;
  Component: RouteComponent;
  end?: boolean;
};

const ROUTES: RouteConfig[] = [
  { path: '/', label: 'CEO Dashboard', Component: DashboardView, end: true },
  { path: '/balance', label: 'Unified Balance Sheet', Component: BalanceSheetView },
  { path: '/trends', label: 'Trend Analysis', Component: TrendAnalysisView },
  { path: '/budgeting', label: 'Smart Budgeting', Component: SmartBudgetingView },
  { path: '/income', label: 'Income & Categories', Component: IncomeManagementView },
  { path: '/recurring', label: 'Recurring Expenses Hub', Component: RecurringExpensesView },
  { path: '/goals', label: 'Goal Setting & Simulation', Component: GoalSimulatorView },
  { path: '/insights', label: 'Actionable Insights', Component: InsightsView },
  { path: '/accelerator', label: 'Wealth Accelerator Intelligence', Component: WealthAcceleratorView }
];

const NAV_LINKS = ROUTES.map(({ path, label, end }) => ({ to: path, label, end })) as const;

const createSectionFallback =
  (section: string) =>
  ({ error, reset }: ErrorBoundaryFallbackProps) => (
    <SectionErrorFallback section={section} error={error} onRetry={reset} />
  );

export default function App() {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const location = useLocation();
  const { isInitialised, hasDismissedInitialSetup, requestInitialSetup } = useFinancialStore();

  const headerFallback = useMemo(() => createSectionFallback('application header'), []);
  const headerToolsFallback = useMemo(() => createSectionFallback('header tools'), []);
  const navigationFallback = useMemo(() => createSectionFallback('navigation menu'), []);
  const footerFallback = useMemo(() => createSectionFallback('quick actions'), []);
  const workspaceFallback = useMemo(() => createSectionFallback('workspace'), []);

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  const headerRightSlot = (
    <ErrorBoundary fallback={headerToolsFallback}>
      <>
        <OfflineSyncStatus />
        {!isInitialised && hasDismissedInitialSetup ? (
          <Button
            type="button"
            onClick={requestInitialSetup}
            variant="ghost"
            className="border border-accent/50 text-accent hover:bg-accent/10"
          >
            Resume ledger setup
          </Button>
        ) : null}
      </>
    </ErrorBoundary>
  );

  const navigationItems = NAV_LINKS.map((link) => (
    <NavItem key={link.to} to={link.to} end={link.end} label={link.label} />
  ));

  return (
    <AppShell
      header={
        <ErrorBoundary fallback={headerFallback}>
          <AppHeader
            title="Wealth Accelerator"
            subtitle="Offline-first financial intelligence engine for Indian CEOs & households"
            isNavOpen={isNavOpen}
            onToggleNav={() => setIsNavOpen((open) => !open)}
            rightSlot={headerRightSlot}
          />
        </ErrorBoundary>
      }
      navigation={
        <ErrorBoundary fallback={navigationFallback}>
          <AppNavigation isNavOpen={isNavOpen} items={navigationItems} />
        </ErrorBoundary>
      }
      footer={
        <ErrorBoundary fallback={footerFallback}>
          <>
            <QuickExpenseCapture />
            <InitialSetupDialog />
          </>
        </ErrorBoundary>
      }
    >
      <ErrorBoundary key={location.pathname} fallback={workspaceFallback}>
        <Routes>
          {ROUTES.map(({ path, Component, label }) => (
            <Route
              key={path}
              path={path}
              element={
                <ErrorBoundary fallback={createSectionFallback(label)}>
                  <Component />
                </ErrorBoundary>
              }
            />
          ))}
        </Routes>
      </ErrorBoundary>
    </AppShell>
  );
}
