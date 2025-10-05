import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type MutableRefObject,
  type ReactNode
} from 'react';
import type {
  Account,
  BudgetActual,
  BudgetAdjustment,
  BudgetMonth,
  BudgetMonthTotals,
  BudgetPlannedItem,
  BudgetRecurringAllocation,
  Category,
  Currency,
  ExportEvent,
  FinancialSnapshot,
  FirebaseSyncConfig,
  Goal,
  Insight,
  MonthlyIncome,
  PlannedExpenseItem,
  Profile,
  RecurringExpense,
  SmartExportRule,
  Transaction
} from '../types';
import {
  exportSnapshot,
  exportSnapshotAsCsv,
  importSnapshot,
  loadSnapshot,
  persistSnapshot
} from '../services/indexedDbService';
import { generateInsights } from '../services/insightsEngine';
import { simulateWealthAccelerator } from '../services/wealthAcceleratorEngine';
import { firebaseSyncService } from '../services/firebaseSyncService';
import { mergeSnapshots, normaliseSnapshot } from '../utils/snapshotMerge';
import { createDefaultBudgetMonth } from '../types';

const STORAGE_KEYS = {
  firebase: 'wealth-accelerator-firebase-config'
} as const;

const sanitiseTags = (tags?: string[]): string[] =>
  (tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);

const sanitiseBudgets = (budgets?: Category['budgets']): Category['budgets'] | undefined => {
  if (!budgets) return undefined;
  const normalised: Category['budgets'] = {};
  if (typeof budgets.monthly === 'number' && !Number.isNaN(budgets.monthly)) {
    normalised.monthly = budgets.monthly;
  }
  if (typeof budgets.yearly === 'number' && !Number.isNaN(budgets.yearly)) {
    normalised.yearly = budgets.yearly;
  }
  return Object.keys(normalised).length ? normalised : undefined;
};

const normaliseOptionalNumber = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return value;
};

const budgetMonthKey = (date?: string | null): string => {
  if (!date) {
    return new Date().toISOString().slice(0, 7);
  }
  return date.slice(0, 7);
};

const emptyTotals = (): BudgetMonthTotals => ({
  planned: 0,
  actual: 0,
  difference: 0,
  rolloverFromPrevious: 0,
  rolloverToNext: 0
});

const createBudgetMonth = (month: string, timestamp: string): BudgetMonth => ({
  month,
  createdAt: timestamp,
  updatedAt: timestamp,
  plannedExpenses: [],
  recurringAllocations: [],
  rollovers: [],
  unassignedActuals: [],
  totals: emptyTotals()
});

const cloneBudgetMonth = (month: BudgetMonth, timestamp: string, key: string): BudgetMonth => ({
  ...month,
  month: month.month ?? key,
  plannedExpenses: [...(month.plannedExpenses ?? [])],
  recurringAllocations: [...(month.recurringAllocations ?? [])],
  rollovers: [...(month.rollovers ?? [])],
  unassignedActuals: [...(month.unassignedActuals ?? [])],
  totals: { ...(month.totals ?? emptyTotals()) },
  updatedAt: timestamp
});

const computeBudgetTotals = (month: BudgetMonth): BudgetMonthTotals => {
  const plannedItems = (month as unknown as { plannedItems?: BudgetPlannedItem[] }).plannedItems ?? [];
  const plannedExpenses = (month as unknown as { plannedExpenses?: PlannedExpenseItem[] }).plannedExpenses ?? [];
  const planned = plannedItems.length
    ? plannedItems.reduce((sum, item) => sum + (item.plannedAmount ?? 0), 0)
    : plannedExpenses.reduce((sum, item) => sum + item.plannedAmount, 0);

  const actualEntries = (month as unknown as { actuals?: BudgetActual[] }).actuals ?? [];
  const legacyActuals = plannedExpenses
    .map((item) => (typeof item.actualAmount === 'number' ? item.actualAmount : 0))
    .filter((value) => typeof value === 'number');
  const actualAssigned = actualEntries.length
    ? actualEntries.reduce((sum, item) => sum + (item.amount ?? 0), 0)
    : legacyActuals.reduce((sum, value) => sum + value, 0);

  const unassignedEntries = (month as unknown as { unassignedActuals?: BudgetActual[] }).unassignedActuals ?? [];
  const unassignedActuals = unassignedEntries.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const actual = actualAssigned + unassignedActuals;

  const adjustments = (month as unknown as { adjustments?: BudgetAdjustment[] }).adjustments ?? [];
  const rolloverFromPrevious = adjustments
    .filter((item) => item.rolloverTargetMonth === month.month)
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const rolloverToNext = adjustments
    .filter((item) => item.rolloverSourceMonth === month.month)
    .reduce((sum, item) => sum + (item.amount ?? 0), 0);

  const difference = planned + rolloverFromPrevious - rolloverToNext - actual;

  return { planned, actual, difference, rolloverFromPrevious, rolloverToNext } satisfies BudgetMonthTotals;
};

export const ensureBudgetMonth = (
  snapshot: FinancialSnapshot,
  key: string
): FinancialSnapshot => {
  if (!key) {
    return snapshot;
  }
  const existing = snapshot.budgetMonths?.[key];
  if (existing) {
    return snapshot;
  }
  const timestamp = new Date().toISOString();
  return {
    ...snapshot,
    budgetMonths: {
      ...snapshot.budgetMonths,
      [key]: createBudgetMonth(key, timestamp)
    }
  };
};

