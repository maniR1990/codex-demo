import { CategoryNavigator } from '../features/smart-budgeting/organisms/CategoryNavigator';
import { NavigatorFilters } from '../features/smart-budgeting/organisms/NavigatorFilters';
import { PlannedExpensesDialog } from '../features/smart-budgeting/organisms/PlannedExpensesDialog';
import { SummaryGrid } from '../features/smart-budgeting/organisms/SummaryGrid';
import { SummaryHeaderControls } from '../features/smart-budgeting/organisms/SummaryHeaderControls';
import { useSmartBudgetingController } from '../features/smart-budgeting/hooks/useSmartBudgetingController';
import { CategoryInspector } from '../features/smart-budgeting/organisms/CategoryInspector';

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

      <SummaryGrid overview={overview} categories={categories} utils={utils} />

      <CategoryInspector inspector={inspector} utils={utils} />

      <NavigatorFilters categories={categories} />

      <CategoryNavigator categories={categories} editing={editing} utils={utils} />
    </div>
  );
}
