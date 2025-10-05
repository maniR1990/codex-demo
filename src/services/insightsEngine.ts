import { differenceInMonths, parseISO } from 'date-fns';
import type {
  Account,
  BudgetMonth,
  Category,
  Goal,
  Insight,
  RecurringExpense,
  Transaction,
  MonthlyIncome,
  Profile
} from '../types';

interface InsightInput {
  accounts: Account[];
  transactions: Transaction[];
  recurringExpenses: RecurringExpense[];
  budgetMonths: BudgetMonth[];
  goals: Goal[];
  categories: Category[];
  monthlyIncomes: MonthlyIncome[];
  currency?: Profile['currency'];
}

export function generateInsights(input: InsightInput): Insight[] {
  const insights: Insight[] = [];
  const now = new Date().toISOString();
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: input.currency ?? 'INR',
    maximumFractionDigits: 0
  });

  const percentageFormatter = new Intl.NumberFormat('en-IN', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  const totalIncomeFromTransactions = input.transactions
    .filter((txn) => txn.amount > 0)
    .reduce((sum, txn) => sum + txn.amount, 0);
  const recurringIncome = input.monthlyIncomes.reduce((sum, income) => sum + income.amount, 0);
  const totalIncome = totalIncomeFromTransactions + recurringIncome;
  const totalExpenses = input.transactions
    .filter((txn) => txn.amount < 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

  if (totalIncome > 0) {
    const savingsRate = (totalIncome - totalExpenses) / totalIncome;
    const formattedSavingsRate = percentageFormatter.format(savingsRate);
    const targetSavingsRate = 0.4;
    const desiredMonthlySavings = targetSavingsRate * totalIncome;
    const currentMonthlySavings = totalIncome - totalExpenses;
    const additionalSavingsNeeded = Math.max(desiredMonthlySavings - currentMonthlySavings, 0);
    insights.push({
      id: 'insight-savings-rate',
      title: 'Savings Rate Check',
      description: `Your savings rate is ${formattedSavingsRate}. Consider targeting 40%+ to accelerate investments.`,
      severity: savingsRate < 0.3 ? 'warning' : 'info',
      createdAt: now,
      updatedAt: now,
      metricSummary: {
        label: 'Current monthly savings',
        value: currencyFormatter.format(currentMonthlySavings),
        helperText: `Based on ${currencyFormatter.format(totalExpenses)} in monthly expenses.`
      },
      recommendations: [
        'Automate a monthly transfer into your investment account for the target savings amount.',
        'Audit the top three discretionary categories to find quick 5-10% reductions.'
      ],
      projection:
        additionalSavingsNeeded > 0
          ? {
              title: 'Path to 40% savings rate',
              description: 'Reducing discretionary spends unlocks additional investable surplus each month.',
              currentValue: currentMonthlySavings,
              projectedValue: desiredMonthlySavings,
              timeframe: 'Next 30 days',
              unit: 'currency'
            }
          : undefined
    });
  }

  const nextRecurring = input.recurringExpenses
    .map((expense) => {
      const referenceDate = expense.nextDueDate ?? expense.dueDate ?? expense.createdAt;
      return {
        ...expense,
        dueIn: differenceInMonths(parseISO(referenceDate), new Date())
      };
    })
    .sort((a, b) => a.dueIn - b.dueIn)[0];

  if (nextRecurring) {
    insights.push({
      id: 'insight-next-recurring',
      title: 'Upcoming recurring payment',
      description: `${nextRecurring.name} is due soon at ${currencyFormatter.format(nextRecurring.amount)}. Ensure the budget is allocated.`,
      severity: 'info',
      createdAt: now,
      updatedAt: now,
      recommendations: [
        'Enable autopay or calendar reminders to avoid last-minute cash crunches.',
        'Park the amount in a high-yield savings bucket until the debit date.'
      ]
    });
  }

  const totalPlanned = input.budgetMonths.reduce((sum, month) => sum + (month.totals?.planned ?? 0), 0);
  const totalActual = input.budgetMonths.reduce((sum, month) => sum + (month.totals?.actual ?? 0), 0);
  const totalUnassigned = input.budgetMonths.reduce(
    (sum, month) => sum + month.unassignedActuals.reduce((acc, item) => acc + (item.amount ?? 0), 0),
    0
  );
  const rolloverCarry = input.budgetMonths.reduce(
    (sum, month) => sum + (month.totals?.rolloverToNext ?? 0),
    0
  );
  const adjustmentMagnitude = input.budgetMonths.reduce(
    (sum, month) =>
      sum + month.adjustments.reduce((adjSum, adjustment) => adjSum + Math.abs(adjustment.amount ?? 0), 0),
    0
  );

  if (totalPlanned > totalActual) {
    insights.push({
      id: 'insight-planned-spend',
      title: 'Review planned variable expenses',
      description: `You have ${currencyFormatter.format(totalPlanned - totalActual)} in planned spend yet to be matched. Unassigned spend totals ${currencyFormatter.format(totalUnassigned)} with ${currencyFormatter.format(rolloverCarry)} earmarked as rollovers.`,
      severity: 'warning',
      createdAt: now,
      updatedAt: now,
      recommendations: [
        'Tag each planned item as essential or deferrable to make trade-offs explicit.',
        'Convert large purchases into short-term sinking funds before committing.',
        `Review ${currencyFormatter.format(adjustmentMagnitude)} of manual adjustments to confirm they still reflect intent.`
      ]
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
      updatedAt: now,
      recommendations: [
        'Channel every bonus or windfall toward the smallest balance first (debt snowball).',
        'Assess refinancing offers to cut your blended interest rate by 1-2%.',
        'Pause new discretionary EMI commitments until leverage drops below 35%.'
      ]
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
      updatedAt: now,
      recommendations: [
        'Add budgeting targets for each custom bucket to unlock hyper-personal nudges.',
        'Map custom categories to long-term goals so progress can be measured monthly.'
      ]
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
      updatedAt: now,
      recommendations: [
        'Link each inflow to a goal (Emergency fund, SIP, debt payoff) to auto-allocate surplus.',
        'Set a recurring rule to auto-tag salary, reimbursements, and side hustles.'
      ]
    });
  }

  return insights;
}
