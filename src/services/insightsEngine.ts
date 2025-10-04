import { differenceInMonths, parseISO } from 'date-fns';
import type {
  Account,
  Category,
  Goal,
  Insight,
  PlannedExpenseItem,
  RecurringExpense,
  Transaction,
  MonthlyIncome
} from '../types';

interface InsightInput {
  accounts: Account[];
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
  plannedExpenses: PlannedExpenseItem[];
  goals: Goal[];
  categories: Category[];
  monthlyIncomes: MonthlyIncome[];
}

export function generateInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const now = new Date().toISOString();

  const totalIncomeFromTransactions = input.transactions
    .filter((txn) => txn.amount > 0)
    .reduce((sum, txn) => sum + txn.amount, 0);
  const recurringIncome = input.monthlyIncomes.reduce((sum, income) => sum + income.amount, 0);
  const totalIncome = totalIncomeFromTransactions + recurringIncome;
  const totalExpenses = input.transactions
    .filter((txn) => txn.amount < 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

  if (totalIncome > 0) {
    const savingsRate = ((totalIncome - totalExpenses) / totalIncome) * 100;
    insights.push({
      id: 'insight-savings-rate',
      title: 'Savings Rate Check',
      description: `Your savings rate is ${savingsRate.toFixed(1)}%. Consider targeting 40%+ to accelerate investments.`,
      severity: savingsRate < 30 ? 'warning' : 'info',
      createdAt: now,
      updatedAt: now
    });
  }

  const nextRecurring = input.recurringExpenses
    .map((expense) => ({
      ...expense,
      dueIn: differenceInMonths(parseISO(expense.nextDueDate ?? expense.dueDate), new Date())
    }))
    .sort((a, b) => a.dueIn - b.dueIn)[0];

  if (nextRecurring) {
    insights.push({
      id: 'insight-next-recurring',
      title: 'Upcoming recurring payment',
      description: `${nextRecurring.name} is due soon at ₹${nextRecurring.amount.toLocaleString('en-IN')}. Ensure the budget is allocated.`,
      severity: 'info',
      createdAt: now,
      updatedAt: now
    });
  }

  const plannedOverBudget = input.plannedExpenses.filter((expense) => expense.status === 'pending');
  if (plannedOverBudget.length > 0) {
    const totalPlanned = plannedOverBudget.reduce((sum, item) => sum + item.plannedAmount, 0);
    insights.push({
      id: 'insight-planned-spend',
      title: 'Review planned variable expenses',
      description: `You have ₹${totalPlanned.toLocaleString('en-IN')} of planned spends. Consider staggering purchases to reduce cash flow stress.`,
      severity: 'warning',
      createdAt: now,
      updatedAt: now
    });
  }

  const liabilities = input.accounts.filter((acct) => acct.type === 'loan').reduce((sum, account) => sum + account.balance, 0);
  const assets = input.accounts
    .filter((acct) => acct.type === 'bank' || acct.type === 'investment' || acct.type === 'cash')
    .reduce((sum, account) => sum + account.balance, 0);
  if (liabilities > assets * 0.5) {
    insights.push({
      id: 'insight-liability-check',
      title: 'High leverage detected',
      description: 'Loan balances are more than 50% of liquid assets. Consider accelerating repayments.',
      severity: 'critical',
      createdAt: now,
      updatedAt: now
    });
  }

  const customExpenseCategories = input.categories.filter((cat) => cat.type === 'expense' && cat.isCustom);
  if (customExpenseCategories.length > 0) {
    insights.push({
      id: 'insight-custom-expense',
      title: 'Custom expense categories in use',
      description: `You are tracking ${customExpenseCategories.length} custom expense categories. Continue refining to improve AI recommendations.`,
      severity: 'info',
      createdAt: now,
      updatedAt: now
    });
  }

  const uncoveredIncome = input.monthlyIncomes.filter((income) => !income.categoryId);
  if (uncoveredIncome.length > 0) {
    insights.push({
      id: 'insight-income-categorisation',
      title: 'Categorise income streams',
      description: `${uncoveredIncome.length} income entries are uncategorised. Tag them to align tax planning and savings goals.`,
      severity: 'warning',
      createdAt: now,
      updatedAt: now
    });
  }

  return insights;
}
