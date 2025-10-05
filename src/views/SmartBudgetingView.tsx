import { CategoryNavigator } from '../features/smart-budgeting/organisms/CategoryNavigator';
import { NavigatorFilters } from '../features/smart-budgeting/organisms/NavigatorFilters';
import { PlannedExpensesDialog } from '../features/smart-budgeting/organisms/PlannedExpensesDialog';
import { SummaryGrid } from '../features/smart-budgeting/organisms/SummaryGrid';
import { SummaryHeaderControls } from '../features/smart-budgeting/organisms/SummaryHeaderControls';
import { useSmartBudgetingController } from '../features/smart-budgeting/hooks/useSmartBudgetingController';
import { CategoryInspector } from '../features/smart-budgeting/organisms/CategoryInspector';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import { createDefaultBudgetMonth } from '../types';

export function SmartBudgetingView() {
  const controller = useSmartBudgetingController();
  const { dialog, utils, period, categories, overview, inspector, editing, table } = controller;
  const { getBudgetMonth, profile } = useFinancialStore();

  const selectedMonth = period.selectedMonth;
  const budgetMonth = getBudgetMonth(selectedMonth) ??
    createDefaultBudgetMonth(selectedMonth, profile?.currency ?? 'INR');

  return (
    <div className="space-y-6">
      <PlannedExpensesDialog dialog={dialog} utils={utils} />

      <SummaryHeaderControls
        period={period}
        table={table}
        onOpenDialog={dialog.open}
        onExpandAll={categories.expandAllCategories}
        onCollapseAll={categories.collapseAllCategories}
      />

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <SummaryGrid overview={overview} categories={categories} utils={utils} />
        <CategoryInspector inspector={inspector} utils={utils} />
      </section>

      <NavigatorFilters categories={categories} />

      <CategoryNavigator categories={categories} editing={editing} table={table} utils={utils} />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{`Ledger snapshot · ${period.periodLabel}`}</h3>
            <p className="text-xs text-slate-500">
              A quick glance at planned allocations, recorded actuals, and manual adjustments for the selected month.
            </p>
          </div>
        </header>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Planned items</h4>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {budgetMonth.plannedItems.length === 0 && (
                <li className="text-slate-500">No planned allocations recorded.</li>
              )}
              {budgetMonth.plannedItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <span>{item.name}</span>
                  <span className="text-warning font-semibold">{utils.formatCurrency(item.plannedAmount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Recorded actuals</h4>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {budgetMonth.actuals.length === 0 && (
                <li className="text-slate-500">No matched actuals logged yet.</li>
              )}
              {budgetMonth.actuals.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <span>{item.description ?? 'Unnamed actual'}</span>
                  <span className="font-semibold text-success">{utils.formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Unassigned spend</h4>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {budgetMonth.unassignedActuals.length === 0 && (
                <li className="text-slate-500">All spend has been categorised.</li>
              )}
              {budgetMonth.unassignedActuals.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <span>{item.description ?? 'Unassigned transaction'}</span>
                  <span className="font-semibold text-warning">{utils.formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-200">Adjustments & rollovers</h4>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {budgetMonth.adjustments.length === 0 && (
                <li className="text-slate-500">No manual adjustments captured.</li>
              )}
              {budgetMonth.adjustments.map((adjustment) => (
                <li key={adjustment.id} className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span>{adjustment.reason ?? 'Adjustment'}</span>
                    <span className="font-semibold text-accent">{utils.formatCurrency(adjustment.amount)}</span>
                  </div>
                  {(adjustment.rolloverSourceMonth || adjustment.rolloverTargetMonth) && (
                    <p className="text-[11px] text-slate-500">
                      {adjustment.rolloverSourceMonth ? `From ${adjustment.rolloverSourceMonth}` : ''}
                      {adjustment.rolloverSourceMonth && adjustment.rolloverTargetMonth ? ' → ' : ''}
                      {adjustment.rolloverTargetMonth ? `To ${adjustment.rolloverTargetMonth}` : ''}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
