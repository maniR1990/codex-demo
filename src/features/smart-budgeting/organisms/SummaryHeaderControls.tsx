import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface SummaryHeaderControlsProps {
  period: SmartBudgetingController['period'];
  onOpenDialog: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function SummaryHeaderControls({ period, onOpenDialog, onExpandAll, onCollapseAll }: SummaryHeaderControlsProps) {
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
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-200">
          <button
            type="button"
            onClick={goToPreviousPeriod}
            className="rounded-md border border-slate-700 px-2 py-1 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-accent"
            aria-label="Previous period"
          >
            ‹
          </button>
          <span className="text-sm font-semibold text-slate-100">{periodLabel}</span>
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
            className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
          />
        ) : (
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={selectedYear}
            onChange={(event) => handleYearInputChange(event.target.value)}
            className="w-24 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
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
