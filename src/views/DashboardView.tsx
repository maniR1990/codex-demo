import { useEffect, useMemo, useState } from 'react';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import { format } from 'date-fns';
import { DataControlPanel } from '../components/DataControlPanel';
import type { Account, Currency, Transaction } from '../types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function DashboardView() {
  const {
    accounts,
    transactions,
    categories,
    wealthMetrics,
    monthlyIncomes,
    profile,
    addManualTransaction
  } = useFinancialStore();

  const netWorth = useMemo(() => {
    const assets = accounts
      .filter(
        (account) => account.type === 'bank' || account.type === 'investment' || account.type === 'cash'
      )
      .reduce((sum, account) => sum + account.balance, 0);
    const liabilities = accounts
      .filter((account) => account.type === 'loan' || account.type === 'credit-card')
      .reduce((sum, account) => sum + account.balance, 0);
    return assets - liabilities;
  }, [accounts]);

  const savingsAccounts = useMemo(
    () => accounts.filter((account) => account.type === 'bank' || account.type === 'investment' || account.type === 'cash'),
    [accounts]
  );

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
        <SavingsGauge
          savingsRate={savingsRate}
          income={monthlyIncome}
          expenses={monthlyExpenses}
          assetAccounts={savingsAccounts}
          profileCurrency={profile?.currency ?? 'INR'}
          onRecordSavings={addManualTransaction}
        />
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

type ManualTransactionInput = Omit<
  Transaction,
  'id' | 'createdAt' | 'updatedAt' | 'isRecurringMatch' | 'isPlannedMatch'
>;

interface SavingsGaugeProps {
  savingsRate: number;
  income: number;
  expenses: number;
  assetAccounts: Account[];
  profileCurrency: Currency;
  onRecordSavings: (payload: ManualTransactionInput) => Promise<Transaction>;
}

function SavingsGauge({
  savingsRate,
  income,
  expenses,
  assetAccounts,
  profileCurrency,
  onRecordSavings
}: SavingsGaugeProps) {
  const clampedRate = Math.max(0, Math.min(150, savingsRate));
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.min(100, Math.max(0, clampedRate)) / 100) * circumference;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({
    label: '',
    amount: '',
    accountId: assetAccounts[0]?.id ?? '',
    date: todayInputValue(),
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    if (!assetAccounts.length) {
      setForm((prev) => ({ ...prev, accountId: '' }));
      return;
    }
    if (!assetAccounts.find((account) => account.id === form.accountId)) {
      setForm((prev) => ({ ...prev, accountId: assetAccounts[0]?.id ?? '' }));
    }
  }, [assetAccounts, form.accountId]);

  useEffect(() => {
    if (!showSaved) {
      return;
    }
    const timeout = window.setTimeout(() => setShowSaved(false), 2800);
    return () => window.clearTimeout(timeout);
  }, [showSaved]);

  const resetForm = () => {
    setForm({
      label: '',
      amount: '',
      accountId: assetAccounts[0]?.id ?? '',
      date: todayInputValue(),
      notes: ''
    });
    setError(null);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);

    const amountValue = Number.parseFloat(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    if (!form.accountId) {
      setError('Choose an account to park the savings.');
      return;
    }

    const selectedAccount = assetAccounts.find((account) => account.id === form.accountId);
    const currency = selectedAccount?.currency ?? profileCurrency;
    const isoDate = new Date(`${form.date}T00:00:00`).toISOString();

    setIsSaving(true);
    try {
      await onRecordSavings({
        accountId: form.accountId,
        amount: Math.abs(amountValue),
        currency,
        date: isoDate,
        description: form.label.trim() ? form.label.trim() : 'Savings deposit',
        notes: form.notes.trim() ? form.notes.trim() : undefined
      });
      setShowSaved(true);
      resetForm();
      setIsDialogOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to record savings right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const savingsDisabled = assetAccounts.length === 0;

  return (
    <div className="relative rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold">Savings & Investment Rate</h2>
      <p className="mt-1 text-sm text-slate-400">How efficiently is capital being deployed?</p>
      <div className="mt-6 flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <div className="relative h-32 w-32">
          <svg viewBox="0 0 36 36" className="h-full w-full">
            <circle cx="18" cy="18" r={radius} fill="none" stroke="#1e293b" strokeWidth="3" />
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
            <text x="18" y="20.35" className="fill-slate-100 text-base font-semibold" textAnchor="middle">
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

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => {
            if (savingsDisabled) {
              setError('Add a bank, cash, or investment account first to start tracking savings.');
              setIsDialogOpen(true);
              return;
            }
            setError(null);
            setIsDialogOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:bg-emerald-800/60 disabled:text-emerald-200/70"
          disabled={savingsDisabled}
        >
          Record savings entry
        </button>
        {showSaved ? (
          <span className="text-xs font-medium text-emerald-300">Savings recorded and balances updated.</span>
        ) : null}
        {error && !isDialogOpen ? (
          <span className="text-xs text-danger">{error}</span>
        ) : null}
        {savingsDisabled ? (
          <span className="text-xs text-slate-500">
            Add an asset-linked account to include savings in your net worth.
          </span>
        ) : null}
      </div>

      {isDialogOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-emerald-300">Record a savings transfer</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Move surplus income into your asset accounts so the balance reflects in Total Net Worth.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDialogOpen(false);
                  setError(null);
                  resetForm();
                }}
                className="rounded-full border border-transparent p-1 text-slate-400 transition hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="savings-label">
                  Savings label
                </label>
                <input
                  id="savings-label"
                  type="text"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  placeholder="e.g. Emergency fund top-up"
                  value={form.label}
                  onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-200" htmlFor="savings-amount">
                    Amount
                  </label>
                  <input
                    id="savings-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    placeholder="50000"
                    value={form.amount}
                    onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200" htmlFor="savings-date">
                    Transfer date
                  </label>
                  <input
                    id="savings-date"
                    type="date"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                    value={form.date}
                    max={todayInputValue()}
                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="savings-account">
                  Destination account
                </label>
                <select
                  id="savings-account"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  value={form.accountId}
                  onChange={(event) => setForm((prev) => ({ ...prev, accountId: event.target.value }))}
                  required
                >
                  <option value="" disabled>
                    Select an account
                  </option>
                  {assetAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200" htmlFor="savings-notes">
                  Notes (optional)
                </label>
                <textarea
                  id="savings-notes"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  rows={3}
                  placeholder="Any context for this transfer"
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>

              {error ? <p className="text-sm text-danger">{error}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setError(null);
                    resetForm();
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 disabled:cursor-not-allowed disabled:bg-emerald-700/60 disabled:text-emerald-200"
                >
                  {isSaving ? 'Recording…' : 'Record savings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
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
