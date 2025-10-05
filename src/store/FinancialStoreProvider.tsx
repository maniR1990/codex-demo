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
  Category,
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

type FinancialStoreContextValue = FinancialStoreState & FinancialStoreActions;

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
  const wealthMetrics = {
    ...simulateWealthAccelerator(
      snapshot.accounts,
      snapshot.transactions,
      snapshot.goals,
      snapshot.recurringExpenses,
      snapshot.monthlyIncomes
    ),
    updatedAt: now
  };

  const insights: Insight[] = generateInsights({
    accounts: snapshot.accounts,
    transactions: snapshot.transactions,
    recurringExpenses: snapshot.recurringExpenses,
    plannedExpenses: snapshot.plannedExpenses,
    goals: snapshot.goals,
    categories: snapshot.categories,
    monthlyIncomes: snapshot.monthlyIncomes,
    currency: snapshot.profile?.currency
  }).map((insight) => ({
    ...insight,
    createdAt: insight.createdAt ?? now,
    updatedAt: now
  }));

  return normaliseSnapshot({
    ...snapshot,
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
      (snapshot.plannedExpenses && snapshot.plannedExpenses.length > 0) ||
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
      await persistAndSet((snapshot) => ({
        ...snapshot,
        plannedExpenses: [...snapshot.plannedExpenses, item]
      }));
      return item;
    },
    async updatePlannedExpense(id, payload) {
      await persistAndSet((snapshot) => ({
        ...snapshot,
        plannedExpenses: snapshot.plannedExpenses.map((expense) =>
          expense.id === id
            ? {
                ...expense,
                ...payload,
                updatedAt: new Date().toISOString()
              }
            : expense
        )
      }));
    },
    async deletePlannedExpense(id) {
      await persistAndSet((snapshot) => ({
        ...snapshot,
        plannedExpenses: snapshot.plannedExpenses.filter((expense) => expense.id !== id)
      }));
    },
    async addRecurringExpense(payload) {
      const now = new Date().toISOString();
      const expense: RecurringExpense = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      await persistAndSet((snapshot) => ({
        ...snapshot,
        recurringExpenses: [...snapshot.recurringExpenses, expense]
      }));
      return expense;
    },
    async updateRecurringExpense(id, payload) {
      await persistAndSet((snapshot) => ({
        ...snapshot,
        recurringExpenses: snapshot.recurringExpenses.map((expense) =>
          expense.id === id
            ? {
                ...expense,
                ...payload,
                updatedAt: new Date().toISOString()
              }
            : expense
        )
      }));
    },
    async deleteRecurringExpense(id) {
      await persistAndSet((snapshot) => ({
        ...snapshot,
        recurringExpenses: snapshot.recurringExpenses.filter((expense) => expense.id !== id)
      }));
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
  return useMemo<FinancialStoreContextValue>(() => ({ ...state, ...actions }), [actions, state]);
}