export const recomputeBudgetMonth = (
  snapshot: FinancialSnapshot,
  key: string
): FinancialSnapshot => {
  if (!key) {
    return snapshot;
  }
  const current = snapshot.budgetMonths[key];
  if (!current) {
    return snapshot;
  }
  const timestamp = new Date().toISOString();
  const nextMonth = cloneBudgetMonth(current, timestamp, key);
  nextMonth.recurringAllocations = snapshot.recurringExpenses.filter((expense) => {
    const reference = expense.nextDueDate ?? expense.dueDate ?? expense.createdAt;
    return budgetMonthKey(reference) === key;
  });
  nextMonth.totals = computeBudgetTotals(nextMonth);
  return {
    ...snapshot,
    budgetMonths: {
      ...snapshot.budgetMonths,
      [key]: nextMonth
    }
  };
};

const findPlannedExpenseMonthKey = (
  snapshot: FinancialSnapshot,
  id: string
): string | undefined => {
  for (const [key, month] of Object.entries(snapshot.budgetMonths)) {
    if (month.plannedExpenses.some((item) => item.id === id)) {
      return key;
    }
  }
  return undefined;
};

const toBudgetPlannedItem = (
  item: PlannedExpenseItem,
  currency: Currency
): BudgetPlannedItem => ({
  id: item.id,
  categoryId: item.categoryId,
  name: item.name,
  plannedAmount: item.plannedAmount,
  rolloverAmount: item.remainderAmount ?? undefined,
  currency,
  notes: item.notes
});

const DEFAULT_CURRENCY: Currency = 'INR';

const resolveMonthCurrency = (
  snapshot: FinancialSnapshot,
  month: BudgetMonth | undefined
): Currency =>
  ((month as unknown as { currency?: Currency })?.currency) ??
  snapshot.profile?.currency ??
  DEFAULT_CURRENCY;

const syncPlannedEntriesForMonth = (
  snapshot: FinancialSnapshot,
  monthKey: string,
  plannedExpenses: PlannedExpenseItem[]
): FinancialSnapshot => {
  const month = snapshot.budgetMonths[monthKey];
  if (!month) {
    return snapshot;
  }
  const currency = resolveMonthCurrency(snapshot, month);
  const plannedItems = plannedExpenses.map((expense) =>
    toBudgetPlannedItem(expense, currency)
  );
  return {
    ...snapshot,
    budgetMonths: {
      ...snapshot.budgetMonths,
      [monthKey]: {
        ...month,
        currency,
        plannedExpenses,
        plannedItems
      }
    }
  };
};

const toBudgetActualFromPlanned = (
  item: PlannedExpenseItem,
  currency: Currency
): BudgetActual | null => {
  if (typeof item.actualAmount !== 'number' || Number.isNaN(item.actualAmount)) {
    return null;
  }
  return {
    id: `${item.id}-actual`,
    categoryId: item.categoryId,
    description: item.name,
    amount: item.actualAmount,
    currency,
    occurredOn: item.dueDate ?? item.updatedAt
  } satisfies BudgetActual;
};

const toBudgetActualFromTransaction = (
  transaction: Transaction,
  currency: Currency,
  fallbackIndex: number
): BudgetActual => ({
  id: `${transaction.id ?? `txn-${fallbackIndex}`}-unassigned`,
  transactionId: transaction.id,
  categoryId: transaction.categoryId,
  description: transaction.description,
  amount: Math.abs(transaction.amount),
  currency: transaction.currency ?? currency,
  occurredOn: transaction.date
});

const toBudgetAdjustmentFromRollover = (
  item: PlannedExpenseItem,
  currency: Currency,
  monthKey: string,
  fallbackIndex: number
): BudgetAdjustment | null => {
  if (typeof item.remainderAmount !== 'number' || Number.isNaN(item.remainderAmount)) {
    return null;
  }
  if (item.remainderAmount === 0) {
    return null;
  }
  return {
    id: `${item.id ?? `rollover-${fallbackIndex}`}-adjustment`,
    categoryId: item.categoryId,
    amount: item.remainderAmount,
    currency,
  reason: 'Rollover balance',
  rolloverSourceMonth: monthKey
} satisfies BudgetAdjustment;
};

const toBudgetRecurringAllocation = (
  expense: RecurringExpense,
  monthKey: string
): BudgetRecurringAllocation => ({
  id: expense.id,
  recurringExpenseId: expense.id,
  categoryId: expense.categoryId,
  amount: expense.amount,
  currency: expense.currency,
  startMonth: monthKey,
  endMonth: monthKey
});

const emptyModernTotals = (): BudgetMonthTotals => ({
  planned: 0,
  actual: 0,
  difference: 0,
  rolloverFromPrevious: 0,
  rolloverToNext: 0
});

