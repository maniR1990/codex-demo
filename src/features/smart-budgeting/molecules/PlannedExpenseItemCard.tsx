import { FormEvent } from 'react';
import type {
  PlannedExpenseDetail,
  SmartBudgetingController
} from '../hooks/useSmartBudgetingController';

interface PlannedExpenseItemCardProps {
  detail: PlannedExpenseDetail;
  depth: number;
  categories: SmartBudgetingController['categories'];
  editing: SmartBudgetingController['editing'];
  utils: SmartBudgetingController['utils'];
}

export function PlannedExpenseItemCard({ detail, depth, categories, editing, utils }: PlannedExpenseItemCardProps) {
  const {
    editingItemId,
    editDraft,
    setEditDraft,
    savingItemId,
    quickActualDrafts,
    quickActualSavingId,
    handleStartEdit,
    handleCancelEdit,
    handleQuickActualChange,
    handleQuickActualSubmit,
    handleSaveEdit,
    deletePlannedExpense,
    updatePlannedExpense
  } = editing;

  const categoryName = categories.lookup.get(detail.item.categoryId)?.name ?? 'Uncategorised';

  const isEditing = editingItemId === detail.item.id;
  const isSaving = savingItemId === detail.item.id;
  const dueDateLabel = detail.item.dueDate
    ? new Date(detail.item.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    : 'No due date';
  const progressPercentRaw =
    detail.item.plannedAmount <= 0
      ? detail.actual > 0
        ? 100
        : 0
      : (detail.actual / detail.item.plannedAmount) * 100;
  const progressPercent = Number.isFinite(progressPercentRaw) ? progressPercentRaw : 0;
  const progressColor = utils.PROGRESS_COLOR_BY_STATUS[detail.status];
  const varianceLabel = detail.variance >= 0 ? 'Saved' : 'Overspent';
  const statusToken = utils.SPENDING_BADGE_STYLES[detail.status];
  const priorityToken = utils.PRIORITY_TOKEN_STYLES[detail.priority ?? 'medium'];
  const actualToneClass = statusToken.toneClass;
  const actualBackgroundClass =
    detail.status === 'over'
      ? 'bg-danger/10'
      : detail.status === 'under'
      ? 'bg-success/10'
      : 'bg-slate-950/80';
  const remainderValue = detail.remainder;
  const remainderLabel = remainderValue >= 0 ? 'Remaining' : 'Overspent';
  const remainderDisplay = Math.abs(remainderValue);
  const isCurrentCategoryMissing =
    isEditing && editDraft.categoryId && !categories.options.some((option) => option.id === editDraft.categoryId);
  const parsedPlanned = Number(editDraft.plannedAmount);
  const parsedActual = editDraft.actualAmount.trim() === '' ? undefined : Number(editDraft.actualAmount);
  const parsedRemainder = editDraft.remainderAmount.trim() === '' ? null : Number(editDraft.remainderAmount);
  const isRemainderProvided = editDraft.remainderAmount.trim() !== '';
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
    !editDraft.categoryId ||
    editDraft.plannedAmount.trim() === '' ||
    hasPlannedError ||
    hasActualError ||
    hasRemainderError ||
    requiresDueDate ||
    isSaving;
  const quickActualDraft = quickActualDrafts[detail.item.id] ?? '';
  const quickActualTrimmed = quickActualDraft.trim();
  const quickActualValue = quickActualTrimmed === '' ? undefined : Number(quickActualTrimmed);
  const hasQuickActualError =
    quickActualValue !== undefined && (Number.isNaN(quickActualValue) || quickActualValue < 0);
  const isQuickSaving = quickActualSavingId === detail.item.id;
  const quickPlaceholder =
    typeof detail.item.actualAmount === 'number' && !Number.isNaN(detail.item.actualAmount)
      ? String(detail.item.actualAmount)
      : detail.actual > 0
      ? String(detail.actual)
      : '';
  const infoMessage =
    typeof detail.item.actualAmount === 'number' && !Number.isNaN(detail.item.actualAmount)
      ? `Manual spend recorded: ${utils.formatCurrency(detail.actual)}.`
      : detail.match
      ? `Matched with ${detail.match.description} on ${new Date(detail.match.date).toLocaleDateString('en-IN')}`
      : 'No matching transaction yet — update spent once the payment is made.';
  const remainderColor = detail.variance >= 0 ? 'text-success' : 'text-danger';

  const handleSubmitQuickActual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasQuickActualError && quickActualValue !== undefined && !isQuickSaving) {
      void handleQuickActualSubmit(detail);
    }
  };

  const indentationStyle = { paddingLeft: depth * 20 };

  return (
    <div
      key={detail.item.id}
      className={`group/row grid grid-cols-[minmax(0,2.6fr)_minmax(110px,0.9fr)_minmax(120px,0.9fr)_minmax(120px,0.9fr)_minmax(120px,0.9fr)_minmax(220px,1fr)] items-start gap-4 border-t border-slate-800/60 px-4 py-3 text-[11px] sm:text-xs transition ${
        isEditing ? 'bg-slate-950/60 ring-1 ring-inset ring-accent/40' : 'bg-slate-950/25 hover:bg-slate-900/55'
      }`}
    >
      <div className="min-w-0 space-y-2" style={indentationStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-100">{detail.item.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusToken.badgeClass}`}>
              {statusToken.label}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityToken.badgeClass}`}>
              {priorityToken.label}
            </span>
          </div>
          <span className="text-[10px] text-slate-500" title={categoryName}>
            {categoryName}
          </span>
        </div>
        <p className="truncate text-[10px] text-slate-500" title={infoMessage}>
          {infoMessage}
        </p>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-full flex-1 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%`, backgroundColor: progressColor }} />
          </div>
          <p className="text-[10px] text-slate-500">{remainderLabel}: {utils.formatCurrency(remainderDisplay)}</p>
          {isEditing && (
            <div className="pt-1">
              <label className="text-[10px] uppercase text-slate-500">Category</label>
              <select
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-100 focus:border-accent focus:outline-none"
                value={editDraft.categoryId}
                onChange={(event) => setEditDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
                disabled={isSaving}
              >
                {isCurrentCategoryMissing && (
                  <option value={detail.item.categoryId}>
                    {categoryName}
                  </option>
                )}
                {categories.options.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              {isCurrentCategoryMissing && (
                <p className="mt-1 text-[10px] text-warning">The original category is no longer available. Pick another one before saving.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col justify-center gap-1 text-xs text-slate-300">
        <span className="text-sm font-semibold text-slate-100">{dueDateLabel}</span>
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-slate-500">{utils.statusBadge(detail.item.status)}</div>
      </div>

      <div className="text-right">
        {isEditing ? (
          <div className="space-y-1">
            <input
              type="number"
              min={0}
              className={`w-full rounded-md border bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none ${
                hasPlannedError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
              }`}
              value={editDraft.plannedAmount}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, plannedAmount: event.target.value }))}
              disabled={isSaving}
            />
            {hasPlannedError && <p className="text-[10px] text-danger">Enter a valid planned amount.</p>}
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-sm font-semibold text-warning">{utils.formatCurrency(detail.item.plannedAmount)}</div>
            <div className="text-[10px] text-slate-500">Planned</div>
          </div>
        )}
      </div>

      <div className="text-right">
        {isEditing ? (
          <div className="space-y-1">
            <input
              type="number"
              min={0}
              placeholder="Auto from transactions"
              className={`w-full rounded-md border bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none ${
                hasActualError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
              }`}
              value={editDraft.actualAmount}
              onChange={(event) => setEditDraft((prev) => ({ ...prev, actualAmount: event.target.value }))}
              disabled={isRemainderProvided || isSaving}
            />
            {hasActualError && <p className="text-[10px] text-danger">Enter a valid spent amount.</p>}
          </div>
        ) : (
          <div className={`space-y-1 rounded-md border border-slate-800/70 px-3 py-1.5 text-right ${actualBackgroundClass}`}>
            <div className={`text-sm font-semibold ${actualToneClass}`}>{utils.formatCurrency(detail.actual)}</div>
            <div className="text-[10px] text-slate-500">Spent</div>
          </div>
        )}
      </div>

      <div className="text-right">
        <div className={`text-sm font-semibold ${remainderColor}`}>{utils.formatCurrency(detail.variance)}</div>
        <div className="text-[10px] text-slate-500">{varianceLabel}</div>
      </div>

      <div className="flex flex-col items-end gap-2 text-right">
        {!isEditing && (
          <form className="flex w-full items-center justify-end gap-2" onSubmit={handleSubmitQuickActual}>
            <input
              type="number"
              min={0}
              value={quickActualDraft}
              onChange={(event) => handleQuickActualChange(detail.item.id, event.target.value)}
              placeholder={quickPlaceholder || 'Spent'}
              className={`w-24 rounded-md border bg-slate-950/80 px-2 py-1 text-xs text-slate-100 focus:border-accent focus:outline-none ${
                hasQuickActualError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
              }`}
            />
            <button
              type="submit"
              disabled={hasQuickActualError || quickActualValue === undefined || isQuickSaving}
              className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-slate-900 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isQuickSaving ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}
        {hasQuickActualError && !isEditing && (
          <p className="text-[10px] text-danger">Enter a valid amount to save.</p>
        )}
        <div className="flex flex-wrap justify-end gap-1 text-[10px]">
          <button
            type="button"
            className="rounded-full bg-success/15 px-2 py-1 font-semibold text-success hover:bg-success/25"
            onClick={() => updatePlannedExpense(detail.item.id, { status: 'purchased' })}
          >
            Purchased
          </button>
          <button
            type="button"
            className="rounded-full bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700"
            onClick={() => updatePlannedExpense(detail.item.id, { status: 'cancelled' })}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-full bg-sky-500/15 px-2 py-1 font-semibold text-sky-300 hover:bg-sky-500/25"
            onClick={() => updatePlannedExpense(detail.item.id, { status: 'reconciled' })}
            disabled={detail.item.status === 'reconciled'}
          >
            Reconcile
          </button>
          <button
            type="button"
            className="rounded-full bg-danger/15 px-2 py-1 font-semibold text-danger hover:bg-danger/25"
            onClick={() => deletePlannedExpense(detail.item.id)}
          >
            Delete
          </button>
        </div>
        {isEditing ? (
          <div className="flex flex-wrap justify-end gap-2">
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
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleStartEdit(detail)}
            className="text-[11px] font-semibold text-accent hover:text-accent/80"
          >
            Edit details
          </button>
        )}
      </div>
    </div>
  );
}
