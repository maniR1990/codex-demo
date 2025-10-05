import { useId, useRef } from 'react';
import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface SummaryHeaderControlsProps {
  period: SmartBudgetingController['period'];
}

export function SummaryHeaderControls({ period }: SummaryHeaderControlsProps) {
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
  const monthInputId = useId();
  const yearInputId = useId();
  const monthInputRef = useRef<HTMLInputElement>(null);
  const yearInputRef = useRef<HTMLInputElement>(null);

  const openMonthPicker = () => {
    if (viewMode !== 'monthly') {
      handleViewModeChange('monthly');
    }

    const monthInput = monthInputRef.current;
    if (!monthInput) {
      return;
    }

    if (typeof monthInput.showPicker === 'function') {
      monthInput.showPicker();
      return;
    }

    monthInput.focus();
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-2 text-sm text-slate-200">
          <button
            type="button"
            onClick={goToPreviousPeriod}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-accent"
            aria-label="Previous period"
          >
            ‹
          </button>
          <div className="flex items-center gap-2 rounded-md border border-slate-800/70 bg-slate-900/40 px-2 py-1">
            {viewMode === 'monthly' ? (
              <>
                <input
                  id={monthInputId}
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => handleMonthInputChange(event.target.value)}
                  ref={monthInputRef}
                  className="sr-only"
                  aria-label="Select month"
                />
                <button
                  type="button"
                  onClick={openMonthPicker}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700/70 text-slate-300 transition hover:border-slate-500 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                  aria-controls={monthInputId}
                  aria-label="Open month picker"
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
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleOpenPeriodPicker}
                  className="rounded-md px-3 py-1 text-sm font-semibold text-slate-100 transition hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                  aria-label="Select month"
                >
                  {periodLabel}
                </button>
              </>
            ) : (
              <label htmlFor={yearInputId} className="flex items-center gap-2 text-slate-200">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Year</span>
                <input
                  id={yearInputId}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={selectedYear}
                  onChange={(event) => handleYearInputChange(event.target.value)}
                  ref={yearInputRef}
                  className="w-20 rounded-md border border-slate-700/70 bg-slate-950/70 px-3 py-1 text-sm font-semibold text-slate-100 focus:border-accent focus:outline-none"
                  aria-label="Select year"
                />
              </label>
            )}
          </div>
          <button
            type="button"
            onClick={goToNextPeriod}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-accent"
            aria-label="Next period"
          >
            ›
          </button>
        </div>
      </div>
    </header>
  );
}
