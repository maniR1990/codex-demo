import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Account,
  Category,
  FinancialSnapshot,
  Goal,
  Insight,
  MonthlyIncome,
  PlannedExpenseItem,
  RecurringExpense,
  Transaction
} from '../types';
import { dataAggregationService } from '../services/dataAggregationService';
import { exportSnapshot, importSnapshot, loadSnapshot, persistSnapshot } from '../services/indexedDbService';

interface FinancialStoreState extends FinancialSnapshot {
  isReady: boolean;
  isSyncing: boolean;
  lastSyncedAt?: string;
}

const defaultState: FinancialStoreState = {
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
    insuranceGapAnalysis: ''
  },
  connections: [],
  isReady: false,
  isSyncing: false
};

interface FinancialStoreActions {
  refresh(): Promise<void>;
  addCategory(payload: Omit<Category, 'id'>): Promise<Category>;
  updateCategory(id: string, payload: Partial<Category>): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  addMonthlyIncome(payload: Omit<MonthlyIncome, 'id'>): Promise<MonthlyIncome>;
  updateMonthlyIncome(id: string, payload: Partial<MonthlyIncome>): Promise<void>;
  deleteMonthlyIncome(id: string): Promise<void>;
  addPlannedExpense(payload: Omit<PlannedExpenseItem, 'id' | 'status'> & { status?: PlannedExpenseItem['status'] }): Promise<PlannedExpenseItem>;
  updatePlannedExpense(id: string, payload: Partial<PlannedExpenseItem>): Promise<void>;
  deletePlannedExpense(id: string): Promise<void>;
  addRecurringExpense(payload: Omit<RecurringExpense, 'id'>): Promise<RecurringExpense>;
  updateRecurringExpense(id: string, payload: Partial<RecurringExpense>): Promise<void>;
  deleteRecurringExpense(id: string): Promise<void>;
  addManualAccount(payload: Omit<Account, 'id' | 'isManual'>): Promise<Account>;
  addManualTransaction(payload: Omit<Transaction, 'id' | 'isRecurringMatch' | 'isPlannedMatch'>): Promise<Transaction>;
  addGoal(payload: Omit<Goal, 'id'>): Promise<Goal>;
  exportData(): Promise<Blob>;
  importData(file: Blob): Promise<void>;
}

type FinancialStoreContextValue = FinancialStoreState & FinancialStoreActions;

const FinancialStoreContext = createContext<FinancialStoreContextValue | undefined>(undefined);

