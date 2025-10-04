import { createEventBus, generateId, monthKey, sum, calculateNetWorth, average } from './utils.js';
import { loadSnapshot, persistSnapshot, exportSnapshot, importSnapshot } from './indexeddb.js';

const PASS_PHRASE = 'wealth-offline-key';

const defaultCategories = [
  { id: 'salary', name: 'Salary', type: 'income', isCustom: false },
  { id: 'business', name: 'Business Income', type: 'income', isCustom: false },
  { id: 'dividend', name: 'Dividends', type: 'income', isCustom: false },
  { id: 'groceries', name: 'Groceries', type: 'expense', isCustom: false },
  { id: 'housing', name: 'Housing & Utilities', type: 'expense', isCustom: false },
  { id: 'transport', name: 'Transport', type: 'expense', isCustom: false },
  { id: 'entertainment', name: 'Entertainment', type: 'expense', isCustom: false },
  { id: 'insurance', name: 'Insurance Premiums', type: 'expense', isCustom: false },
  { id: 'education', name: 'Education', type: 'expense', isCustom: false }
];

const sampleAccounts = [
  {
    id: generateId('acct'),
    name: 'Kotak Savings',
    institution: 'Kotak Mahindra Bank',
    type: 'bank',
    balance: 845000
  },
  {
    id: generateId('acct'),
    name: 'NPS Tier I',
    institution: 'PFRDA',
    type: 'investment',
    balance: 1260000
  },
  {
    id: generateId('acct'),
    name: 'Home Loan',
    institution: 'HDFC Bank',
    type: 'loan',
    balance: 3250000
  }
];

const sampleTransactions = [
  {
    id: generateId('txn'),
    accountId: sampleAccounts[0].id,
    description: 'Monthly Salary',
    amount: 240000,
    date: new Date().toISOString(),
    categoryId: 'salary'
  },
  {
    id: generateId('txn'),
    accountId: sampleAccounts[0].id,
    description: 'Rent',
    amount: -65000,
    date: new Date().toISOString(),
    categoryId: 'housing'
  },
  {
    id: generateId('txn'),
    accountId: sampleAccounts[0].id,
    description: 'Fresh Produce Market',
    amount: -12500,
    date: new Date().toISOString(),
    categoryId: 'groceries'
  }
];

const samplePlannedExpenses = [
  {
    id: generateId('plan'),
    name: 'Quarterly Insurance',
    amount: 18000,
    categoryId: 'insurance',
    plannedFor: monthKey(new Date()),
    status: 'pending',
    notes: 'Includes top-up health cover'
  },
  {
    id: generateId('plan'),
    name: 'School Fee',
    amount: 60000,
    categoryId: 'education',
    plannedFor: monthKey(new Date()),
    status: 'pending'
  }
];

const sampleRecurringExpenses = [
  {
    id: generateId('rec'),
    name: 'Home Loan EMI',
    amount: 86543,
    categoryId: 'housing',
    frequency: 'monthly',
    nextDueDate: new Date().toISOString(),
    notes: 'Auto-debit on 5th',
    isCustomCategory: false
  },
  {
    id: generateId('rec'),
    name: 'Jio Fiber',
    amount: 1499,
    categoryId: 'transport',
    frequency: 'monthly',
    nextDueDate: new Date().toISOString(),
    notes: 'Broadband + OTT',
    isCustomCategory: false
  }
];

const sampleGoals = [
  {
    id: generateId('goal'),
    name: 'Retirement corpus',
    targetAmount: 50000000,
    timeframeMonths: 180,
    categoryId: 'investment',
    currentSavings: 12500000,
    riskProfile: 'balanced'
  },
  {
    id: generateId('goal'),
    name: 'Vacation fund',
    targetAmount: 900000,
    timeframeMonths: 12,
    categoryId: 'entertainment',
    currentSavings: 250000,
    riskProfile: 'growth'
  }
];

const sampleInsights = [
  {
    id: generateId('insight'),
    title: 'Capitalize on idle cash',
    body: 'Move ₹3.5L from savings to short-term debt funds to capture 6.2% yield vs. 3.1% idle rate.',
    severity: 'info'
  },
  {
    id: generateId('insight'),
    title: 'Insurance gap',
    body: 'Term coverage is 6× annual income. Raise to 10× for aligned wealth acceleration roadmap.',
    severity: 'warning'
  }
];

const initialState = {
  accounts: sampleAccounts,
  transactions: sampleTransactions,
  categories: defaultCategories,
  plannedExpenses: samplePlannedExpenses,
  recurringExpenses: sampleRecurringExpenses,
  goals: sampleGoals,
  insights: sampleInsights,
  lastSyncedAt: null
};

