import type { Account, Goal, MonthlyIncome, RecurringExpense, Transaction, WealthAcceleratorMetrics } from '../types';
import { differenceInMonths, parseISO } from 'date-fns';

export function simulateWealthAccelerator(
  accounts: Account[],
  transactions: Transaction[],
  goals: Goal[],
  recurringExpenses: RecurringExpense[],
  monthlyIncomes: MonthlyIncome[]
): WealthAcceleratorMetrics {
  const now = new Date().toISOString();
  const investableAssets = accounts
    .filter((acct) => acct.type === 'investment' || acct.type === 'bank')
    .reduce((sum, acct) => sum + acct.balance, 0);
  const liabilities = accounts.filter((acct) => acct.type === 'loan').reduce((sum, acct) => sum + acct.balance, 0);

  const transactionIncome = transactions
    .filter((txn) => txn.amount > 0)
    .reduce((sum, txn) => sum + txn.amount, 0);
  const recurringIncome = monthlyIncomes.reduce((sum, income) => sum + income.amount, 0);
  const totalIncome = transactionIncome + recurringIncome;
  const totalExpenses = transactions.filter((txn) => txn.amount < 0).reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
  const monthlySavings = totalIncome - totalExpenses;

  const cashFlowHealth = Math.max(0, Math.min(100, (monthlySavings / Math.max(1, liabilities)) * 100));
  const capitalEfficiencyScore = Math.round(
    0.5 * (investableAssets / Math.max(1, liabilities + investableAssets)) * 100 + 0.5 * cashFlowHealth
  );

  const upcomingRecurring = recurringExpenses
    .map((expense) => differenceInMonths(parseISO(expense.nextDueDate ?? expense.dueDate), new Date()))
    .filter((diff) => diff >= 0)
    .sort((a, b) => a - b)[0];

  const opportunityCostAlerts: string[] = [];
  if (investableAssets < liabilities) {
    opportunityCostAlerts.push('Increase allocation towards debt repayment to unlock future cash flow.');
  }
  if (monthlySavings < 0) {
    opportunityCostAlerts.push('Negative monthly savings detected. Consider reducing discretionary categories.');
  }
  if (upcomingRecurring !== undefined && upcomingRecurring < 1) {
    opportunityCostAlerts.push('Upcoming EMI due within a month. Prioritize liquidity to avoid penalties.');
  }

  const insuranceGapAnalysis = goals
    .map((goal) => {
      const monthsToGoal = Math.max(1, differenceInMonths(parseISO(goal.targetDate), new Date()));
      const requiredMonthly = (goal.targetAmount - goal.currentAmount) / monthsToGoal;
      if (requiredMonthly > monthlySavings) {
        return `Goal "${goal.name}" requires ₹${requiredMonthly.toFixed(
          0
        )}/month which exceeds your current savings rate.`;
      }
      return `Goal "${goal.name}" is on track.`;
    })
    .join(' ');

  return {
    capitalEfficiencyScore: Math.min(100, Math.max(0, capitalEfficiencyScore)),
    opportunityCostAlerts,
    insuranceGapAnalysis,
    updatedAt: now
  };
}
