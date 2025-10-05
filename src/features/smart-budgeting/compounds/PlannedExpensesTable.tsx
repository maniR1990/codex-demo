import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';
import { PlannedExpenseRow } from './PlannedExpenseRow';

interface PlannedExpensesTableProps {
  dialog: SmartBudgetingController['dialog'];
}

export function PlannedExpensesTable({ dialog }: PlannedExpensesTableProps) {
  const {
    entries,
    canRemoveRows,
    handleEntryChange,
    handleRemoveEntryRow,
    handleToggleCategoryCreation,
    categoryCreationTargetId,
    expenseCategories,
    resolveDefaultDueDate,
    PRIORITY_OPTIONS
  } = dialog;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-semibold">Name</th>
            <th className="px-3 py-2 font-semibold">Amount (₹)</th>
            <th className="px-3 py-2 font-semibold">Due date</th>
            <th className="px-3 py-2 font-semibold">Priority</th>
            <th className="px-3 py-2 font-semibold">Category</th>
            <th className="px-3 py-2 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {entries.map((entry) => (
            <PlannedExpenseRow
              key={entry.id}
              entry={entry}
              canRemove={canRemoveRows}
              priorityOptions={PRIORITY_OPTIONS}
              expenseCategories={expenseCategories}
              onEntryChange={handleEntryChange}
              onRemove={handleRemoveEntryRow}
              onToggleCategoryCreation={handleToggleCategoryCreation}
              isCreatingCategory={categoryCreationTargetId === entry.id}
              resolveDefaultDueDate={resolveDefaultDueDate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