function computeMetrics(state) {
  const { accounts, transactions, plannedExpenses, recurringExpenses } = state;
  const { assets, liabilities, netWorth } = calculateNetWorth(accounts);
  const income = sum(transactions.filter((txn) => txn.amount > 0).map((txn) => txn.amount));
  const expenses = sum(transactions.filter((txn) => txn.amount < 0).map((txn) => Math.abs(txn.amount)));
  const savingsRate = income === 0 ? 0 : (income - expenses) / income;

  const monthlyPlan = sum(
    plannedExpenses
      .filter((item) => item.status !== 'reconciled')
      .map((item) => item.amount)
  );

  const recurringCommitments = sum(recurringExpenses.map((item) => item.amount));

  const monthlyBurn = expenses + recurringCommitments;
  const runwayMonths = expenses === 0 ? Infinity : assets / Math.max(monthlyBurn, 1);

  return {
    assets,
    liabilities,
    netWorth,
    income,
    expenses,
    savingsRate,
    runwayMonths,
    plannedMonthlySpend: monthlyPlan,
    recurringMonthlySpend: recurringCommitments
  };
}

function generateCashflowTrend(transactions) {
  const map = new Map();
  transactions.forEach((txn) => {
    const key = monthKey(txn.date);
    const entry = map.get(key) ?? { income: 0, expense: 0, net: 0, month: key };
    if (txn.amount > 0) {
      entry.income += txn.amount;
      entry.net += txn.amount;
    } else {
      entry.expense += Math.abs(txn.amount);
      entry.net += txn.amount;
    }
    map.set(key, entry);
  });
  return [...map.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([, value]) => value);
}

function projectGoal(goal) {
  const monthlyContribution = goal.currentSavings / Math.max(goal.timeframeMonths, 1);
  const growthRate = goal.riskProfile === 'growth' ? 0.12 : goal.riskProfile === 'balanced' ? 0.09 : 0.06;
  const projectedValue = goal.currentSavings * (1 + growthRate) ** (goal.timeframeMonths / 12);
  const probability = Math.min(0.98, Math.max(0.2, projectedValue / goal.targetAmount));
  return {
    ...goal,
    projectedValue,
    contribution: monthlyContribution,
    probability
  };
}

function computeWealthAccelerator(state) {
  const { netWorth, income, expenses } = computeMetrics(state);
  const liquidity = state.accounts
    .filter((account) => ['bank', 'cash'].includes(account.type))
    .reduce((sum, account) => sum + account.balance, 0);
  const protectionGap = Math.max(0, income * 120 - liquidity);
  const efficiencyScore = Math.min(100, Math.round((netWorth / Math.max(expenses * 12, 1)) * 14));

  return {
    capitalEfficiencyScore: efficiencyScore,
    opportunityCostAlerts: protectionGap > 0
      ? [`Deploy idle liquidity of ₹${Math.round(protectionGap / 1000) * 1000} to close insurance gap.`]
      : ['Great job — liquidity coverage is resilient.'],
    protectionGap
  };
}

