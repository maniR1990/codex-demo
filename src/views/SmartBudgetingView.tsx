import { CategoryNavigator } from '../features/smart-budgeting/organisms/CategoryNavigator';
import { NavigatorFilters } from '../features/smart-budgeting/organisms/NavigatorFilters';
import { PlannedExpensesDialog } from '../features/smart-budgeting/organisms/PlannedExpensesDialog';
import { SummaryGrid } from '../features/smart-budgeting/organisms/SummaryGrid';
import { SummaryHeaderControls } from '../features/smart-budgeting/organisms/SummaryHeaderControls';
import { useSmartBudgetingController } from '../features/smart-budgeting/hooks/useSmartBudgetingController';
import { CategoryInspector } from '../features/smart-budgeting/organisms/CategoryInspector';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import { createDefaultBudgetMonth } from '../types';
import { LedgerSnapshot } from '../features/smart-budgeting/compounds/LedgerSnapshot';

export function SmartBudgetingView() {
  const controller = useSmartBudgetingController();
  const { dialog, utils, period, categories, overview, inspector, editing, table } = controller;
  const { getBudgetMonth, profile } = useFinancialStore();

  const selectedMonth = period.selectedMonth;
  const budgetMonth = getBudgetMonth(selectedMonth) ?? createDefaultBudgetMonth(selectedMonth, profile?.currency ?? 'INR');

  return (
    <div className="space-y-6">
      <PlannedExpensesDialog dialog={dialog} />

      <SummaryHeaderControls period={period} />

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <SummaryGrid overview={overview} categories={categories} utils={utils} />
        <CategoryInspector inspector={inspector} utils={utils} />
      </section>

      <NavigatorFilters
        categories={categories}
        table={table}
        onOpenDialog={dialog.open}
        onExpandAll={categories.expandAllCategories}
        onCollapseAll={categories.collapseAllCategories}
      />

      <CategoryNavigator categories={categories} editing={editing} table={table} utils={utils} />

      <LedgerSnapshot budgetMonth={budgetMonth} utils={utils} periodLabel={period.periodLabel} />
    </div>
  );
}
