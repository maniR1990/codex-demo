import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

interface MonthlySummary {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export function TrendAnalysisView() {
  const { transactions, categories } = useFinancialStore();

  const monthlySummaries = useMemo(() => {
    const map = new Map<string, MonthlySummary>();
    transactions.forEach((txn) => {
      const date = parseISO(txn.date);
      const key = format(date, 'yyyy-MM');
      const summary = map.get(key) ?? { month: format(date, 'MMM yyyy'), income: 0, expenses: 0, net: 0 };
      if (txn.amount > 0) {
        summary.income += txn.amount;
        summary.net += txn.amount;
      } else {
        summary.expenses += Math.abs(txn.amount);
        summary.net += txn.amount;
      }
      map.set(key, summary);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([, value]) => value);
  }, [transactions]);

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
        <h3 className="text-lg font-semibold">Monthly Cash Flow</h3>
        <svg viewBox="0 0 600 240" className="mt-4 w-full text-slate-400">
          <Grid />
          <LineSeries data={monthlySummaries.map((item, index) => ({ x: index, y: item.income }))} color="#38bdf8" />
          <LineSeries data={monthlySummaries.map((item, index) => ({ x: index, y: item.expenses }))} color="#ef4444" />
          <Axis labels={monthlySummaries.map((item) => item.month)} max={Math.max(...monthlySummaries.map((item) => Math.max(item.income, item.expenses)), 1)} />
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
