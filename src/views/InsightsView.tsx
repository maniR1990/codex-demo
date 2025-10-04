import { useMemo, useState } from 'react';
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';

export function InsightsView() {
  const { insights, transactions, categories, profile, recurringExpenses, plannedExpenses } = useFinancialStore();
  const [ruleReduction, setRuleReduction] = useState(15);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: profile?.currency ?? 'INR',
        maximumFractionDigits: 0
      }),
    [profile?.currency]
  );

  const percentageFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-IN', {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }),
    []
  );

  const spendingAnalysis = useMemo(() => {
    const expenseTransactions = transactions.filter((txn) => txn.amount < 0);

    if (expenseTransactions.length === 0) {
      return {
        monthlyAverage: 0,
        monthsTracked: 0,
        topCategories: [] as Array<{ id: string; name: string; monthlyAverage: number; share: number }>
      };
    }

    const totalsByMonth = new Map<string, number>();
    expenseTransactions.forEach((txn) => {
      const date = new Date(txn.date);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + Math.abs(txn.amount));
    });

    const totalSpend = Array.from(totalsByMonth.values()).reduce((sum, value) => sum + value, 0);
    const monthsTracked = totalsByMonth.size || 1;
    const monthlyAverage = totalSpend / monthsTracked;

    const categoryTotals = new Map<string, number>();
    expenseTransactions.forEach((txn) => {
      const key = txn.categoryId ?? 'uncategorised';
      categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + Math.abs(txn.amount));
    });

    const topCategories = Array.from(categoryTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([categoryId, total]) => {
        const categoryName = categories.find((cat) => cat.id === categoryId)?.name ?? 'Uncategorised';
        const categoryMonthlyAverage = total / monthsTracked;
        const share = monthlyAverage > 0 ? categoryMonthlyAverage / monthlyAverage : 0;
        return {
          id: categoryId,
          name: categoryName,
          monthlyAverage: categoryMonthlyAverage,
          share
        };
      });

    return { monthlyAverage, monthsTracked, topCategories };
  }, [transactions, categories]);

  const projectedMonthlySavings = useMemo(
    () => spendingAnalysis.monthlyAverage * (ruleReduction / 100),
    [spendingAnalysis.monthlyAverage, ruleReduction]
  );
  const projectedMonthlySpend = useMemo(
    () => spendingAnalysis.monthlyAverage - projectedMonthlySavings,
    [spendingAnalysis.monthlyAverage, projectedMonthlySavings]
  );
  const projectedAnnualSavings = useMemo(() => projectedMonthlySavings * 12, [projectedMonthlySavings]);

  const upcomingRecurring = useMemo(() => {
    const today = new Date();
    const nextRecurring = recurringExpenses
      .map((expense) => {
        const scheduledDate = parseISO(expense.nextDueDate ?? expense.dueDate);
        return {
          ...expense,
          scheduledDate
        };
      })
      .filter((expense) => isValid(expense.scheduledDate))
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())[0];

    if (!nextRecurring) {
      return null;
    }

    const daysUntil = differenceInCalendarDays(nextRecurring.scheduledDate, today);
    const dueLabel =
      daysUntil === 0
        ? 'Due today'
        : daysUntil === 1
        ? 'Due tomorrow'
        : daysUntil > 1
        ? `Due in ${daysUntil} days`
        : `Overdue by ${Math.abs(daysUntil)} days`;

    return {
      name: nextRecurring.name,
      amount: currencyFormatter.format(nextRecurring.amount),
      dueLabel,
      dateLabel: format(nextRecurring.scheduledDate, 'dd MMM yyyy')
    };
  }, [recurringExpenses, currencyFormatter]);

  const plannedExpenseSummary = useMemo(() => {
    const pendingExpenses = plannedExpenses.filter((expense) => expense.status === 'pending');
    const totalPending = pendingExpenses.reduce((sum, item) => sum + item.plannedAmount, 0);

    const nextExpense = pendingExpenses
      .map((expense) => {
        const scheduledDate = parseISO(expense.dueDate);
        return {
          ...expense,
          scheduledDate
        };
      })
      .filter((expense) => isValid(expense.scheduledDate))
      .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())[0];

    return {
      totalPending,
      nextExpense: nextExpense
        ? {
            name: nextExpense.name,
            dateLabel: format(nextExpense.scheduledDate, 'dd MMM'),
            daysUntil: differenceInCalendarDays(nextExpense.scheduledDate, new Date())
          }
        : null
    };
  }, [plannedExpenses]);

  const actionableTiles = useMemo(() => {
    return [
      {
        id: 'tile-upcoming-recurring',
        title: 'Upcoming recurring payment',
        primaryText: upcomingRecurring ? upcomingRecurring.name : 'No recurring debits due soon',
        metric: upcomingRecurring?.amount,
        caption: upcomingRecurring
          ? `${upcomingRecurring.dueLabel} · ${upcomingRecurring.dateLabel}`
          : 'You are up to date on recurring commitments.'
      },
      {
        id: 'tile-planned-expense-review',
        title: 'Review planned variable expenses',
        primaryText:
          plannedExpenseSummary.totalPending > 0
            ? `${plannedExpenseSummary.nextExpense?.name ?? 'Pending purchases'}`
            : 'All planned items reconciled',
        metric:
          plannedExpenseSummary.totalPending > 0
            ? currencyFormatter.format(plannedExpenseSummary.totalPending)
            : undefined,
        caption:
          plannedExpenseSummary.totalPending > 0
            ? plannedExpenseSummary.nextExpense
              ? `${plannedExpenseSummary.nextExpense.daysUntil <= 0 ? 'Due now' : `Next on ${plannedExpenseSummary.nextExpense.dateLabel}`}`
              : 'Review timelines to balance cash flow.'
            : 'Great job staying on top of planned spending.'
      }
    ];
  }, [upcomingRecurring, plannedExpenseSummary, currencyFormatter]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Actionable Insights</h2>
        <p className="text-sm text-slate-400">AI-powered nudges derived from your financial trends and custom categories.</p>
      </header>

      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {actionableTiles.map((tile) => (
            <ActionTile key={tile.id} title={tile.title} primaryText={tile.primaryText} metric={tile.metric} caption={tile.caption} />
          ))}
        </div>

        {insights.map((insight) => (
          <article
            key={insight.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm shadow sm:p-5"
          >
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-semibold text-slate-100">{insight.title}</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(insight.severity)}`}>
                {insight.severity.toUpperCase()}
              </span>
            </header>
            <p className="mt-3 text-slate-300">{insight.description}</p>
            {insight.metricSummary && (
              <dl className="mt-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300">
                <dt className="font-semibold text-slate-200">{insight.metricSummary.label}</dt>
                <dd className="mt-1 text-base font-semibold text-accent">{insight.metricSummary.value}</dd>
                {insight.metricSummary.helperText && (
                  <dd className="mt-1 text-[11px] text-slate-500">{insight.metricSummary.helperText}</dd>
                )}
              </dl>
            )}
            {insight.projection && (
              <div className="mt-4 grid gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Current</p>
                  <p className="mt-1 text-base font-semibold text-slate-100">
                    {formatProjectionValue(insight.projection.currentValue, insight.projection.unit, currencyFormatter, percentageFormatter)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Projected</p>
                  <p className="mt-1 text-base font-semibold text-slate-100">
                    {formatProjectionValue(insight.projection.projectedValue, insight.projection.unit, currencyFormatter, percentageFormatter)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Timeframe</p>
                  <p className="mt-1 text-base font-semibold text-slate-100">{insight.projection.timeframe}</p>
                </div>
                <p className="sm:col-span-3 text-[11px] text-slate-400">{insight.projection.description}</p>
              </div>
            )}
            {insight.recommendations && insight.recommendations.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Next best actions</p>
                <ul className="mt-2 space-y-2 text-slate-300">
                  {insight.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        ))}
        {insights.length === 0 && (
          <p className="text-sm text-slate-500">Insights will appear after analysing your transactions.</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-sm shadow">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Spending scenario planner</h3>
            <p className="mt-1 text-xs text-slate-400">
              Model a quick rule to see how discretionary tweaks change your monthly cash flow.
            </p>
          </div>
          {spendingAnalysis.monthsTracked > 0 && (
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              {spendingAnalysis.monthsTracked} month{spendingAnalysis.monthsTracked === 1 ? '' : 's'} of history analysed
            </p>
          )}
        </header>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <MetricTile
            label="Average monthly spend"
            value={currencyFormatter.format(spendingAnalysis.monthlyAverage)}
            caption="Across all expense categories"
          />
          <MetricTile
            label={`Rule impact (${ruleReduction}% cut)`}
            value={currencyFormatter.format(projectedMonthlySavings)}
            caption="Potential monthly savings"
          />
          <MetricTile
            label="Projected monthly spend"
            value={currencyFormatter.format(Math.max(projectedMonthlySpend, 0))}
            caption="After applying the rule"
          />
        </div>

        <div className="mt-6">
          <label htmlFor="rule-reduction" className="flex justify-between text-xs text-slate-300">
            <span>Reduction rule</span>
            <span className="font-semibold text-accent">{ruleReduction}% less discretionary spend</span>
          </label>
          <input
            id="rule-reduction"
            type="range"
            min={0}
            max={50}
            step={5}
            value={ruleReduction}
            onChange={(event) => setRuleReduction(Number(event.target.value))}
            className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-accent"
          />
          <p className="mt-2 text-xs text-slate-400">
            Annualised, this adds up to {currencyFormatter.format(projectedAnnualSavings)} you can redirect towards investments or
            debt payoff.
          </p>
        </div>

        <div className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top spending levers</h4>
          <ul className="mt-3 space-y-3">
            {spendingAnalysis.topCategories.map((category) => (
              <li key={category.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium text-slate-100">{category.name}</p>
                  <p className="text-xs text-slate-400">
                    {currencyFormatter.format(category.monthlyAverage)} · {percentageFormatter.format(category.share)} of monthly spend
                  </p>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(category.share * 100, 100)}%` }}
                  />
                </div>
              </li>
            ))}
            {spendingAnalysis.topCategories.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-800 bg-slate-900/20 p-4 text-xs text-slate-400">
                Start categorising expenses to uncover the biggest levers for quick savings wins.
              </li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function badgeClasses(severity: 'info' | 'warning' | 'critical') {
  switch (severity) {
    case 'warning':
      return 'bg-warning/20 text-warning';
    case 'critical':
      return 'bg-danger/20 text-danger';
    default:
      return 'bg-accent/20 text-accent';
  }
}

function formatProjectionValue(
  value: number,
  unit: 'currency' | 'percentage',
  currencyFormatter: Intl.NumberFormat,
  percentageFormatter: Intl.NumberFormat
) {
  if (unit === 'percentage') {
    return percentageFormatter.format(value / 100);
  }
  return currencyFormatter.format(value);
}

function MetricTile({
  label,
  value,
  caption
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-100">{value}</p>
      {caption && <p className="mt-1 text-xs text-slate-500">{caption}</p>}
    </div>
  );
}

function ActionTile({
  title,
  primaryText,
  metric,
  caption
}: {
  title: string;
  primaryText: string;
  metric?: string;
  caption?: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-sm shadow-sm">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {metric && <span className="text-sm font-semibold text-accent">{metric}</span>}
      </header>
      <p className="mt-2 text-base font-medium text-slate-200">{primaryText}</p>
      {caption && <p className="mt-1 text-xs text-slate-400">{caption}</p>}
    </article>
  );
}