const normaliseBudgetMonthForSelectors = (
  key: string,
  month: BudgetMonth | undefined,
  currency: Currency
): BudgetMonth => {
  const base = createDefaultBudgetMonth(key, currency);
  if (!month) {
    return base;
  }

  const resolvedCurrency = month.currency ?? currency;

  const plannedItems: BudgetPlannedItem[] = Array.isArray((month as unknown as { plannedItems?: BudgetPlannedItem[] }).plannedItems) &&
    (month as unknown as { plannedItems?: BudgetPlannedItem[] }).plannedItems?.length
      ? ((month as unknown as { plannedItems: BudgetPlannedItem[] }).plannedItems)
      : Array.isArray((month as unknown as { plannedExpenses?: PlannedExpenseItem[] }).plannedExpenses)
      ? ((month as unknown as { plannedExpenses: PlannedExpenseItem[] }).plannedExpenses.map((item) =>
          toBudgetPlannedItem(item, resolvedCurrency)
        ))
      : base.plannedItems;

  const legacyPlannedExpenses = (month as unknown as { plannedExpenses?: PlannedExpenseItem[] }).plannedExpenses ?? [];

  const actuals: BudgetActual[] = Array.isArray((month as unknown as { actuals?: BudgetActual[] }).actuals) &&
    (month as unknown as { actuals?: BudgetActual[] }).actuals?.length
      ? ((month as unknown as { actuals: BudgetActual[] }).actuals)
      : legacyPlannedExpenses
          .map((item) => toBudgetActualFromPlanned(item, resolvedCurrency))
          .filter((item): item is BudgetActual => Boolean(item));

  const legacyUnassigned = (month as unknown as { unassignedActuals?: Transaction[] | BudgetActual[] }).unassignedActuals ?? [];

  const unassignedActuals: BudgetActual[] = Array.isArray(legacyUnassigned) && legacyUnassigned.length > 0
    ? 'accountId' in legacyUnassigned[0]
      ? (legacyUnassigned as Transaction[]).map((txn, index) =>
          toBudgetActualFromTransaction(txn, resolvedCurrency, index)
        )
      : (legacyUnassigned as BudgetActual[])
    : base.unassignedActuals;

  const legacyRollovers = (month as unknown as { rollovers?: PlannedExpenseItem[] }).rollovers ?? [];

  const adjustments: BudgetAdjustment[] = Array.isArray((month as unknown as { adjustments?: BudgetAdjustment[] }).adjustments) &&
    (month as unknown as { adjustments?: BudgetAdjustment[] }).adjustments?.length
      ? ((month as unknown as { adjustments: BudgetAdjustment[] }).adjustments)
      : legacyRollovers
          .map((item, index) =>
            toBudgetAdjustmentFromRollover(item, resolvedCurrency, key, index)
          )
          .filter((item): item is BudgetAdjustment => Boolean(item));

  const recurringAllocations: BudgetRecurringAllocation[] = Array.isArray(
    (month as unknown as { recurringAllocations?: Array<BudgetRecurringAllocation | RecurringExpense> })
      .recurringAllocations
  )
    ? ((month as unknown as { recurringAllocations?: Array<BudgetRecurringAllocation | RecurringExpense> })
        .recurringAllocations ?? [])
        .map((allocation) =>
          'recurringExpenseId' in allocation
            ? (allocation as BudgetRecurringAllocation)
            : toBudgetRecurringAllocation(allocation as RecurringExpense, key)
        )
    : base.recurringAllocations;

  return {
    ...base,
    ...month,
    month: month.month ?? key,
    currency: resolvedCurrency,
    plannedItems,
    actuals,
    unassignedActuals,
    adjustments,
    recurringAllocations,
    totals: {
      ...emptyModernTotals(),
      ...month.totals
    }
  } satisfies BudgetMonth;
};

interface InitialSetupPayload {
  currency: Profile['currency'];
  financialStartDate: string;
  openingBalanceNote?: string;
  accounts: Array<Pick<Account, 'name' | 'type' | 'balance' | 'currency' | 'notes'>>;
}

interface SmartExportRulePayload {
  name: string;
  type: SmartExportRule['type'];
  threshold: number;
  target: SmartExportRule['target'];
  gpgKeyFingerprint?: string;
}

interface FinancialStoreState extends FinancialSnapshot {
  isReady: boolean;
  isSyncing: boolean;
  isInitialised: boolean;
  hasDismissedInitialSetup: boolean;
  lastSyncedAt?: string;
  firebaseStatus: {
    state: 'idle' | 'connecting' | 'connected' | 'error';
    error?: string;
  };
}

interface FinancialStoreActions {
  refresh(): Promise<void>;
  completeInitialSetup(payload: InitialSetupPayload): Promise<void>;
  dismissInitialSetup(): void;
  requestInitialSetup(): void;
  updateProfile(payload: Partial<Omit<Profile, 'createdAt' | 'updatedAt'>>): Promise<void>;
  addCategory(
    payload: {
      name: string;
      type: Category['type'];
      parentId?: string;
      tags?: string[];
      budgets?: Category['budgets'];
      isCustom?: boolean;
    }
  ): Promise<Category>;
  updateCategory(id: string, payload: Partial<Category>): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  addMonthlyIncome(payload: Omit<MonthlyIncome, 'id' | 'createdAt' | 'updatedAt'>): Promise<MonthlyIncome>;
  updateMonthlyIncome(id: string, payload: Partial<MonthlyIncome>): Promise<void>;
  deleteMonthlyIncome(id: string): Promise<void>;
  addPlannedExpense(
    payload: Omit<PlannedExpenseItem, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
      status?: PlannedExpenseItem['status'];
    }
  ): Promise<PlannedExpenseItem>;
  updatePlannedExpense(id: string, payload: Partial<PlannedExpenseItem>): Promise<void>;
  deletePlannedExpense(id: string): Promise<void>;
  addRecurringExpense(payload: Omit<RecurringExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<RecurringExpense>;
  updateRecurringExpense(id: string, payload: Partial<RecurringExpense>): Promise<void>;
  deleteRecurringExpense(id: string): Promise<void>;
  addManualAccount(payload: Omit<Account, 'id' | 'createdAt' | 'updatedAt' | 'isManual'>): Promise<Account>;
  addManualTransaction(
    payload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'isRecurringMatch' | 'isPlannedMatch'>
  ): Promise<Transaction>;
  addGoal(payload: Omit<Goal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Goal>;
  addSmartExportRule(payload: SmartExportRulePayload): Promise<SmartExportRule>;
  deleteSmartExportRule(id: string): Promise<void>;
  exportData(): Promise<Blob>;
  exportDataAsCsv(): Promise<Blob>;
  importData(file: Blob): Promise<void>;
  configureFirebase(config: FirebaseSyncConfig): Promise<void>;
  disconnectFirebase(): void;
  resetLedger(): Promise<void>;
}

interface FinancialStoreSelectors {
  budgetMonthMap: Record<string, BudgetMonth>;
  budgetMonthsList: BudgetMonth[];
  getBudgetMonth: (monthKey: string) => BudgetMonth | undefined;
  budgetSummary: BudgetMonthTotals;
  allBudgetPlannedItems: BudgetPlannedItem[];
  allBudgetActuals: BudgetActual[];
  allBudgetUnassignedActuals: BudgetActual[];
  allBudgetAdjustments: BudgetAdjustment[];
  allBudgetedPlannedExpenses: PlannedExpenseItem[];
}

type FinancialStoreContextValue = FinancialStoreState & FinancialStoreActions & FinancialStoreSelectors;

type FinancialReducerAction =
  | { type: 'replace'; state: FinancialStoreState }
  | { type: 'merge'; patch: Partial<FinancialStoreState> };

interface SimpleStore<State, Action> {
  getState(): State;
  dispatch(action: Action): Action;
  subscribe(listener: () => void): () => void;
}

const FinancialStoreContext = createContext<FinancialStoreContainer | null>(null);

interface FinancialStoreContainer {
  store: SimpleStore<FinancialStoreState, FinancialReducerAction>;
  firebaseConfigRef: MutableRefObject<FirebaseSyncConfig | null>;
}

const INITIAL_SETUP_DISMISS_KEY = 'wealth-accelerator-initial-setup-dismissed';

const readInitialSetupDismissed = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(INITIAL_SETUP_DISMISS_KEY) === 'true';
};

