import { useCallback, useRef } from 'react';
import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface SummaryHeaderControlsProps {
  period: SmartBudgetingController['period'];
  onOpenDialog: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function SummaryHeaderControls({ period, onOpenDialog, onExpandAll, onCollapseAll }: SummaryHeaderControlsProps) {
  const monthInputRef = useRef<HTMLInputElement | null>(null);

  const openMonthPicker = useCallback(() => {
    if (!monthInputRef.current) {
      return;
    }
    const enhancedInput = monthInputRef.current as HTMLInputElement & { showPicker?: () => void };
    if (typeof enhancedInput.showPicker === 'function') {
      enhancedInput.showPicker();
      return;
    }
    enhancedInput.focus();
  }, []);

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
        <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-700 bg-slate-950/70 text-sm text-slate-200 shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={goToPreviousPeriod}
              className="rounded-md bg-slate-900/40 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-900/60 hover:text-accent"
              aria-label="Previous period"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-slate-100">{periodLabel}</span>
            <button
              type="button"
              onClick={goToNextPeriod}
              className="rounded-md bg-slate-900/40 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-900/60 hover:text-accent"
              aria-label="Next period"
            >
              ›
            </button>
          </div>
          {viewMode === 'monthly' ? (
            <div className="flex items-center border-l border-slate-700 bg-slate-950/60">
              <button
                type="button"
                onClick={openMonthPicker}
                className="flex h-full items-center px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-900/60 hover:text-accent"
                aria-label="Select month"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <path d="M16 2v4" />
                  <path d="M8 2v4" />
                  <path d="M3 10h18" />
                </svg>
              </button>
              <input
                ref={monthInputRef}
                type="month"
                value={selectedMonth}
                onChange={(event) => handleMonthInputChange(event.target.value)}
                className="sr-only"
                aria-label="Month picker"
              />
            </div>
          ) : (
            <div className="flex items-center border-l border-slate-700 bg-slate-950/60 px-3 py-2">
              <label htmlFor="summary-year-input" className="sr-only">
                Select year
              </label>
              <input
                id="summary-year-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={selectedYear}
                onChange={(event) => handleYearInputChange(event.target.value)}
                className="w-20 bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
            </div>
          )}
        </div>
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
            aria-label="Expand all"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-accent"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onCollapseAll}
            aria-label="Collapse all"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-accent"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
