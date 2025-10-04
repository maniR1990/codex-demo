import { useMemo } from 'react';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import { format } from 'date-fns';
import { DataControlPanel } from '../components/DataControlPanel';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function DashboardView() {
  const { accounts, transactions, categories, wealthMetrics, monthlyIncomes } = useFinancialStore();

  const netWorth = useMemo(() => {
    const assets = accounts
      .filter((account) => account.type === 'bank' || account.type === 'investment' || account.type === 'cash')
      .reduce((sum, account) => sum + account.balance, 0);
    const liabilities = accounts
      .filter((account) => account.type === 'loan' || account.type === 'credit-card')
      .reduce((sum, account) => sum + account.balance, 0);
    return assets - liabilities;
  }, [accounts]);

  const { monthlyIncome, monthlyExpenses } = useMemo(() => {
    const incomeFromTransactions = transactions
      .filter((txn) => txn.amount > 0)
      .reduce((sum, txn) => sum + txn.amount, 0);
    const recurringIncome = monthlyIncomes.reduce((sum, income) => sum + income.amount, 0);
    const expenses = transactions.filter((txn) => txn.amount < 0).reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
    return { monthlyIncome: incomeFromTransactions + recurringIncome, monthlyExpenses: expenses };
  }, [transactions, monthlyIncomes]);

  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

  const topSpending = useMemo(() => {
    const expenseByCategory = new Map<string, number>();
    transactions
      .filter((txn) => txn.amount < 0)
      .forEach((txn) => {
        const category = txn.categoryId ?? 'uncategorised';
        expenseByCategory.set(category, (expenseByCategory.get(category) ?? 0) + Math.abs(txn.amount));
      });
    return Array.from(expenseByCategory.entries())
      .map(([categoryId, total]) => ({
        category: categories.find((cat) => cat.id === categoryId)?.name ?? 'Uncategorised',
        total
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [transactions, categories]);

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [transactions]
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Net Worth" value={formatCurrency(netWorth)} subtitle="Assets - Liabilities" />
        <MetricCard title="Monthly Income" value={formatCurrency(monthlyIncome)} subtitle="Cash inflows" />
        <MetricCard title="Monthly Expenses" value={formatCurrency(monthlyExpenses)} subtitle="Cash outflows" />
        <MetricCard
          title="Capital Efficiency"
          value={`${wealthMetrics.capitalEfficiencyScore}%`}
          subtitle="Wealth Accelerator score"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <SavingsGauge savingsRate={savingsRate} income={monthlyIncome} expenses={monthlyExpenses} />
        <TopSpendingCategories items={topSpending} />
      </section>

      <DataControlPanel />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent Transactions</h2>
        <div className="rounded-2xl border border-slate-800">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recentTransactions.map((txn) => {
                const category = categories.find((cat) => cat.id === txn.categoryId)?.name ?? 'Uncategorised';
                return (
                  <tr key={txn.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">{format(new Date(txn.date), 'd MMM')}</td>
                    <td className="px-4 py-3">{txn.description}</td>
                    <td className="px-4 py-3">{category}</td>
                    <td className={`px-4 py-3 text-right ${txn.amount < 0 ? 'text-danger' : 'text-success'}`}>
                      {formatCurrency(txn.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function SavingsGauge({ savingsRate, income, expenses }: { savingsRate: number; income: number; expenses: number }) {
  const clampedRate = Math.max(0, Math.min(150, savingsRate));
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.min(100, Math.max(0, clampedRate)) / 100) * circumference;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold">Savings & Investment Rate</h2>
      <p className="mt-1 text-sm text-slate-400">How efficiently is capital being deployed?</p>
      <div className="mt-6 flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 36 36" className="h-full w-full">
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke="#1e293b"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="3"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 18 18)"
            />
            <text x="18" y="20.35" className="fill-slate-100 text-lg" textAnchor="middle">
              {savingsRate.toFixed(1)}%
            </text>
          </svg>
        </div>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-slate-400">Income:</span> {formatCurrency(income)}
          </p>
          <p>
            <span className="text-slate-400">Expenses:</span> {formatCurrency(expenses)}
          </p>
          <p>
            <span className="text-slate-400">Savings:</span> {formatCurrency(income - expenses)}
          </p>
          <p className="text-xs text-slate-500">Target ≥ 40% for aggressive wealth creation.</p>
        </div>
      </div>
    </div>
  );
}

function TopSpendingCategories({
  items
}: {
  items: { category: string; total: number }[];
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold">Top Spending Categories</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {items.map((item) => (
          <li key={item.category} className="flex items-center justify-between">
            <span>{item.category}</span>
            <span className="font-semibold text-danger">{formatCurrency(item.total)}</span>
          </li>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">No expenses recorded yet.</p>}
      </ul>
    </div>
  );
}