const persistInitialSetupDismissed = (value: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (value) {
    window.localStorage.setItem(INITIAL_SETUP_DISMISS_KEY, 'true');
  } else {
    window.localStorage.removeItem(INITIAL_SETUP_DISMISS_KEY);
  }
};

const createDefaultSnapshot = (): FinancialSnapshot => {
  const now = new Date().toISOString();
  return {
    profile: null,
    accounts: [],
    categories: [],
    transactions: [],
    monthlyIncomes: [],
    plannedExpenses: [],
    budgetMonths: {},
    recurringExpenses: [],
    goals: [],
    insights: [],
    wealthMetrics: {
      capitalEfficiencyScore: 0,
      opportunityCostAlerts: [],
      insuranceGapAnalysis: '',
      updatedAt: now
    },
    smartExportRules: [],
    exportHistory: [],
    revision: 0,
    lastLocalChangeAt: now
  };
};

const deriveFromSnapshot = (snapshot: FinancialSnapshot): FinancialSnapshot => {
  const now = new Date().toISOString();
  let working: FinancialSnapshot = {
    ...snapshot,
    budgetMonths: { ...snapshot.budgetMonths }
  };
  const touchedMonths = new Set<string>();

  if (working.plannedExpenses.length > 0) {
    for (const expense of working.plannedExpenses) {
      const key = budgetMonthKey(expense.dueDate ?? expense.createdAt);
      touchedMonths.add(key);
      working = ensureBudgetMonth(working, key);
      const month = working.budgetMonths[key];
      const timestampedExpense: PlannedExpenseItem = {
        ...expense,
        createdAt: expense.createdAt ?? now,
        updatedAt: expense.updatedAt ?? now
      };
      const index = month.plannedExpenses.findIndex((item) => item.id === expense.id);
      const plannedExpenses = index >= 0
        ? month.plannedExpenses.map((item) => (item.id === expense.id ? timestampedExpense : item))
        : [...month.plannedExpenses, timestampedExpense];
      working = {
        ...working,
        budgetMonths: {
          ...working.budgetMonths,
          [key]: {
            ...month,
            plannedExpenses
          }
        }
      };
    }
    working = { ...working, plannedExpenses: [] };
  }

  for (const expense of working.recurringExpenses) {
    const key = budgetMonthKey(expense.nextDueDate ?? expense.dueDate ?? expense.createdAt);
    touchedMonths.add(key);
    working = ensureBudgetMonth(working, key);
  }

  Object.keys(working.budgetMonths).forEach((key) => touchedMonths.add(key));

  for (const key of touchedMonths) {
    working = recomputeBudgetMonth(working, key);
  }

  const baseCurrency = working.profile?.currency ?? 'INR';
  const normalisedBudgetMonthsForInsights = Object.entries(working.budgetMonths).map(([key, month]) =>
    normaliseBudgetMonthForSelectors(key, month, baseCurrency)
  );

  const wealthMetrics = {
    ...simulateWealthAccelerator(
      working.accounts,
      working.transactions,
      working.goals,
      working.recurringExpenses,
      working.monthlyIncomes
    ),
    updatedAt: now
  };

  const insights: Insight[] = generateInsights({
    accounts: working.accounts,
    transactions: working.transactions,
    recurringExpenses: working.recurringExpenses,
    budgetMonths: normalisedBudgetMonthsForInsights,
    goals: working.goals,
    categories: working.categories,
    monthlyIncomes: working.monthlyIncomes,
    currency: working.profile?.currency
  }).map((insight) => ({
    ...insight,
    createdAt: insight.createdAt ?? now,
    updatedAt: now
  }));

  return normaliseSnapshot({
    ...working,
    plannedExpenses: [],
    wealthMetrics,
    insights
  });
};

const isSnapshotInitialised = (snapshot: Partial<FinancialSnapshot>): boolean =>
  Boolean(
    snapshot.profile ||
      (snapshot.accounts && snapshot.accounts.length > 0) ||
      (snapshot.transactions && snapshot.transactions.length > 0) ||
      (snapshot.monthlyIncomes && snapshot.monthlyIncomes.length > 0) ||
      (snapshot.budgetMonths &&
        Object.values(snapshot.budgetMonths).some(
          (month) =>
            month?.plannedExpenses?.length ||
            month?.recurringAllocations?.length ||
            month?.totals?.planned ||
            month?.totals?.recurring
        )) ||
      (snapshot.recurringExpenses && snapshot.recurringExpenses.length > 0)
  );

