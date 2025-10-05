import { formatISO } from 'date-fns';
import type { PlannedExpenseItem } from '../../../types';
import type { PlannedExpenseDetail, SmartBudgetingController } from '../hooks/useSmartBudgetingController';

const STATUS_OPTIONS: Array<{ value: PlannedExpenseItem['status']; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'purchased', label: 'Purchased' },
  { value: 'reconciled', label: 'Reconciled' },
  { value: 'cancelled', label: 'Cancelled' }
];

interface PlannedExpenseItemCardProps {
  detail: PlannedExpenseDetail;
  depth: number;
  categories: SmartBudgetingController['categories'];
  editing: SmartBudgetingController['editing'];
  table: SmartBudgetingController['table'];
  utils: SmartBudgetingController['utils'];
  isFocused?: boolean;
  rowRef?: (element: HTMLDivElement | null) => void;
}

export function PlannedExpenseItemCard({
  detail,
  depth,
  categories,
  editing,
  table,
  utils,
  isFocused = false,
  rowRef
}: PlannedExpenseItemCardProps) {
  const {
    editingItemId,
    editDraft,
    setEditDraft,
    savingItemId,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    deletePlannedExpense
  } = editing;

  const categoryName = categories.lookup.get(detail.item.categoryId)?.name ?? 'Uncategorised';
  const isEditing = editingItemId === detail.item.id;
  const isSaving = savingItemId === detail.item.id;
  const dueDateLabel = detail.item.dueDate
    ? new Date(detail.item.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    : 'No due date';
  const fallbackDueDate =
    detail.item.dueDate ?? formatISO(new Date(detail.item.createdAt), { representation: 'date' });
  const statusLabel =
    STATUS_OPTIONS.find((option) => option.value === detail.item.status)?.label ?? 'Pending';
  const remainderValue = detail.remainder;
  const remainderLabel = remainderValue >= 0 ? 'Remaining' : 'Overspent';
  const remainderDisplay = Math.abs(remainderValue);

  const indentationStyle = { paddingLeft: depth * 20 };
  const rowToneClass = isEditing
    ? 'bg-slate-950/60 ring-1 ring-inset ring-accent/40'
    : isFocused
    ? 'bg-slate-900/60 ring-1 ring-inset ring-accent/30'
    : 'bg-slate-950/25 hover:bg-slate-900/55';

  const isCurrentCategoryMissing =
    isEditing && editDraft.categoryId && !categories.options.some((option) => option.id === editDraft.categoryId);
  const parsedPlanned = Number(editDraft.plannedAmount);
  const parsedActual = editDraft.actualAmount.trim() === '' ? undefined : Number(editDraft.actualAmount);
  const parsedRemainder = editDraft.remainderAmount.trim() === '' ? null : Number(editDraft.remainderAmount);
  const isRemainderProvided = editDraft.remainderAmount.trim() !== '';
  const hasNameError = isEditing && editDraft.name.trim() === '';
  const hasPlannedError = isEditing && (Number.isNaN(parsedPlanned) || parsedPlanned < 0);
  const hasActualError =
    isEditing &&
    !isRemainderProvided &&
    parsedActual !== undefined &&
    (Number.isNaN(parsedActual) || parsedActual < 0);
  const hasRemainderError =
    isEditing &&
    parsedRemainder !== null &&
    (Number.isNaN(parsedRemainder) || parsedRemainder < 0 || (Number.isFinite(parsedPlanned) && parsedPlanned >= 0 && parsedRemainder > parsedPlanned));
  const requiresDueDate = isEditing && editDraft.hasDueDate && editDraft.dueDate.trim() === '';
  const isSaveDisabled =
    !isEditing ||
    hasNameError ||
    !editDraft.categoryId ||
    editDraft.plannedAmount.trim() === '' ||
    hasPlannedError ||
    hasActualError ||
    hasRemainderError ||
    requiresDueDate ||
    isSaving;

  const handleRowClick = () => {
    if (!isEditing) {
      handleStartEdit(detail);
    }
  };

  return (
    <div
      ref={rowRef}
      className={`grid items-start gap-4 border-t border-slate-800/60 px-4 py-3 text-[11px] sm:text-xs transition ${rowToneClass}`}
      style={{ gridTemplateColumns: table.gridTemplateColumns }}
      onClick={handleRowClick}
    >
      {table.visibleColumns.map((column) => {
        switch (column) {
          case 'category':
            return (
              <div key={`${detail.item.id}-${column}`} className="flex flex-col gap-1" style={indentationStyle}>
                {isEditing ? (
                  <>
                    <label className="text-[10px] uppercase text-slate-500">Category</label>
                    <select
                      className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 focus:border-accent focus:outline-none"
                      value={editDraft.categoryId}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
                      disabled={isSaving}
                    >
                      {isCurrentCategoryMissing && (
                        <option value={detail.item.categoryId}>{categoryName}</option>
                      )}
                      {categories.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {isCurrentCategoryMissing && (
                      <p className="text-[10px] text-warning">
                        The original category is no longer available. Pick another one before saving.
                      </p>
                    )}
                  </>
                ) : (
                  <span className="truncate text-sm font-semibold text-slate-100" title={categoryName}>
                    {categoryName}
                  </span>
                )}
              </div>
            );
          case 'item':
            return (
              <div key={`${detail.item.id}-${column}`} className="flex flex-col gap-1">
                {isEditing ? (
                  <>
                    <label className="text-[10px] uppercase text-slate-500">Item name</label>
                    <input
                      type="text"
                      className={`w-full rounded-md border bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none ${
                        hasNameError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
                      }`}
                      value={editDraft.name}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, name: event.target.value }))}
                      disabled={isSaving}
                    />
                    {hasNameError && <p className="text-[10px] text-danger">Enter an item name.</p>}
                  </>
                ) : (
                  <span className="truncate text-sm font-semibold text-slate-100">{detail.item.name}</span>
                )}
              </div>
            );
          case 'planned':
            return (
              <div key={`${detail.item.id}-${column}`} className="flex flex-col items-end gap-1 text-right">
                {isEditing ? (
                  <>
                    <label className="text-[10px] uppercase text-slate-500 text-left">Planned amount</label>
                    <input
                      type="number"
                      min={0}
                      className={`w-full rounded-md border bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none ${
                        hasPlannedError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
                      }`}
                      value={editDraft.plannedAmount}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, plannedAmount: event.target.value }))}
                      disabled={isSaving}
                    />
                    {hasPlannedError && <p className="text-[10px] text-danger">Enter a valid planned amount.</p>}
                  </>
                ) : (
                  <span className="text-sm font-semibold text-slate-100">
                    {utils.formatCurrency(detail.item.plannedAmount)}
                  </span>
                )}
              </div>
            );
          case 'actual':
            return (
              <div key={`${detail.item.id}-${column}`} className="flex flex-col items-end gap-1 text-right">
                {isEditing ? (
                  <>
                    <label className="text-[10px] uppercase text-slate-500 text-left">Actual spent</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Leave blank to use remaining"
                      className={`w-full rounded-md border bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none ${
                        hasActualError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
                      }`}
                      value={editDraft.actualAmount}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, actualAmount: event.target.value }))}
                      disabled={isRemainderProvided || isSaving}
                    />
                    {hasActualError && <p className="text-[10px] text-danger">Enter a valid spent amount.</p>}
                    {isRemainderProvided && (
                      <p className="text-[10px] text-slate-500">Clear remaining amount to edit spent.</p>
                    )}
                  </>
                ) : (
                  <span className="text-sm font-semibold text-slate-100">
                    {utils.formatCurrency(detail.actual)}
                  </span>
                )}
              </div>
            );
          case 'variance':
            return (
              <div key={`${detail.item.id}-${column}`} className="flex flex-col items-end gap-1 text-right">
                <span className={`text-sm font-semibold ${detail.variance >= 0 ? 'text-success' : 'text-danger'}`}>
                  {utils.formatCurrency(detail.variance)}
                </span>
                <span className="text-[10px] text-slate-500">{remainderLabel}</span>
                {isEditing ? (
                  <>
                    <label className="text-left text-[10px] uppercase text-slate-500">Remaining amount</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Leave blank to edit spent"
                      className={`w-full rounded-md border bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none ${
                        hasRemainderError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
                      }`}
                      value={editDraft.remainderAmount}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, remainderAmount: event.target.value }))}
                      disabled={isSaving}
                    />
                    {hasRemainderError && (
                      <p className="text-[10px] text-danger">Enter a valid remaining amount or clear the field.</p>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-slate-500">
                    {remainderLabel}: {utils.formatCurrency(remainderDisplay)}
                  </span>
                )}
              </div>
            );
          case 'due':
            return (
              <div key={`${detail.item.id}-${column}`} className="flex flex-col gap-1 text-left">
                {isEditing ? (
                  <>
                    <label className="text-[10px] uppercase text-slate-500">Due date</label>
                    <input
                      type="date"
                      className={`w-full rounded-md border bg-slate-950/80 px-2 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
                        requiresDueDate ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
                      }`}
                      value={editDraft.dueDate}
                      onChange={(event) => setEditDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
                      disabled={!editDraft.hasDueDate || isSaving}
                    />
                    <label className="flex items-center gap-2 text-[10px] text-slate-400">
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-accent focus:ring-accent"
                        checked={!editDraft.hasDueDate}
                        onChange={(event) => {
                          const noDueDate = event.target.checked;
                          setEditDraft((prev) => ({
                            ...prev,
                            hasDueDate: !noDueDate,
                            dueDate: noDueDate ? '' : prev.dueDate || fallbackDueDate
                          }));
                        }}
                        disabled={isSaving}
                      />
                      <span>No due date</span>
                    </label>
                    {requiresDueDate && (
                      <p className="text-[10px] text-danger">Select a due date or mark the item as having no due date.</p>
                    )}
                  </>
                ) : (
                  <span className="text-sm font-semibold text-slate-100">{dueDateLabel}</span>
                )}
              </div>
            );
          case 'status':
            return (
              <div key={`${detail.item.id}-${column}`} className="flex flex-col gap-1 text-left">
                {isEditing ? (
                  <>
                    <label className="text-[10px] uppercase text-slate-500">Status</label>
                    <select
                      className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 focus:border-accent focus:outline-none"
                      value={editDraft.status}
                      onChange={(event) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          status: event.target.value as PlannedExpenseItem['status']
                        }))
                      }
                      disabled={isSaving}
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-slate-100">{statusLabel}</span>
                )}
              </div>
            );
          case 'priority':
            return (
              <div key={`${detail.item.id}-${column}`} className="flex flex-col gap-2 text-left">
                {isEditing ? (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase text-slate-500">Priority</label>
                      <select
                        className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-xs text-slate-100 focus:border-accent focus:outline-none"
                        value={editDraft.priority}
                        onChange={(event) =>
                          setEditDraft((prev) => ({
                            ...prev,
                            priority: event.target.value as PlannedExpenseItem['priority']
                          }))
                        }
                        disabled={isSaving}
                      >
                        {utils.PRIORITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => void handleSaveEdit(detail)}
                        disabled={isSaveDisabled}
                        className="rounded-md bg-success px-3 py-1 text-[11px] font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSaving ? 'Saving…' : 'Save changes'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="rounded-md border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePlannedExpense(detail.item.id)}
                        disabled={isSaving}
                        className="rounded-md border border-danger/40 px-3 py-1 text-[11px] font-semibold text-danger hover:border-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="text-sm font-semibold text-slate-100">
                    {utils.PRIORITY_TOKEN_STYLES[detail.priority ?? 'medium'].label}
                  </span>
                )}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
