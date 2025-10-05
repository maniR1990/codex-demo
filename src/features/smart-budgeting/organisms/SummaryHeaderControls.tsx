import { useId, useRef } from 'react';
import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface SummaryHeaderControlsProps {
  period: SmartBudgetingController['period'];
  table: SmartBudgetingController['table'];
  onOpenDialog: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function SummaryHeaderControls({ period, table, onOpenDialog, onExpandAll, onCollapseAll }: SummaryHeaderControlsProps) {
  const {
    viewMode,
    handleViewModeChange,
    periodLabel,
    summaryPeriodDescriptor,
    goToPreviousPeriod,
    goToNextPeriod,
    selectedMonth,
    selectedYear,
    handleMonthInputChange,
    handleYearInputChange
  } = period;
  const columnLabels: Record<SmartBudgetingController['table']['columnPreferences']['order'][number], string> = {
    category: 'Category / Planned items',
    earliestDue: 'Earliest due date',
    planned: 'Planned amount',
    actual: 'Actual amount',
    variance: 'Variance / remaining',
    actions: 'Actions'
  } as const;
  const columnMenuId = useId();
  const monthInputRef = useRef<HTMLInputElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);

  const openMonthPicker = () => {
    if (viewMode !== 'monthly') {
      handleViewModeChange('monthly');
    }
    if (typeof monthInputRef.current?.showPicker === 'function') {
      monthInputRef.current.showPicker();
      return;
    }
    monthInputRef.current?.focus();
  };

  const focusYearInput = () => {
    if (viewMode !== 'yearly') {
      handleViewModeChange('yearly');
    }
    yearInputRef.current?.focus();
    yearInputRef.current?.select();
  };

  const handleOpenPeriodPicker = () => {
    if (viewMode === 'monthly') {
      openMonthPicker();
      return;
    }
    focusYearInput();
  };

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-800/60 bg-slate-950/60 p-4 shadow-lg shadow-slate-950/10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Smart Budgeting &amp; Planned Expenses</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">Track and optimise spending guardrails</h1>
          <p className="mt-2 text-xs text-slate-400">
            Track planned versus actual spending for this {summaryPeriodDescriptor} and fine-tune category guardrails.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleViewModeChange('monthly')}
            className={`rounded-md px-3 py-1 text-sm transition ${
              viewMode === 'monthly' ? 'bg-accent text-slate-900' : 'hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => handleViewModeChange('yearly')}
            className={`rounded-md px-3 py-1 text-sm transition ${
              viewMode === 'yearly' ? 'bg-accent text-slate-900' : 'hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
          <button
            type="button"
            onClick={goToPreviousPeriod}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-accent"
            aria-label="Previous period"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={handleOpenPeriodPicker}
            className="rounded-md px-3 py-1 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            aria-label={viewMode === 'monthly' ? 'Select month' : 'Select year'}
          >
            {periodLabel}
          </button>
          <button
            type="button"
            onClick={goToNextPeriod}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-accent"
            aria-label="Next period"
          >
            ›
          </button>
        </div>
        {viewMode === 'monthly' ? (
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => handleMonthInputChange(event.target.value)}
            ref={monthInputRef}
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
            aria-label="Select month"
          />
        ) : (
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={selectedYear}
            onChange={(event) => handleYearInputChange(event.target.value)}
            ref={yearInputRef}
            className="w-24 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
            aria-label="Select year"
          />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenDialog}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-accent/90"
          >
            + Plan expenses
          </button>
          <button
            type="button"
            onClick={onExpandAll}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
          >
            Collapse all
          </button>
          <details className="relative">
            <summary
              className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
              aria-haspopup="menu"
              aria-controls={columnMenuId}
            >
              Columns
              <span aria-hidden className="text-[10px] text-slate-500">({table.visibleColumns.length})</span>
            </summary>
            <div
              id={columnMenuId}
              className="absolute right-0 z-10 mt-2 w-64 space-y-3 rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs text-slate-200 shadow-xl shadow-slate-950/40"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visible columns</p>
              <div className="space-y-2">
                {table.columnPreferences.order.map((column) => (
                  <label key={column} className="flex items-center justify-between gap-3 text-xs text-slate-200">
                    <span>{columnLabels[column]}</span>
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-accent focus:ring-accent"
                      checked={table.columnPreferences.visible[column]}
                      onChange={() => table.toggleColumnVisibility(column)}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={table.resetColumnPreferences}
                className="w-full rounded-md border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
              >
                Reset to default
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