const createDefaultState = (): FinancialStoreState => {
  const snapshot = createDefaultSnapshot();
  return {
    ...snapshot,
    isReady: false,
    isSyncing: false,
    isInitialised: false,
    hasDismissedInitialSetup: readInitialSetupDismissed(),
    firebaseStatus: { state: 'idle' }
  };
};

function financialReducer(state: FinancialStoreState, action: FinancialReducerAction): FinancialStoreState {
  switch (action.type) {
    case 'replace':
      return action.state;
    case 'merge':
      return { ...state, ...action.patch };
    default:
      return state;
  }
}

function createSimpleStore<State, Action>(
  reducer: (state: State, action: Action) => State,
  initialState: State
): SimpleStore<State, Action> {
  let currentState = initialState;
  const listeners = new Set<() => void>();

  const getState = () => currentState;

  const dispatch = (action: Action) => {
    const nextState = reducer(currentState, action);
    if (!Object.is(nextState, currentState)) {
      currentState = nextState;
      listeners.forEach((listener) => listener());
    }
    return action;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    getState,
    dispatch,
    subscribe
  };
}

const evaluateSmartExports = async (_snapshot: FinancialSnapshot) => {
  // Git-based automation has been retired; this remains for future extensibility.
};

function toSnapshot(value: FinancialStoreState): FinancialSnapshot {
  return {
    profile: value.profile,
    accounts: value.accounts,
    categories: value.categories,
    transactions: value.transactions,
    monthlyIncomes: value.monthlyIncomes,
    plannedExpenses: value.plannedExpenses,
    budgetMonths: value.budgetMonths,
    recurringExpenses: value.recurringExpenses,
    goals: value.goals,
    insights: value.insights,
    wealthMetrics: value.wealthMetrics,
    smartExportRules: value.smartExportRules,
    exportHistory: value.exportHistory,
    revision: value.revision,
    lastLocalChangeAt: value.lastLocalChangeAt
  };
}

async function startFirebaseSync(
  config: FirebaseSyncConfig,
  container: FinancialStoreContainer
) {
  const { store, firebaseConfigRef } = container;
  firebaseConfigRef.current = config;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEYS.firebase, JSON.stringify(config));
  }
  store.dispatch({ type: 'merge', patch: { firebaseStatus: { state: 'connecting' } } });
  await firebaseSyncService.configure(config, {
    onStatusChange(status, error) {
      store.dispatch({
        type: 'merge',
        patch: { firebaseStatus: { state: status, error: error?.message } }
      });
    },
    onRemoteSnapshot(remote) {
      const merged = mergeSnapshots(toSnapshot(store.getState()), remote);
      void persistSnapshot(merged);
      store.dispatch({
        type: 'merge',
        patch: {
          ...merged,
          isInitialised: isSnapshotInitialised(merged),
          lastSyncedAt: new Date().toISOString(),
          firebaseStatus: { state: 'connected' }
        }
      });
    }
  });
}

function FinancialStoreEffects({ container }: { container: FinancialStoreContainer }) {
  const { store } = container;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await loadSnapshot();
      if (!mounted) return;
      const baseSnapshot = stored ? deriveFromSnapshot(stored) : createDefaultSnapshot();
      const initialised = isSnapshotInitialised(baseSnapshot);
      store.dispatch({
        type: 'merge',
        patch: {
          ...baseSnapshot,
          isReady: true,
          isInitialised: initialised,
          hasDismissedInitialSetup: initialised ? false : store.getState().hasDismissedInitialSetup
        }
      });
    })();

    return () => {
      mounted = false;
      firebaseSyncService.stop();
    };
  }, [store]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEYS.firebase);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FirebaseSyncConfig;
        void startFirebaseSync(parsed, container);
      } catch {
        window.localStorage.removeItem(STORAGE_KEYS.firebase);
      }
    }
  }, [container]);

  return null;
}

export function FinancialStoreProvider({ children }: { children: ReactNode }) {
  const containerRef = useRef<FinancialStoreContainer>();
  if (!containerRef.current) {
    const store = createSimpleStore(financialReducer, createDefaultState());
    const firebaseConfigRef: MutableRefObject<FirebaseSyncConfig | null> = { current: null };
    containerRef.current = { store, firebaseConfigRef };
  }

  return (
    <FinancialStoreContext.Provider value={containerRef.current}>
      <FinancialStoreEffects container={containerRef.current} />
      {children}
    </FinancialStoreContext.Provider>
  );
}

