import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

interface MonthlySummary {
  key: string;
  label: string;
  year: string;
  income: number;
  expenses: number;
  net: number;
}

export function TrendAnalysisView() {
  const { transactions, categories, monthlyIncomes } = useFinancialStore();

  const monthlySummaries = useMemo(() => {
    const map = new Map<string, MonthlySummary>();
    const ensureSummary = (date: Date) => {
      const key = format(date, 'yyyy-MM');
      const summary = map.get(key);
      if (summary) return summary;
      const nextSummary: MonthlySummary = {
        key,
        label: format(date, 'MMM yyyy'),
        year: format(date, 'yyyy'),
        income: 0,
        expenses: 0,
        net: 0
      };
      map.set(key, nextSummary);
      return nextSummary;
    };

    transactions.forEach((txn) => {
      const date = parseISO(txn.date);
      const summary = ensureSummary(date);
      if (txn.amount > 0) {
        summary.income += txn.amount;
        summary.net += txn.amount;
      } else {
        summary.expenses += Math.abs(txn.amount);
        summary.net += txn.amount;
      }
    });

    monthlyIncomes.forEach((income) => {
      const date = parseISO(income.receivedOn);
      const summary = ensureSummary(date);
      summary.income += income.amount;
      summary.net += income.amount;
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([, value]) => value);
  }, [transactions, monthlyIncomes]);

  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedYear, setSelectedYear] = useState<string>('all');

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    monthlySummaries.forEach((summary) => years.add(summary.year));
    return Array.from(years).sort();
  }, [monthlySummaries]);

  useEffect(() => {
    if (selectedYear !== 'all' && !availableYears.includes(selectedYear)) {
      setSelectedYear('all');
    }
  }, [availableYears, selectedYear]);

  const filteredMonthlySummaries = useMemo(
    () => (selectedYear === 'all' ? monthlySummaries : monthlySummaries.filter((summary) => summary.year === selectedYear)),
    [monthlySummaries, selectedYear]
  );

  const yearlySummaries = useMemo(() => {
    const map = new Map<string, { year: string; income: number; expenses: number; net: number }>();
    monthlySummaries.forEach((summary) => {
      const entry = map.get(summary.year) ?? { year: summary.year, income: 0, expenses: 0, net: 0 };
      entry.income += summary.income;
      entry.expenses += summary.expenses;
      entry.net += summary.net;
      map.set(summary.year, entry);
    });
    return Array.from(map.values()).sort((a, b) => (a.year > b.year ? 1 : -1));
  }, [monthlySummaries]);

  const incomeSeries = viewMode === 'monthly'
    ? filteredMonthlySummaries.map((item, index) => ({ x: index, y: item.income }))
    : yearlySummaries.map((item, index) => ({ x: index, y: item.income }));

  const expenseSeries = viewMode === 'monthly'
    ? filteredMonthlySummaries.map((item, index) => ({ x: index, y: item.expenses }))
    : yearlySummaries.map((item, index) => ({ x: index, y: item.expenses }));

  const axisLabels = viewMode === 'monthly'
    ? filteredMonthlySummaries.map((item) => item.label)
    : yearlySummaries.map((item) => item.year);

  const monthlyPeak = filteredMonthlySummaries.reduce(
    (max, item) => Math.max(max, item.income, item.expenses),
    0
  );
  const yearlyPeak = yearlySummaries.reduce(
    (max, item) => Math.max(max, item.income, item.expenses),
    0
  );
  const maxValue = viewMode === 'monthly' ? Math.max(monthlyPeak, 1) : Math.max(yearlyPeak, 1);

  const customCategoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    transactions.forEach((txn) => {
      const category = categories.find((cat) => cat.id === txn.categoryId);
      if (category && category.isCustom) {
        totals.set(category.name, (totals.get(category.name) ?? 0) + Math.abs(txn.amount));
      }
    });
    return Array.from(totals.entries()).map(([name, total]) => ({ name, total }));
  }, [transactions, categories]);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Trend Analysis</h2>
        <p className="text-sm text-slate-400">Track monthly cash flow trends, compare spends, and analyse custom categories.</p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold">Cash Flow Trends</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setViewMode('monthly')}
                className={`rounded-md px-3 py-1 font-semibold ${
                  viewMode === 'monthly' ? 'bg-accent text-slate-900' : 'text-slate-300'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setViewMode('yearly')}
                className={`rounded-md px-3 py-1 font-semibold ${
                  viewMode === 'yearly' ? 'bg-accent text-slate-900' : 'text-slate-300'
                }`}
              >
                Yearly
              </button>
            </div>
            {viewMode === 'monthly' && availableYears.length > 1 && (
              <select
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                value={selectedYear}
                onChange={(event) => setSelectedYear(event.target.value)}
              >
                <option value="all">All years</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <svg viewBox="0 0 600 240" className="mt-4 w-full text-slate-400">
          <Grid />
          <LineSeries data={incomeSeries} color="#38bdf8" />
          <LineSeries data={expenseSeries} color="#ef4444" />
          <Axis labels={axisLabels} max={maxValue} />
        </svg>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
          <Legend color="#38bdf8" label="Income" />
          <Legend color="#ef4444" label="Expenses" />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <h3 className="text-lg font-semibold">Custom Category Spotlight</h3>
        <div className="mt-4 space-y-3 text-sm">
          {customCategoryTotals.map((item) => (
            <div
              key={item.name}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
            >
              <span>{item.name}</span>
              <span className="font-semibold text-accent">{formatCurrency(item.total)}</span>
            </div>
          ))}
          {customCategoryTotals.length === 0 && <p className="text-slate-500">No custom categories recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Grid() {
  const lines = Array.from({ length: 5 });
  return (
    <g>
      {lines.map((_, idx) => (
        <line key={idx} x1={0} x2={600} y1={40 * idx + 40} y2={40 * idx + 40} stroke="rgba(148, 163, 184, 0.1)" />
      ))}
    </g>
  );
}

function LineSeries({ data, color }: { data: { x: number; y: number }[]; color: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((point) => point.y), 1);
  const path = data
    .map((point, index) => {
      const x = (index / Math.max(1, data.length - 1)) * 560 + 20;
      const y = 200 - (point.y / max) * 160;
      return `${index === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  return <path d={path} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />;
}

function Axis({ labels, max }: { labels: string[]; max: number }) {
  const ticks = labels.map((label, index) => ({
    label,
    x: (index / Math.max(1, labels.length - 1)) * 560 + 20
  }));
  return (
    <g className="text-xs">
      {ticks.map((tick) => (
        <text key={tick.label} x={tick.x} y={220} textAnchor="middle">
          {tick.label}
        </text>
      ))}
      <text x={10} y={30} textAnchor="start" fill="#64748b">
        Peak: {formatCurrency(max)}
      </text>
    </g>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
