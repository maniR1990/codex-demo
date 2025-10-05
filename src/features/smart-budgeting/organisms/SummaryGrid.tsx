import { ProgressBar } from '../atoms/ProgressBar';
import { SummaryStat } from '../molecules/SummaryStat';
import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface SummaryGridProps {
  overview: SmartBudgetingController['overview'];
  categories: SmartBudgetingController['categories'];
  utils: SmartBudgetingController['utils'];
}

export function SummaryGrid({ overview, categories, utils }: SummaryGridProps) {
  const {
    totalsForAll,
    overallSummary,
    overallStatusToken,
    overallUtilisationPercent,
    overallUtilisationWidth,
    summaryPeriodLabel,
    periodLabel,
    summaryPeriodDescriptor,
    overspendingCategories
  } = overview;

  const {
    selectedCategoryLabel,
    totalsForSelected,
    selectedCategoryStatus,
    selectedStatusToken,
    selectedCategoryVariance,
    handleSummaryScopeChange,
    options,
    selectedCategoryId,
    focusCategory
  } = categories;

  const remaining = overallSummary.planned - overallSummary.actual;
  const remainingPercent =
    overallSummary.planned <= 0
      ? 0
      : Math.abs(Math.round((remaining / overallSummary.planned) * 100));
  const remainingDescriptor = remaining >= 0 ? 'left' : 'over';
  const spentPercent =
    overallSummary.planned <= 0
      ? 0
      : Math.max(0, Math.round((overallSummary.actual / overallSummary.planned) * 100));
  const now = new Date();
  const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pacePercent = Math.max(0, Math.min(100, Math.round((now.getDate() / totalDaysInMonth) * 100)));
  const paceDelta = pacePercent - spentPercent;
  const isUnderPace = paceDelta >= 0;
  const paceMessage = isUnderPace
    ? `You’re on track — spending ${paceDelta}% below your monthly pace!`
    : `Heads up — spending ${Math.abs(paceDelta)}% above your monthly pace.`;

  return (
    <>
      <article className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{summaryPeriodLabel} overview</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{periodLabel}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
              <span>
                Planned:{' '}
                <span className="font-semibold text-slate-100">
                  {utils.formatCurrency(overallSummary.planned)}
                </span>
              </span>
              <span>
                Spent:{' '}
                <span className="font-semibold text-slate-100">
                  {utils.formatCurrency(overallSummary.actual)}
                </span>
              </span>
              <span>
                Remaining:{' '}
                <span className={`font-semibold ${remaining >= 0 ? 'text-success' : 'text-danger'}`}>
                  {utils.formatCurrency(remaining)}
                </span>{' '}
                <span className="text-slate-500">
                  ({remainingPercent}% {remainingDescriptor})
                </span>
              </span>
            </div>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${overallStatusToken.badgeClass}`}>
            {overallStatusToken.label}
          </span>
        </div>
        <div className="mt-4 space-y-3 rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 text-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span>Planned</span>
            <span className="font-semibold text-slate-100">
              {utils.formatCurrency(overallSummary.planned)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Spent</span>
            <span className="font-semibold text-slate-100">
              {utils.formatCurrency(overallSummary.actual)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Remaining</span>
            <span className="flex items-baseline gap-2">
              <span className={`font-semibold ${remaining >= 0 ? 'text-success' : 'text-danger'}`}>
                {utils.formatCurrency(remaining)}
              </span>
              <span className="text-xs text-slate-500">({remainingPercent}% {remainingDescriptor})</span>
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
          <span className="text-base leading-none">💬</span>
          <p className="leading-relaxed">{paceMessage}</p>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Utilisation</span>
            <span>{overallUtilisationPercent}%</span>
          </div>
          <ProgressBar value={overallUtilisationWidth} />
        </div>
      </article>

      <article className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary scope</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{selectedCategoryLabel}</p>
            <p className="mt-2 text-xs text-slate-400">
              Planned {utils.formatCurrency(totalsForSelected.totalPlanned)} · Spent {utils.formatCurrency(totalsForSelected.actualTotal)}
            </p>
          </div>
          {selectedCategoryStatus !== 'not-spent' && (
            <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selectedStatusToken.badgeClass}`}>
              {selectedStatusToken.label}
            </span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-[11px] text-slate-400">
          <SummaryStat label="Planned" value={<span className="text-warning">{utils.formatCurrency(totalsForSelected.plannedFromItems)}</span>} />
          <SummaryStat label="Budgets" value={utils.formatCurrency(totalsForSelected.budgetTotal)} />
          <SummaryStat
            label="Variance"
            value={
              <span className={selectedCategoryVariance >= 0 ? 'text-success' : 'text-danger'}>
                {utils.formatCurrency(selectedCategoryVariance)}
              </span>
            }
          />
        </dl>
        <label className="mt-4 block text-[10px] uppercase tracking-wide text-slate-500" htmlFor="summary-scope-select">
          Change summary scope
        </label>
        <select
          id="summary-scope-select"
          value={selectedCategoryId}
          onChange={(event) => handleSummaryScopeChange(event.target.value as 'all' | string)}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
        >
          <option value="all">All categories</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        {selectedCategoryId !== 'all' && (
          <button
            type="button"
            onClick={() => focusCategory(selectedCategoryId)}
            className="mt-3 text-[11px] font-semibold text-accent hover:text-accent/80"
          >
            Focus in navigator
          </button>
        )}
      </article>

      <article className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overspending hotspots</p>
        {overspendingCategories.length > 0 ? (
          <ul className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1 text-xs">
            {overspendingCategories.map(({ category, summary }) => (
              <li key={category.id} className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">{category.name}</span>
                  <span className="font-semibold text-danger">{utils.formatCurrency(summary.variance)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-danger/80">
                  <span>
                    Spent {utils.formatCurrency(summary.actual)} of {utils.formatCurrency(summary.planned)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      focusCategory(category.id);
                      categories.handleSummaryScopeChange(category.id);
                    }}
                    className="font-semibold text-danger hover:underline"
                  >
                    Inspect
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-slate-500">No overspending recorded in this {summaryPeriodDescriptor}.</p>
        )}
      </article>
    </>
  );
}
