import { Badge } from '../atoms/Badge';
import { ProgressBar } from '../atoms/ProgressBar';
import { SummaryStat } from '../molecules/SummaryStat';
import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface SummaryGridProps {
  overview: SmartBudgetingController['overview'];
  categories: SmartBudgetingController['categories'];
  inspector: SmartBudgetingController['inspector'];
  utils: SmartBudgetingController['utils'];
}

export function SummaryGrid({ overview, categories, inspector, utils }: SummaryGridProps) {
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
    selectedStatusToken,
    selectedCategoryVariance,
    handleSummaryScopeChange,
    options,
    selectedCategoryId,
    focusCategory
  } = categories;

  const {
    baselineLabel,
    focusedCategory,
    budgetDraft,
    setBudgetDraft,
    handleBudgetSubmit,
    handleBudgetClear,
    isSavingBudget,
    budgetError,
    budgetFeedback
  } = inspector;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{summaryPeriodLabel} overview</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{periodLabel}</p>
            <p className="mt-2 text-xs text-slate-400">
              Planned {utils.formatCurrency(totalsForAll.totalPlanned)} · Spent {utils.formatCurrency(totalsForAll.actualTotal)}
            </p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${overallStatusToken.badgeClass}`}>
            {overallStatusToken.label}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-[11px] text-slate-400">
          <SummaryStat label="Planned" value={<span className="text-warning">{utils.formatCurrency(totalsForAll.plannedFromItems)}</span>} />
          <SummaryStat label="Budgets" value={utils.formatCurrency(totalsForAll.budgetTotal)} />
          <SummaryStat label="Actual" value={utils.formatCurrency(totalsForAll.actualTotal)} />
        </dl>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Utilisation</span>
            <span>{overallUtilisationPercent}%</span>
          </div>
          <ProgressBar value={overallUtilisationWidth} />
        </div>
      </article>

      <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary scope</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{selectedCategoryLabel}</p>
            <p className="mt-2 text-xs text-slate-400">
              Planned {utils.formatCurrency(totalsForSelected.totalPlanned)} · Spent {utils.formatCurrency(totalsForSelected.actualTotal)}
            </p>
          </div>
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selectedStatusToken.badgeClass}`}>
            {selectedStatusToken.label}
          </span>
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
            onClick={() => focusCategory(selectedCategoryId, true)}
            className="mt-3 text-[11px] font-semibold text-accent hover:text-accent/80"
          >
            Focus in navigator
          </button>
        )}
      </article>

      <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overspending hotspots</p>
        {overspendingCategories.length > 0 ? (
          <ul className="mt-3 space-y-2 text-xs">
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
                      focusCategory(category.id, true);
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

      <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Baseline controls</p>
        {focusedCategory ? (
          <form onSubmit={handleBudgetSubmit} className="mt-3 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">{focusedCategory.name}</p>
              <p className="text-[11px] text-slate-500">{baselineLabel}</p>
            </div>
            <input
              type="number"
              min={0}
              step="any"
              value={budgetDraft}
              onChange={(event) => setBudgetDraft(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
              placeholder="0"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-lg bg-success px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-60"
                disabled={isSavingBudget}
              >
                {isSavingBudget ? 'Saving…' : 'Save baseline'}
              </button>
              <button
                type="button"
                onClick={() => void handleBudgetClear()}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
                disabled={isSavingBudget}
              >
                Clear
              </button>
            </div>
            {budgetError && <p className="text-[10px] text-danger">{budgetError}</p>}
            {budgetFeedback === 'saved' && <p className="text-[10px] text-success">Baseline saved.</p>}
            {budgetFeedback === 'cleared' && <p className="text-[10px] text-slate-400">Baseline cleared for this category.</p>}
          </form>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Select a category in the navigator to set a spending baseline.</p>
        )}
      </article>
    </section>
  );
}