function useFinancialActions(container: FinancialStoreContainer): FinancialStoreActions {
  const { store, firebaseConfigRef } = container;

  const persistAndSet = useCallback(async (updater: (snapshot: FinancialSnapshot) => FinancialSnapshot) => {
    const currentState = store.getState();
    const currentSnapshot = toSnapshot(currentState);
    const updatedSnapshot = updater(currentSnapshot);
    const nextRevision = updatedSnapshot.revision ?? currentSnapshot.revision + 1;
    const withMeta: FinancialSnapshot = {
      ...updatedSnapshot,
      revision: nextRevision,
      lastLocalChangeAt: new Date().toISOString()
    };
    const derivedSnapshot = deriveFromSnapshot(withMeta);
    await persistSnapshot(derivedSnapshot);
    const initialised = isSnapshotInitialised(derivedSnapshot);
    if (initialised) {
      persistInitialSetupDismissed(false);
    }
    store.dispatch({
      type: 'merge',
      patch: {
        ...derivedSnapshot,
        isReady: true,
        isInitialised: initialised,
        hasDismissedInitialSetup: initialised ? false : currentState.hasDismissedInitialSetup
      }
    });
    await evaluateSmartExports(derivedSnapshot);
  }, [store]);

  const logExportEvent = useCallback(async (event: Pick<ExportEvent, 'format' | 'context' | 'trigger'>) => {
    const now = new Date().toISOString();
    await persistAndSet((snapshot) => ({
      ...snapshot,
      exportHistory: [
        ...snapshot.exportHistory,
        {
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          ...event
        }
      ]
    }));
  }, [persistAndSet]);

  return useMemo<FinancialStoreActions>(() => ({
    async refresh() {
      store.dispatch({ type: 'merge', patch: { isSyncing: true } });
      const currentSnapshot = deriveFromSnapshot(toSnapshot(store.getState()));
      await persistSnapshot(currentSnapshot);
      if (firebaseConfigRef.current) {
        const remote = await firebaseSyncService.fetchRemoteSnapshot();
        if (remote) {
          const merged = mergeSnapshots(currentSnapshot, remote);
          await persistSnapshot(merged);
          store.dispatch({
            type: 'merge',
            patch: {
              ...merged,
              isSyncing: false,
              isInitialised: isSnapshotInitialised(merged),
              lastSyncedAt: new Date().toISOString()
            }
          });
          return;
        }
      }
      store.dispatch({
        type: 'merge',
        patch: {
          ...currentSnapshot,
          isSyncing: false,
          lastSyncedAt: new Date().toISOString(),
          isInitialised: isSnapshotInitialised(currentSnapshot)
        }
      });
    },
    async completeInitialSetup(payload) {
      await persistAndSet((snapshot) => {
        const now = new Date().toISOString();
        const profile: Profile = {
          currency: payload.currency,
          financialStartDate: payload.financialStartDate,
          openingBalanceNote: payload.openingBalanceNote,
          createdAt: now,
          updatedAt: now
        };
        const accounts: Account[] = [
          ...snapshot.accounts,
          ...payload.accounts.map((account) => ({
            ...account,
            id: crypto.randomUUID(),
            isManual: true,
            createdAt: now,
            updatedAt: now
          }))
        ];
        return {
          ...snapshot,
          profile,
          accounts
        };
      });
    },
    dismissInitialSetup() {
      persistInitialSetupDismissed(true);
      store.dispatch({
        type: 'merge',
        patch: { hasDismissedInitialSetup: true }
      });
    },
    requestInitialSetup() {
      persistInitialSetupDismissed(false);
      store.dispatch({
        type: 'merge',
        patch: { hasDismissedInitialSetup: false }
      });
    },
    async updateProfile(payload) {
      await persistAndSet((snapshot) => {
        const now = new Date().toISOString();
        const existing = snapshot.profile ?? {
          currency: payload.currency ?? 'INR',
          financialStartDate: payload.financialStartDate ?? now,
          createdAt: now,
          updatedAt: now
        };
        const profile: Profile = {
          ...existing,
          ...payload,
          updatedAt: now
        };
        return {
          ...snapshot,
          profile
        };
      });
    },
    async addCategory(payload) {
      const now = new Date().toISOString();
      const category: Category = {
        ...payload,
        id: crypto.randomUUID(),
        isCustom: payload.isCustom ?? true,
        tags: sanitiseTags(payload.tags),
        budgets: sanitiseBudgets(payload.budgets),
        createdAt: now,
        updatedAt: now
      };
      await persistAndSet((snapshot) => ({
        ...snapshot,
        categories: [...snapshot.categories, category]
      }));
      return category;
    },
    async updateCategory(id, payload) {
      await persistAndSet((snapshot) => ({
        ...snapshot,
        categories: snapshot.categories.map((category) =>
          category.id === id
            ? {
                ...category,
                ...payload,
                tags: payload.tags ? sanitiseTags(payload.tags) : category.tags,
                budgets: payload.budgets ? sanitiseBudgets(payload.budgets) : category.budgets,
                updatedAt: new Date().toISOString()
              }
            : category
        )
      }));
    },
    async deleteCategory(id) {
      await persistAndSet((snapshot) => ({
        ...snapshot,
        categories: snapshot.categories.filter((category) => category.id !== id)
      }));
    },
    async addMonthlyIncome(payload) {
      const now = new Date().toISOString();
      const income: MonthlyIncome = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      await persistAndSet((snapshot) => ({
        ...snapshot,
        monthlyIncomes: [...snapshot.monthlyIncomes, income]
      }));
      return income;
    },
    async updateMonthlyIncome(id, payload) {
      await persistAndSet((snapshot) => ({
        ...snapshot,
        monthlyIncomes: snapshot.monthlyIncomes.map((income) =>
          income.id === id
            ? {
                ...income,
                ...payload,
                updatedAt: new Date().toISOString()
              }
            : income
        )
      }));
    },
    async deleteMonthlyIncome(id) {
      await persistAndSet((snapshot) => ({
        ...snapshot,
        monthlyIncomes: snapshot.monthlyIncomes.filter((income) => income.id !== id)
      }));
    },
    async addPlannedExpense(payload) {
      const now = new Date().toISOString();
      const item: PlannedExpenseItem = {
        ...payload,
        id: crypto.randomUUID(),
        status: payload.status ?? 'pending',
        createdAt: now,
        updatedAt: now
      };
      await persistAndSet((snapshot) => {
        const key = budgetMonthKey(item.dueDate ?? item.createdAt);
        let next = ensureBudgetMonth(snapshot, key);
        const month = next.budgetMonths[key];
        const plannedExpenses = [...month.plannedExpenses, item];
        next = syncPlannedEntriesForMonth(
          {
            ...next,
            plannedExpenses: []
          },
          key,
          plannedExpenses
        );
        return recomputeBudgetMonth(next, key);
      });
      return item;
    },
    async updatePlannedExpense(id, payload) {
      await persistAndSet((snapshot) => {
        const monthKey = findPlannedExpenseMonthKey(snapshot, id);
        if (!monthKey) {
          return snapshot;
        }
        const currentMonth = snapshot.budgetMonths[monthKey];
        const currentExpense = currentMonth.plannedExpenses.find((expense) => expense.id === id);
        if (!currentExpense) {
          return snapshot;
        }
        const now = new Date().toISOString();
        const updatedExpense: PlannedExpenseItem = {
          ...currentExpense,
          ...payload,
          updatedAt: now
        };
        const nextMonthKey = budgetMonthKey(updatedExpense.dueDate ?? updatedExpense.createdAt);
        const touched = new Set([monthKey, nextMonthKey]);
        let next = ensureBudgetMonth(snapshot, nextMonthKey);
        const withoutCurrent = next.budgetMonths[monthKey].plannedExpenses.filter((expense) => expense.id !== id);
        next = {
          ...next,
          plannedExpenses: []
        };
        next = syncPlannedEntriesForMonth(next, monthKey, withoutCurrent);
        const destinationMonth = next.budgetMonths[nextMonthKey];
        const existingIndex = destinationMonth.plannedExpenses.findIndex((expense) => expense.id === id);
        const updatedPlanned = existingIndex >= 0
          ? destinationMonth.plannedExpenses.map((expense) => (expense.id === id ? updatedExpense : expense))
          : [...destinationMonth.plannedExpenses, updatedExpense];
        next = syncPlannedEntriesForMonth(next, nextMonthKey, updatedPlanned);
        for (const key of touched) {
          next = recomputeBudgetMonth(next, key);
        }
        return next;
      });
    },
    async deletePlannedExpense(id) {
      await persistAndSet((snapshot) => {
        const monthKey = findPlannedExpenseMonthKey(snapshot, id);
        if (!monthKey) {
          return snapshot;
        }
        const month = snapshot.budgetMonths[monthKey];
        const plannedExpenses = month.plannedExpenses.filter((expense) => expense.id !== id);
        let next: FinancialSnapshot = {
          ...snapshot,
          plannedExpenses: []
        };
        next = syncPlannedEntriesForMonth(next, monthKey, plannedExpenses);
        next = recomputeBudgetMonth(next, monthKey);
        return next;
      });
    },
    async addRecurringExpense(payload) {
      const now = new Date().toISOString();
      const expense: RecurringExpense = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      await persistAndSet((snapshot) => {
        const key = budgetMonthKey(expense.nextDueDate ?? expense.dueDate ?? expense.createdAt);
        let next: FinancialSnapshot = {
          ...snapshot,
          recurringExpenses: [...snapshot.recurringExpenses, expense]
        };
        next = ensureBudgetMonth(next, key);
        next = recomputeBudgetMonth(next, key);
        return next;
      });
      return expense;
    },
    async updateRecurringExpense(id, payload) {
      await persistAndSet((snapshot) => {
        const existing = snapshot.recurringExpenses.find((expense) => expense.id === id);
        if (!existing) {
          return snapshot;
        }
        const now = new Date().toISOString();
        const updatedExpense: RecurringExpense = {
          ...existing,
          ...payload,
          updatedAt: now
        };
        let next: FinancialSnapshot = {
          ...snapshot,
          recurringExpenses: snapshot.recurringExpenses.map((expense) =>
            expense.id === id ? updatedExpense : expense
          )
        };
        const previousKey = budgetMonthKey(existing.nextDueDate ?? existing.dueDate ?? existing.createdAt);
        const nextKey = budgetMonthKey(
          updatedExpense.nextDueDate ?? updatedExpense.dueDate ?? updatedExpense.createdAt
        );
        next = ensureBudgetMonth(next, previousKey);
        next = ensureBudgetMonth(next, nextKey);
        for (const key of new Set([previousKey, nextKey])) {
          next = recomputeBudgetMonth(next, key);
        }
        return next;
      });
    },
    async deleteRecurringExpense(id) {
      await persistAndSet((snapshot) => {
        const existing = snapshot.recurringExpenses.find((expense) => expense.id === id);
        const next: FinancialSnapshot = {
          ...snapshot,
          recurringExpenses: snapshot.recurringExpenses.filter((expense) => expense.id !== id)
        };
        if (!existing) {
          return next;
        }
        const key = budgetMonthKey(existing.nextDueDate ?? existing.dueDate ?? existing.createdAt);
        let ensured = ensureBudgetMonth(next, key);
        ensured = recomputeBudgetMonth(ensured, key);
        return ensured;
      });
    },
    async addManualAccount(payload) {
      const now = new Date().toISOString();
      const account: Account = {
        ...payload,
        id: crypto.randomUUID(),
        isManual: true,
        createdAt: now,
        updatedAt: now
      };
      await persistAndSet((snapshot) => ({
        ...snapshot,
        accounts: [...snapshot.accounts, account]
      }));
      return account;
    },
    async addManualTransaction(payload) {
      const now = new Date().toISOString();
      const transaction: Transaction = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      let accountUpdated = false;
      await persistAndSet((snapshot) => {
        const account = snapshot.accounts.find((item) => item.id === transaction.accountId);
        if (!account) {
          return snapshot;
        }
        accountUpdated = true;
        return {
          ...snapshot,
          accounts: snapshot.accounts.map((item) =>
            item.id === transaction.accountId
              ? {
                  ...item,
                  balance: item.balance + transaction.amount,
                  updatedAt: now
                }
              : item
          ),
          transactions: [...snapshot.transactions, transaction]
        };
      });
      if (!accountUpdated) {
        throw new Error('Unable to record spend: the selected account no longer exists.');
      }
      return transaction;
    },
    async addGoal(payload) {
      const now = new Date().toISOString();
      const goal: Goal = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      await persistAndSet((snapshot) => ({
        ...snapshot,
        goals: [...snapshot.goals, goal]
      }));
      return goal;
    },
    async addSmartExportRule(payload) {
      const now = new Date().toISOString();
      const rule: SmartExportRule = {
        id: crypto.randomUUID(),
        name: payload.name,
        type: payload.type,
        threshold: payload.threshold,
        target: payload.target,
        gpgKeyFingerprint: payload.gpgKeyFingerprint,
        createdAt: now,
        updatedAt: now,
        lastTriggeredAt: undefined
      };
      await persistAndSet((snapshot) => ({
        ...snapshot,
        smartExportRules: [...snapshot.smartExportRules, rule]
      }));
      return rule;
    },
    async deleteSmartExportRule(id) {
      await persistAndSet((snapshot) => ({
        ...snapshot,
        smartExportRules: snapshot.smartExportRules.filter((rule) => rule.id !== id)
      }));
    },
    async exportData() {
      const blob = await exportSnapshot();
      await logExportEvent({ trigger: 'manual', format: 'json' });
      return blob;
    },
    async exportDataAsCsv() {
      const blob = await exportSnapshotAsCsv();
      await logExportEvent({ trigger: 'manual', format: 'csv' });
      return blob;
    },
    async importData(file) {
      const snapshot = await importSnapshot(file);
      const derived = deriveFromSnapshot(snapshot);
      await persistSnapshot(derived);
      store.dispatch({
        type: 'merge',
        patch: {
          ...derived,
          isReady: true,
          isInitialised: isSnapshotInitialised(derived)
        }
      });
    },
    async configureFirebase(config) {
      await startFirebaseSync(config, container);
    },
    disconnectFirebase() {
      firebaseSyncService.stop();
      firebaseConfigRef.current = null;
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(STORAGE_KEYS.firebase);
      }
      store.dispatch({ type: 'merge', patch: { firebaseStatus: { state: 'idle' } } });
    },
    async resetLedger() {
      const blankSnapshot = deriveFromSnapshot(createDefaultSnapshot());
      await persistSnapshot(blankSnapshot);
      store.dispatch({
        type: 'merge',
        patch: {
          ...blankSnapshot,
          isReady: true,
          isSyncing: false,
          isInitialised: false,
          lastSyncedAt: undefined,
          hasDismissedInitialSetup: false
        }
      });
    }
  }), [container, firebaseConfigRef, logExportEvent, persistAndSet, store]);
}

