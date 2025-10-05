import { FormEvent } from 'react';
import { Badge } from '../atoms/Badge';
import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface PlannedExpensesDialogProps {
  dialog: SmartBudgetingController['dialog'];
  utils: SmartBudgetingController['utils'];
}

export function PlannedExpensesDialog({ dialog, utils }: PlannedExpensesDialogProps) {
  const {
    isOpen,
    close,
    handleSubmit,
    entries,
    handleEntryChange,
    handleAddEntryRow,
    handleRemoveEntryRow,
    canRemoveRows,
    expenseCategories,
    categoryCreationTargetId,
    handleToggleCategoryCreation,
    newCategoryName,
    setNewCategoryName,
    handleCreateCategory,
    shouldShowValidationError,
    isSubmitting,
    resolveDefaultDueDate
  } = dialog;

  if (!isOpen) {
    return null;
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    void handleSubmit(event);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-100">Add planned expenses</h3>
              <p className="text-sm text-slate-400">Capture multiple planned expenses at once and assign them to categories.</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="self-start rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-slate-500"
            >
              Close
            </button>
          </div>

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
                {entries.map((entry) => {
                  const isCreatingForRow = categoryCreationTargetId === entry.id;
                  return (
                    <tr key={entry.id} className="align-top">
                      <td className="px-3 py-2">
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                          placeholder="e.g. School fees"
                          value={entry.name}
                          onChange={(event) => handleEntryChange(entry.id, { name: event.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                          placeholder="0"
                          value={entry.amount}
                          onChange={(event) => handleEntryChange(entry.id, { amount: event.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-2">
                          <input
                            type="date"
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm disabled:opacity-60"
                            value={entry.dueDate}
                            onChange={(event) => handleEntryChange(entry.id, { dueDate: event.target.value })}
                            disabled={!entry.hasDueDate}
                          />
                          <label className="flex items-center gap-2 text-xs text-slate-400">
                            <input
                              type="checkbox"
                              checked={!entry.hasDueDate}
                              onChange={(event) => {
                                const noDueDate = event.target.checked;
                                handleEntryChange(entry.id, {
                                  hasDueDate: !noDueDate,
                                  ...(noDueDate ? {} : { dueDate: entry.dueDate || resolveDefaultDueDate() })
                                });
                              }}
                            />
                            <span>No due date</span>
                          </label>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                          value={entry.priority}
                          onChange={(event) =>
                            handleEntryChange(entry.id, {
                              priority: event.target.value as (typeof utils.PRIORITY_OPTIONS)[number]['value']
                            })
                          }
                        >
                          {utils.PRIORITY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-2">
                          <select
                            className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                            value={entry.categoryId}
                            onChange={(event) => handleEntryChange(entry.id, { categoryId: event.target.value })}
                            disabled={expenseCategories.length === 0}
                          >
                            <option value="" disabled>
                              {expenseCategories.length === 0 ? 'No categories available' : 'Select category'}
                            </option>
                            {expenseCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryCreation(entry.id)}
                            className="self-start text-xs font-semibold text-accent"
                          >
                            {isCreatingForRow ? 'Cancel new category' : 'New category'}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveEntryRow(entry.id)}
                          className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100 disabled:opacity-40"
                          disabled={!canRemoveRows}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {categoryCreationTargetId && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-sm font-semibold text-slate-200">Create a new category</p>
              <p className="text-xs text-slate-500">The new category will automatically be assigned to the selected planned expense row.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
                    disabled={!newCategoryName.trim()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryName('');
                      handleToggleCategoryCreation(categoryCreationTargetId);
                    }}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {shouldShowValidationError && (
            <p className="text-sm text-danger">
              Please complete all required fields before saving your planned expenses. Ensure at least one expense category exists.
            </p>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleAddEntryRow}
              className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
            >
              Add another row
            </button>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <Badge tone="info">Bulk planning</Badge>
              <button
                type="submit"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-accent/90 disabled:opacity-60"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving…' : 'Save planned expenses'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