function createStore() {
  const bus = createEventBus();
  let state = {
    ...structuredClone(initialState),
    metrics: computeMetrics(initialState),
    cashflowTrend: generateCashflowTrend(initialState.transactions),
    wealthAccelerator: computeWealthAccelerator(initialState),
    goalProjections: initialState.goals.map((goal) => projectGoal(goal))
  };
  let isSyncing = false;

  async function broadcast() {
    state = {
      ...state,
      metrics: computeMetrics(state),
      cashflowTrend: generateCashflowTrend(state.transactions),
      wealthAccelerator: computeWealthAccelerator(state),
      goalProjections: state.goals.map((goal) => projectGoal(goal))
    };
    bus.emit('change', structuredClone(state));
    if (!isSyncing) {
      isSyncing = true;
      try {
        await persistSnapshot(
          {
            accounts: state.accounts,
            transactions: state.transactions,
            categories: state.categories,
            plannedExpenses: state.plannedExpenses,
            recurringExpenses: state.recurringExpenses,
            goals: state.goals,
            insights: state.insights,
            lastSyncedAt: new Date().toISOString()
          },
          PASS_PHRASE
        );
        state.lastSyncedAt = new Date().toISOString();
      } finally {
        isSyncing = false;
      }
    }
  }

  async function load() {
    const snapshot = await loadSnapshot(PASS_PHRASE);
    if (!snapshot) {
      await broadcast();
      return state;
    }
    state = {
      ...state,
      ...snapshot
    };
    await broadcast();
    return state;
  }

  function getState() {
    return structuredClone(state);
  }

  function addAccount(input) {
    state.accounts = [...state.accounts, { ...input, id: generateId('acct') }];
    broadcast();
  }

  function updateAccount(id, patch) {
    state.accounts = state.accounts.map((account) => (account.id === id ? { ...account, ...patch } : account));
    broadcast();
  }

  function removeAccount(id) {
    state.accounts = state.accounts.filter((account) => account.id !== id);
    state.transactions = state.transactions.filter((txn) => txn.accountId !== id);
    broadcast();
  }

  function addTransaction(input) {
    const transaction = { id: generateId('txn'), ...input };
    state.transactions = [...state.transactions, transaction];
    broadcast();
    return transaction;
  }

  function addCategory(input) {
    const category = { id: generateId('cat'), isCustom: true, ...input };
    state.categories = [...state.categories, category];
    broadcast();
    return category;
  }

  function updateCategory(id, patch) {
    state.categories = state.categories.map((category) => (category.id === id ? { ...category, ...patch } : category));
    broadcast();
  }

  function deleteCategory(id) {
    const fallback = state.categories.find((category) => !category.isCustom && category.type === 'expense');
    state.categories = state.categories.filter((category) => category.id !== id);
    state.transactions = state.transactions.map((txn) =>
      txn.categoryId === id && fallback ? { ...txn, categoryId: fallback.id } : txn
    );
    state.plannedExpenses = state.plannedExpenses.map((item) =>
      item.categoryId === id && fallback ? { ...item, categoryId: fallback.id } : item
    );
    state.recurringExpenses = state.recurringExpenses.map((item) =>
      item.categoryId === id && fallback ? { ...item, categoryId: fallback.id } : item
    );
    broadcast();
  }

  function addPlannedExpense(input) {
    const item = { id: generateId('plan'), status: 'pending', ...input };
    state.plannedExpenses = [...state.plannedExpenses, item];
    broadcast();
    return item;
  }

  function updatePlannedExpense(id, patch) {
    state.plannedExpenses = state.plannedExpenses.map((item) => (item.id === id ? { ...item, ...patch } : item));
    broadcast();
  }

  function deletePlannedExpense(id) {
    state.plannedExpenses = state.plannedExpenses.filter((item) => item.id !== id);
    broadcast();
  }

  function reconcilePlannedExpense(id, transaction) {
    state.plannedExpenses = state.plannedExpenses.map((item) =>
      item.id === id ? { ...item, status: 'reconciled', reconciledAt: new Date().toISOString() } : item
    );
    if (transaction) {
      addTransaction(transaction);
    }
    broadcast();
  }

  function addRecurringExpense(input) {
    const item = { id: generateId('rec'), ...input };
    state.recurringExpenses = [...state.recurringExpenses, item];
    broadcast();
    return item;
  }

  function updateRecurringExpense(id, patch) {
    state.recurringExpenses = state.recurringExpenses.map((item) => (item.id === id ? { ...item, ...patch } : item));
    broadcast();
  }

  function deleteRecurringExpense(id) {
    state.recurringExpenses = state.recurringExpenses.filter((item) => item.id !== id);
    broadcast();
  }

  function addGoal(input) {
    const goal = { id: generateId('goal'), ...input };
    state.goals = [...state.goals, goal];
    broadcast();
    return goal;
  }

  function updateGoal(id, patch) {
    state.goals = state.goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal));
    broadcast();
  }

  function deleteGoal(id) {
    state.goals = state.goals.filter((goal) => goal.id !== id);
    broadcast();
  }

  function addInsight(input) {
    state.insights = [{ id: generateId('insight'), ...input }, ...state.insights];
    broadcast();
  }

  async function exportData() {
    return exportSnapshot(PASS_PHRASE);
  }

  async function importData(blob) {
    const snapshot = await importSnapshot(blob, PASS_PHRASE);
    state = {
      ...state,
      ...snapshot
    };
    await broadcast();
    return state;
  }

  async function reset() {
    state = {
      ...structuredClone(initialState),
      metrics: computeMetrics(initialState),
      cashflowTrend: generateCashflowTrend(initialState.transactions),
      wealthAccelerator: computeWealthAccelerator(initialState),
      goalProjections: initialState.goals.map((goal) => projectGoal(goal))
    };
    await broadcast();
    return state;
  }

  function getMonthlyAverage(categoryId) {
    const grouped = new Map();
    state.transactions.forEach((txn) => {
      if (txn.categoryId !== categoryId) return;
      const key = monthKey(txn.date);
      grouped.set(key, (grouped.get(key) ?? 0) + Math.abs(txn.amount));
    });
    return average([...grouped.values()]);
  }

  return {
    load,
    getState,
    onChange: (callback) => bus.on('change', callback),
    addAccount,
    updateAccount,
    removeAccount,
    addTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    addPlannedExpense,
    updatePlannedExpense,
    deletePlannedExpense,
    reconcilePlannedExpense,
    addRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense,
    addGoal,
    updateGoal,
    deleteGoal,
    addInsight,
    exportData,
    importData,
    reset,
    computeMetrics: () => computeMetrics(state),
    projectGoal,
    getMonthlyAverage
  };
}

export const store = createStore();
