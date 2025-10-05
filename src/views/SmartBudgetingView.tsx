import { CategoryInspector } from '../features/smart-budgeting/organisms/CategoryInspector';
import { CategoryNavigator } from '../features/smart-budgeting/organisms/CategoryNavigator';
import { NavigatorFilters } from '../features/smart-budgeting/organisms/NavigatorFilters';
import { PlannedExpensesDialog } from '../features/smart-budgeting/organisms/PlannedExpensesDialog';
import { SummaryGrid } from '../features/smart-budgeting/organisms/SummaryGrid';
import { SummaryHeaderControls } from '../features/smart-budgeting/organisms/SummaryHeaderControls';
import { useSmartBudgetingController } from '../features/smart-budgeting/hooks/useSmartBudgetingController';

export function SmartBudgetingView() {
  const controller = useSmartBudgetingController();
  const { dialog, utils, period, categories, overview, inspector, editing } = controller;

  return (
    <div className="space-y-6">
      <PlannedExpensesDialog dialog={dialog} utils={utils} />

      <SummaryHeaderControls
        period={period}
        onOpenDialog={dialog.open}
        onExpandAll={categories.expandAllCategories}
        onCollapseAll={categories.collapseAllCategories}
      />

      <SummaryGrid overview={overview} categories={categories} inspector={inspector} utils={utils} />

      <NavigatorFilters categories={categories} />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1 space-y-4">
          <CategoryNavigator categories={categories} editing={editing} utils={utils} />
        </div>
        <CategoryInspector inspector={inspector} utils={utils} />
      </div>
    </div>
  );
}
