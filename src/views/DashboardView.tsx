import { useMemo } from 'react';
import { DataControlPanel } from '../components/DataControlPanel';
import { MetricHighlight } from '../components/molecules/MetricHighlight';
import { RecentTransactionsTable } from '../components/organisms/RecentTransactionsTable';
import { SavingsGauge } from '../components/organisms/SavingsGauge';
import { TopSpendingCategories } from '../components/organisms/TopSpendingCategories';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import type { Account, Currency, Transaction } from '../types';

function formatCurrency(value: number, currency: Currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

type ManualTransactionInput = Omit<
  Transaction,
  'id' | 'createdAt' | 'updatedAt' | 'isRecurringMatch' | 'isPlannedMatch'
>;

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

  const netWorth = useMemo(() => calculateNetWorth(accounts), [accounts]);
  const savingsAccounts = useMemo(() => selectSavingsAccounts(accounts), [accounts]);

  const { monthlyIncome, monthlyExpenses } = useMemo(
    () => deriveMonthlyFlow(transactions, monthlyIncomes),
    [transactions, monthlyIncomes]
  );

  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

  const topSpending = useMemo(() => computeTopSpending(transactions, categories), [transactions, categories]);

  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [transactions]
  );

  const resolveCategoryName = (categoryId: string | undefined) =>
    categories.find((cat) => cat.id === categoryId)?.name ?? 'Uncategorised';

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricHighlight
          title="Total Net Worth"
          value={formatCurrency(netWorth, profile?.currency ?? 'INR')}
          subtitle="Assets - Liabilities"
        />
        <MetricHighlight
          title="Monthly Income"
          value={formatCurrency(monthlyIncome, profile?.currency ?? 'INR')}
          subtitle="Cash inflows"
        />
        <MetricHighlight
          title="Monthly Expenses"
          value={formatCurrency(monthlyExpenses, profile?.currency ?? 'INR')}
          subtitle="Cash outflows"
        />
        <MetricHighlight
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
          onRecordSavings={(payload: ManualTransactionInput) => addManualTransaction(payload)}
        />
        <TopSpendingCategories items={topSpending} currency={profile?.currency ?? 'INR'} />
      </section>

      <DataControlPanel />

      <RecentTransactionsTable
        transactions={recentTransactions}
        resolveCategoryName={resolveCategoryName}
        formatCurrency={(value) => formatCurrency(value, profile?.currency ?? 'INR')}
      />
    </div>
  );
}

function calculateNetWorth(accounts: Account[]) {
  const assets = accounts
    .filter((account) => account.type === 'bank' || account.type === 'investment' || account.type === 'cash')
    .reduce((sum, account) => sum + account.balance, 0);
  const liabilities = accounts
    .filter((account) => account.type === 'loan' || account.type === 'credit-card')
    .reduce((sum, account) => sum + account.balance, 0);
  return assets - liabilities;
}

function selectSavingsAccounts(accounts: Account[]) {
  return accounts.filter((account) => account.type === 'bank' || account.type === 'investment' || account.type === 'cash');
}

function deriveMonthlyFlow(transactions: Transaction[], monthlyIncomes: Array<{ amount: number }>) {
  const incomeFromTransactions = transactions.filter((txn) => txn.amount > 0).reduce((sum, txn) => sum + txn.amount, 0);
  const recurringIncome = monthlyIncomes.reduce((sum, income) => sum + income.amount, 0);
  const expenses = transactions.filter((txn) => txn.amount < 0).reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
  return { monthlyIncome: incomeFromTransactions + recurringIncome, monthlyExpenses: expenses };
}

function computeTopSpending(transactions: Transaction[], categories: Array<{ id: string; name: string }>) {
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
}