export function FinancialStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinancialStoreState>(defaultState);

  useEffect(() => {
    (async () => {
      const snapshot = await loadSnapshot();
      if (snapshot) {
        setState((prev) => ({
          ...prev,
          ...snapshot,
          monthlyIncomes: snapshot.monthlyIncomes ?? [],
          isReady: true
        }));
      } else {
        await refresh();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toSnapshot = (state: FinancialStoreState): FinancialSnapshot => ({
    accounts: state.accounts,
    categories: state.categories,
    transactions: state.transactions,
    monthlyIncomes: state.monthlyIncomes,
    plannedExpenses: state.plannedExpenses,
    recurringExpenses: state.recurringExpenses,
    goals: state.goals,
    insights: state.insights,
    wealthMetrics: state.wealthMetrics,
    connections: state.connections
  });

  const persistAndSet = async (updater: (state: FinancialStoreState) => FinancialStoreState) => {
    setState((prev) => {
      const nextState = updater(prev);
      void persistSnapshot(toSnapshot(nextState));
      return nextState;
    });
  };

  const refresh = async () => {
    setState((prev) => ({ ...prev, isSyncing: true }));
    const snapshot = await dataAggregationService.aggregate({
      manualAccounts: state.accounts.filter((acct) => acct.isManual),
      manualTransactions: state.transactions.filter(
        (txn) => txn.accountId !== 'acct-hdfc-savings' && txn.accountId !== 'acct-zerodha-invest'
      ),
      manualCategories: state.categories.filter((cat) => cat.isCustom),
      manualMonthlyIncomes: state.monthlyIncomes.filter((income) => income.id.startsWith('custom-'))
    });
    setState((prev) => ({ ...prev, ...snapshot, isReady: true, isSyncing: false, lastSyncedAt: new Date().toISOString() }));
  };

  const addCategory: FinancialStoreActions['addCategory'] = async (payload) => {
    const newCategory: Category = {
      ...payload,
      id: crypto.randomUUID(),
      isCustom: true
    };
    await persistAndSet((prev) => ({
      ...prev,
      categories: [...prev.categories, newCategory]
    }));
    return newCategory;
  };

  const updateCategory: FinancialStoreActions['updateCategory'] = async (id, payload) => {
    await persistAndSet((prev) => ({
      ...prev,
      categories: prev.categories.map((category) => (category.id === id ? { ...category, ...payload } : category))
    }));
  };

  const deleteCategory: FinancialStoreActions['deleteCategory'] = async (id) => {
    await persistAndSet((prev) => {
      const remainingCategories = prev.categories.filter((category) => category.id !== id);
      const deletedCategory = prev.categories.find((category) => category.id === id);
      let fallbackCategory =
        remainingCategories.find((category) => category.type === (deletedCategory?.type ?? 'expense')) ??
        remainingCategories[0];
      const categories = [...remainingCategories];
      if (!fallbackCategory) {
        fallbackCategory = {
          id: crypto.randomUUID(),
          name: 'Uncategorised',
          type: deletedCategory?.type ?? 'expense',
          isCustom: true
        } satisfies Category;
        categories.push(fallbackCategory);
      }
      return {
        ...prev,
        categories,
        transactions: prev.transactions.map((txn) =>
          txn.categoryId === id ? { ...txn, categoryId: undefined } : txn
        ),
        plannedExpenses: prev.plannedExpenses.map((item) =>
          item.categoryId === id
            ? {
                ...item,
                categoryId: fallbackCategory.id
              }
            : item
        ),
        recurringExpenses: prev.recurringExpenses.map((item) =>
          item.categoryId === id
            ? {
                ...item,
                categoryId: fallbackCategory.id
              }
            : item
        ),
        monthlyIncomes: prev.monthlyIncomes.map((income) =>
          income.categoryId === id
            ? {
                ...income,
                categoryId: fallbackCategory.id
              }
            : income
        )
      };
    });
  };

  const addMonthlyIncome: FinancialStoreActions['addMonthlyIncome'] = async (payload) => {
    const newIncome: MonthlyIncome = {
      ...payload,
      id: `custom-${crypto.randomUUID()}`
    };
    await persistAndSet((prev) => ({
      ...prev,
      monthlyIncomes: [...prev.monthlyIncomes, newIncome]
    }));
    return newIncome;
  };

  const updateMonthlyIncome: FinancialStoreActions['updateMonthlyIncome'] = async (id, payload) => {
    await persistAndSet((prev) => ({
      ...prev,
      monthlyIncomes: prev.monthlyIncomes.map((income) => (income.id === id ? { ...income, ...payload } : income))
    }));
  };

  const deleteMonthlyIncome: FinancialStoreActions['deleteMonthlyIncome'] = async (id) => {
    await persistAndSet((prev) => ({
      ...prev,
      monthlyIncomes: prev.monthlyIncomes.filter((income) => income.id !== id)
    }));
  };

  const addPlannedExpense: FinancialStoreActions['addPlannedExpense'] = async (payload) => {
    const newItem: PlannedExpenseItem = {
      id: crypto.randomUUID(),
      status: payload.status ?? 'pending',
      ...payload
    };
    await persistAndSet((prev) => ({
      ...prev,
      plannedExpenses: [...prev.plannedExpenses, newItem]
    }));
    return newItem;
  };

  const updatePlannedExpense: FinancialStoreActions['updatePlannedExpense'] = async (id, payload) => {
    await persistAndSet((prev) => ({
      ...prev,
      plannedExpenses: prev.plannedExpenses.map((item) => (item.id === id ? { ...item, ...payload } : item))
    }));
  };

  const deletePlannedExpense: FinancialStoreActions['deletePlannedExpense'] = async (id) => {
    await persistAndSet((prev) => ({
      ...prev,
      plannedExpenses: prev.plannedExpenses.filter((item) => item.id !== id)
    }));
  };

  const addRecurringExpense: FinancialStoreActions['addRecurringExpense'] = async (payload) => {
    const newItem: RecurringExpense = { id: crypto.randomUUID(), ...payload };
    await persistAndSet((prev) => ({
      ...prev,
      recurringExpenses: [...prev.recurringExpenses, newItem]
    }));
    return newItem;
  };

  const updateRecurringExpense: FinancialStoreActions['updateRecurringExpense'] = async (id, payload) => {
    await persistAndSet((prev) => ({
      ...prev,
      recurringExpenses: prev.recurringExpenses.map((item) => (item.id === id ? { ...item, ...payload } : item))
    }));
  };

  const deleteRecurringExpense: FinancialStoreActions['deleteRecurringExpense'] = async (id) => {
    await persistAndSet((prev) => ({
      ...prev,
      recurringExpenses: prev.recurringExpenses.filter((item) => item.id !== id)
    }));
  };

  const addManualAccount: FinancialStoreActions['addManualAccount'] = async (payload) => {
    const newAccount: Account = {
      ...payload,
      id: crypto.randomUUID(),
      isManual: true
    };
    await persistAndSet((prev) => ({
      ...prev,
      accounts: [...prev.accounts, newAccount]
    }));
    return newAccount;
  };

  const addManualTransaction: FinancialStoreActions['addManualTransaction'] = async (payload) => {
    const newTransaction: Transaction = {
      ...payload,
      id: crypto.randomUUID()
    };
    await persistAndSet((prev) => ({
      ...prev,
      transactions: [...prev.transactions, newTransaction]
    }));
    return newTransaction;
  };

  const addGoal: FinancialStoreActions['addGoal'] = async (payload) => {
    const newGoal: Goal = {
      ...payload,
      id: crypto.randomUUID()
    };
    await persistAndSet((prev) => ({
      ...prev,
      goals: [...prev.goals, newGoal]
    }));
    return newGoal;
  };

  const exportData = async () => exportSnapshot();

  const importData = async (file: Blob) => {
    const snapshot = await importSnapshot(file);
    setState((prev) => ({
      ...prev,
      ...snapshot,
      monthlyIncomes: snapshot.monthlyIncomes ?? [],
      isReady: true,
      lastSyncedAt: new Date().toISOString()
    }));
  };

  const value = useMemo<FinancialStoreContextValue>(
    () => ({
      ...state,
      refresh,
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
      exportData,
      importData
    }),
    [state]
  );

  return <FinancialStoreContext.Provider value={value}>{children}</FinancialStoreContext.Provider>;
}

export function useFinancialStore() {
  const context = useContext(FinancialStoreContext);
  if (!context) {
    throw new Error('useFinancialStore must be used within FinancialStoreProvider');
  }
  return context;
}