export function useFinancialStore() {
  const container = useContext(FinancialStoreContext);
  if (!container) {
    throw new Error('useFinancialStore must be used within FinancialStoreProvider');
  }
  const state = useSyncExternalStore(
    container.store.subscribe,
    container.store.getState,
    container.store.getState
  );
  const actions = useFinancialActions(container);
  const selectors = useMemo<FinancialStoreSelectors>(() => {
    const currency = state.profile?.currency ?? 'INR';
    const rawMap = state.budgetMonths ?? {};
    const normalisedEntries = Object.entries(rawMap).map(([key, month]) => [
      key,
      normaliseBudgetMonthForSelectors(key, month, currency)
    ]);

    if (normalisedEntries.length === 0) {
      const monthKey = new Date().toISOString().slice(0, 7);
      normalisedEntries.push([monthKey, createDefaultBudgetMonth(monthKey, currency)]);
    }

    const budgetMonthMap = Object.fromEntries(normalisedEntries) as Record<string, BudgetMonth>;

    const budgetMonthsList = Object.values(budgetMonthMap).sort((a, b) => a.month.localeCompare(b.month));
    const allBudgetedPlannedExpenses = Object.values(rawMap).flatMap((month) =>
      Array.isArray(month?.plannedExpenses) ? month!.plannedExpenses : []
    );
    const allBudgetPlannedItems = budgetMonthsList.flatMap((month) => month.plannedItems);
    const allBudgetActuals = budgetMonthsList.flatMap((month) => month.actuals);
    const allBudgetUnassignedActuals = budgetMonthsList.flatMap((month) => month.unassignedActuals);
    const allBudgetAdjustments = budgetMonthsList.flatMap((month) => month.adjustments);
    const budgetSummary = budgetMonthsList.reduce<BudgetMonthTotals>(
      (acc, month) => ({
        planned: acc.planned + (month.totals?.planned ?? 0),
        actual: acc.actual + (month.totals?.actual ?? 0),
        difference:
          acc.difference +
          (month.totals?.difference ?? (month.totals?.planned ?? 0) - (month.totals?.actual ?? 0)),
        rolloverFromPrevious:
          acc.rolloverFromPrevious + (month.totals?.rolloverFromPrevious ?? 0),
        rolloverToNext: acc.rolloverToNext + (month.totals?.rolloverToNext ?? 0)
      }),
      emptyModernTotals()
    );

    const getBudgetMonth = (monthKey: string) =>
      budgetMonthMap[monthKey] ?? normaliseBudgetMonthForSelectors(monthKey, undefined, currency);

    return {
      budgetMonthMap,
      budgetMonthsList,
      getBudgetMonth,
      budgetSummary,
      allBudgetPlannedItems,
      allBudgetActuals,
      allBudgetUnassignedActuals,
      allBudgetAdjustments,
      allBudgetedPlannedExpenses
    } satisfies FinancialStoreSelectors;
  }, [state.budgetMonths, state.profile?.currency]);
  return useMemo<FinancialStoreContextValue>(
    () => ({ ...state, ...actions, ...selectors }),
    [actions, selectors, state]
  );
}
