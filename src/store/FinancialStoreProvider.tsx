import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  addCategory(payload: Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'isCustom'> & { isCustom?: boolean }): Promise<Category>;
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
}

type FinancialStoreContextValue = FinancialStoreState & FinancialStoreActions;

const FinancialStoreContext = createContext<FinancialStoreContextValue | undefined>(undefined);

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

const createDefaultState = (): FinancialStoreState => {
  const snapshot = createDefaultSnapshot();
  return {
    ...snapshot,
    isReady: false,
    isSyncing: false,
    isInitialised: false,
    hasDismissedInitialSetup: false,
    firebaseStatus: { state: 'idle' }
  };
};

export function FinancialStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinancialStoreState>(() => ({
    ...createDefaultState(),
    hasDismissedInitialSetup: readInitialSetupDismissed()
  }));
  const firebaseConfigRef = useRef<FirebaseSyncConfig | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await loadSnapshot();
      if (!mounted) return;
      const baseSnapshot = stored ? deriveFromSnapshot(stored) : createDefaultSnapshot();
      setState((prev) => {
        const initialised = Boolean(baseSnapshot.profile);
        if (initialised) {
          persistInitialSetupDismissed(false);
        }
        return {
          ...prev,
          ...baseSnapshot,
          isReady: true,
          isInitialised: initialised,
          hasDismissedInitialSetup: initialised ? false : prev.hasDismissedInitialSetup
        };
      });
    })();

    return () => {
      mounted = false;
      firebaseSyncService.stop();
    };
  }, []);

  const toSnapshot = (value: FinancialStoreState): FinancialSnapshot => ({
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
  });

  const persistAndSet = async (updater: (snapshot: FinancialSnapshot) => FinancialSnapshot) => {
    let derivedSnapshot: FinancialSnapshot | null = null;

    setState((prev) => {
      const currentSnapshot = toSnapshot(prev);
      const updatedSnapshot = updater(currentSnapshot);
      const nextRevision = updatedSnapshot.revision ?? currentSnapshot.revision + 1;
      const withMeta: FinancialSnapshot = {
        ...updatedSnapshot,
        revision: nextRevision,
        lastLocalChangeAt: new Date().toISOString()
      };
      derivedSnapshot = deriveFromSnapshot(withMeta);
      void persistSnapshot(derivedSnapshot);
      const initialised = Boolean(derivedSnapshot?.profile);
      if (initialised) {
        persistInitialSetupDismissed(false);
      }
      return {
        ...prev,
        ...derivedSnapshot,
        isReady: true,
        isInitialised: initialised,
        hasDismissedInitialSetup: initialised ? false : prev.hasDismissedInitialSetup
      };
    });

    if (derivedSnapshot) {
      await evaluateSmartExports(derivedSnapshot);
    }
  };

  const logExportEvent = async (
    event: Pick<ExportEvent, 'format' | 'context' | 'trigger'>
  ) => {
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
  };

  const evaluateSmartExports = async (_snapshot: FinancialSnapshot) => {
    // Git-based automation has been retired; this remains for future extensibility.
  };

  const refresh = async () => {
    setState((prev) => ({ ...prev, isSyncing: true }));
    const currentSnapshot = deriveFromSnapshot(toSnapshot(state));
    await persistSnapshot(currentSnapshot);
    if (firebaseConfigRef.current) {
      const remote = await firebaseSyncService.fetchRemoteSnapshot();
      if (remote) {
        const merged = mergeSnapshots(currentSnapshot, remote);
        await persistSnapshot(merged);
        setState((prev) => ({
          ...prev,
          ...merged,
          isSyncing: false,
          isInitialised: Boolean(merged.profile),
          hasDismissedInitialSetup: Boolean(merged.profile) ? false : prev.hasDismissedInitialSetup,
          lastSyncedAt: new Date().toISOString()
        }));
        return;
      }
    }
    setState((prev) => ({
      ...prev,
      ...currentSnapshot,
      isSyncing: false,
      hasDismissedInitialSetup: Boolean(currentSnapshot.profile)
        ? false
        : prev.hasDismissedInitialSetup,
      lastSyncedAt: new Date().toISOString()
    }));
  };

  const completeInitialSetup: FinancialStoreActions['completeInitialSetup'] = async (payload) => {
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
  };

  const dismissInitialSetup: FinancialStoreActions['dismissInitialSetup'] = () => {
    persistInitialSetupDismissed(true);
    setState((prev) => ({
      ...prev,
      hasDismissedInitialSetup: true
    }));
  };

  const requestInitialSetup: FinancialStoreActions['requestInitialSetup'] = () => {
    persistInitialSetupDismissed(false);
    setState((prev) => ({
      ...prev,
      hasDismissedInitialSetup: false
    }));
  };

  const updateProfile: FinancialStoreActions['updateProfile'] = async (payload) => {
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
  };

  const addCategory: FinancialStoreActions['addCategory'] = async (payload) => {
    const now = new Date().toISOString();
    const category: Category = {
      ...payload,
      id: crypto.randomUUID(),
      isCustom: payload.isCustom ?? true,
      createdAt: now,
      updatedAt: now
    };
    await persistAndSet((snapshot) => ({
      ...snapshot,
      categories: [...snapshot.categories, category]
    }));
    return category;
  };

  const updateCategory: FinancialStoreActions['updateCategory'] = async (id, payload) => {
    await persistAndSet((snapshot) => ({
      ...snapshot,
      categories: snapshot.categories.map((category) =>
        category.id === id
          ? {
              ...category,
              ...payload,
              updatedAt: new Date().toISOString()
            }
          : category
      )
    }));
  };

  const deleteCategory: FinancialStoreActions['deleteCategory'] = async (id) => {
    await persistAndSet((snapshot) => {
      const remaining = snapshot.categories.filter((category) => category.id !== id);
      const deleted = snapshot.categories.find((category) => category.id === id);
      let fallback =
        remaining.find((category) => category.type === (deleted?.type ?? 'expense')) ?? remaining[0];
      const categories = [...remaining];
      if (!fallback) {
        const now = new Date().toISOString();
        fallback = {
          id: crypto.randomUUID(),
          name: 'Uncategorised',
          type: deleted?.type ?? 'expense',
          isCustom: true,
          createdAt: now,
          updatedAt: now
        } satisfies Category;
        categories.push(fallback);
      }
      return {
        ...snapshot,
        categories,
        transactions: snapshot.transactions.map((txn) =>
          txn.categoryId === id ? { ...txn, categoryId: undefined, updatedAt: new Date().toISOString() } : txn
        ),
        plannedExpenses: snapshot.plannedExpenses.map((item) =>
          item.categoryId === id
            ? { ...item, categoryId: fallback!.id, updatedAt: new Date().toISOString() }
            : item
        ),
        recurringExpenses: snapshot.recurringExpenses.map((item) =>
          item.categoryId === id
            ? { ...item, categoryId: fallback!.id, updatedAt: new Date().toISOString() }
            : item
        ),
        monthlyIncomes: snapshot.monthlyIncomes.map((income) =>
          income.categoryId === id
            ? { ...income, categoryId: fallback!.id, updatedAt: new Date().toISOString() }
            : income
        )
      };
    });
  };

  const addMonthlyIncome: FinancialStoreActions['addMonthlyIncome'] = async (payload) => {
    const now = new Date().toISOString();
    const income: MonthlyIncome = {
      ...payload,
      id: `income-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now
    };
    await persistAndSet((snapshot) => ({
      ...snapshot,
      monthlyIncomes: [...snapshot.monthlyIncomes, income]
    }));
    return income;
  };

  const updateMonthlyIncome: FinancialStoreActions['updateMonthlyIncome'] = async (id, payload) => {
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
  };

  const deleteMonthlyIncome: FinancialStoreActions['deleteMonthlyIncome'] = async (id) => {
    await persistAndSet((snapshot) => ({
      ...snapshot,
      monthlyIncomes: snapshot.monthlyIncomes.filter((income) => income.id !== id)
    }));
  };

  const addPlannedExpense: FinancialStoreActions['addPlannedExpense'] = async (payload) => {
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
  };

  const updatePlannedExpense: FinancialStoreActions['updatePlannedExpense'] = async (id, payload) => {
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
  };

  const deletePlannedExpense: FinancialStoreActions['deletePlannedExpense'] = async (id) => {
    await persistAndSet((snapshot) => ({
      ...snapshot,
      plannedExpenses: snapshot.plannedExpenses.filter((expense) => expense.id !== id)
    }));
  };

  const addRecurringExpense: FinancialStoreActions['addRecurringExpense'] = async (payload) => {
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
  };

  const updateRecurringExpense: FinancialStoreActions['updateRecurringExpense'] = async (id, payload) => {
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
  };

  const deleteRecurringExpense: FinancialStoreActions['deleteRecurringExpense'] = async (id) => {
    await persistAndSet((snapshot) => ({
      ...snapshot,
      recurringExpenses: snapshot.recurringExpenses.filter((expense) => expense.id !== id)
    }));
  };

  const addManualAccount: FinancialStoreActions['addManualAccount'] = async (payload) => {
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
  };

  const addManualTransaction: FinancialStoreActions['addManualTransaction'] = async (payload) => {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      ...payload,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    await persistAndSet((snapshot) => ({
      ...snapshot,
      transactions: [...snapshot.transactions, transaction]
    }));
    return transaction;
  };

  const addGoal: FinancialStoreActions['addGoal'] = async (payload) => {
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
  };

  const addSmartExportRule: FinancialStoreActions['addSmartExportRule'] = async (payload) => {
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
  };

  const deleteSmartExportRule: FinancialStoreActions['deleteSmartExportRule'] = async (id) => {
    await persistAndSet((snapshot) => ({
      ...snapshot,
      smartExportRules: snapshot.smartExportRules.filter((rule) => rule.id !== id)
    }));
  };

  const exportData: FinancialStoreActions['exportData'] = async () => {
    const blob = await exportSnapshot();
    await logExportEvent({ trigger: 'manual', format: 'json' });
    return blob;
  };

  const exportDataAsCsvAction: FinancialStoreActions['exportDataAsCsv'] = async () => {
    const blob = await exportSnapshotAsCsv();
    await logExportEvent({ trigger: 'manual', format: 'csv' });
    return blob;
  };

  const importDataAction: FinancialStoreActions['importData'] = async (file) => {
    const snapshot = await importSnapshot(file);
    const derived = deriveFromSnapshot(snapshot);
    await persistSnapshot(derived);
    setState((prev) => ({
      ...prev,
      ...derived,
      isReady: true,
      isInitialised: Boolean(derived.profile),
      hasDismissedInitialSetup: Boolean(derived.profile) ? false : prev.hasDismissedInitialSetup
    }));
  };

  const configureFirebase: FinancialStoreActions['configureFirebase'] = async (config) => {
    firebaseConfigRef.current = config;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEYS.firebase, JSON.stringify(config));
    }
    setState((prev) => ({ ...prev, firebaseStatus: { state: 'connecting' } }));
    await firebaseSyncService.configure(config, {
      onStatusChange(status, error) {
        setState((prev) => ({
          ...prev,
          firebaseStatus: { state: status, error: error?.message }
        }));
      },
      onRemoteSnapshot(remote) {
        setState((prev) => {
          const merged = mergeSnapshots(toSnapshot(prev), remote);
          void persistSnapshot(merged);
          return {
            ...prev,
            ...merged,
            isInitialised: Boolean(merged.profile),
            hasDismissedInitialSetup: Boolean(merged.profile) ? false : prev.hasDismissedInitialSetup,
            lastSyncedAt: new Date().toISOString(),
            firebaseStatus: { state: 'connected' }
          };
        });
      }
    });
  };

  const disconnectFirebase = () => {
    firebaseSyncService.stop();
    firebaseConfigRef.current = null;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEYS.firebase);
    }
    setState((prev) => ({ ...prev, firebaseStatus: { state: 'idle' } }));
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEYS.firebase);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as FirebaseSyncConfig;
        void configureFirebase(parsed);
      } catch {
        window.localStorage.removeItem(STORAGE_KEYS.firebase);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contextValue = useMemo<FinancialStoreContextValue>(
    () => ({
      ...state,
      refresh,
      completeInitialSetup,
      dismissInitialSetup,
      requestInitialSetup,
      updateProfile,
      addCategory,
      updateCategory,
      deleteCategory,
      addMonthlyIncome,
      updateMonthlyIncome,
      deleteMonthlyIncome,
      addPlannedExpense,
      updatePlannedExpense,
      deletePlannedExpense,
      addRecurringExpense,
      updateRecurringExpense,
      deleteRecurringExpense,
      addManualAccount,
      addManualTransaction,
      addGoal,
      addSmartExportRule,
      deleteSmartExportRule,
      exportData,
      exportDataAsCsv: exportDataAsCsvAction,
      importData: importDataAction,
      configureFirebase,
      disconnectFirebase
    }),
    [state]
  );

  return <FinancialStoreContext.Provider value={contextValue}>{children}</FinancialStoreContext.Provider>;
}

export function useFinancialStore() {
  const context = useContext(FinancialStoreContext);
  if (!context) {
    throw new Error('useFinancialStore must be used within FinancialStoreProvider');
  }
  return context;
}
