import type {
  Account,
  BudgetActual,
  BudgetMonth,
  BudgetMonthTotals,
  BudgetPlannedItem,
  Category,
  CategoryBudgets,
  Currency,
  ExportEvent,
  FinancialSnapshot,
  Goal,
  Insight,
  MonthlyIncome,
  PlannedExpenseItem,
  Profile,
  RecurringExpense,
  SmartExportRule,
  Timestamped,
  Transaction,
  WealthAcceleratorMetrics
} from '../types';
import { createDefaultBudgetMonth } from '../types';

const ensureTimestamps = <T extends Timestamped>(record: T, fallback: string): T => ({
  ...record,
  createdAt: record.createdAt ?? fallback,
  updatedAt: record.updatedAt ?? fallback
});

const mapWithTimestamps = <T extends Timestamped>(items: T[] | undefined, fallback: string): T[] =>
  (items ?? []).map((item) => ensureTimestamps(item, fallback));

const isValidNumber = (value: unknown): value is number => typeof value === 'number' && !Number.isNaN(value);

const normaliseMonthTotals = (
  totals: Partial<BudgetMonthTotals> | undefined,
  plannedSum: number,
  actualSum: number
): BudgetMonthTotals => {
  const planned = isValidNumber(totals?.planned) ? totals!.planned : plannedSum;
  const actual = isValidNumber(totals?.actual) ? totals!.actual : actualSum;
  const difference = isValidNumber(totals?.difference) ? totals!.difference : planned - actual;
  const rolloverFromPrevious = isValidNumber(totals?.rolloverFromPrevious)
    ? totals!.rolloverFromPrevious
    : 0;
  const rolloverToNext = isValidNumber(totals?.rolloverToNext) ? totals!.rolloverToNext : 0;

  return {
    planned,
    actual,
    difference,
    rolloverFromPrevious,
    rolloverToNext
  } satisfies BudgetMonthTotals;
};

const normaliseBudgetMonthEntry = (
  monthKey: string,
  month: Partial<BudgetMonth> | undefined,
  currency: Currency
): BudgetMonth => {
  const base = createDefaultBudgetMonth(monthKey, currency);

  const plannedItems = Array.isArray(month?.plannedItems) ? month!.plannedItems : base.plannedItems;
  const actuals = Array.isArray(month?.actuals) ? month!.actuals : base.actuals;
  const unassignedActuals = Array.isArray(month?.unassignedActuals)
    ? month!.unassignedActuals
    : base.unassignedActuals;
  const recurringAllocations = Array.isArray(month?.recurringAllocations)
    ? month!.recurringAllocations
    : base.recurringAllocations;
  const adjustments = Array.isArray(month?.adjustments) ? month!.adjustments : base.adjustments;

  const plannedSum = plannedItems.reduce(
    (sum, item) => sum + (isValidNumber(item.plannedAmount) ? item.plannedAmount : 0),
    0
  );
  const actualSum = actuals.reduce((sum, item) => sum + (isValidNumber(item.amount) ? item.amount : 0), 0);

  return {
    ...base,
    ...month,
    month: month?.month ?? monthKey,
    currency: month?.currency ?? currency,
    plannedItems,
    actuals,
    unassignedActuals,
    recurringAllocations,
    adjustments,
    totals: normaliseMonthTotals(month?.totals, plannedSum, actualSum)
  } satisfies BudgetMonth;
};

const mergeById = <T extends { id: string }>(local: T[], remote: T[]): T[] => {
  const map = new Map<string, T>();
  remote.forEach((item) => {
    map.set(item.id, item);
  });
  local.forEach((item) => {
    if (!map.has(item.id)) {
      map.set(item.id, item);
    }
  });
  return Array.from(map.values());
};

const deriveMonthKey = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  const key = value.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : fallback;
};

const createActualFromPlanned = (
  expense: PlannedExpenseItem,
  currency: Currency
): BudgetActual | null => {
  if (!isValidNumber(expense.actualAmount)) return null;
  return {
    id: `${expense.id}-actual`,
    description: expense.name,
    categoryId: expense.categoryId,
    amount: expense.actualAmount,
    currency,
    occurredOn: expense.dueDate ?? undefined
  } satisfies BudgetActual;
};

export const normaliseBudgetMonths = (
  budgetMonths: Partial<Record<string, Partial<BudgetMonth>>> | BudgetMonth[] | undefined,
  plannedExpenses: PlannedExpenseItem[] | undefined,
  currency: Currency,
  now: string
): Record<string, BudgetMonth> => {
  const monthMap = new Map<string, BudgetMonth>();

  if (Array.isArray(budgetMonths)) {
    budgetMonths.forEach((month) => {
      if (!month) return;
      const key = deriveMonthKey(month.month, now.slice(0, 7));
      monthMap.set(key, normaliseBudgetMonthEntry(key, month, currency));
    });
  } else if (budgetMonths && typeof budgetMonths === 'object') {
    Object.entries(budgetMonths).forEach(([key, month]) => {
      if (!month) return;
      const monthKey = deriveMonthKey(key || month.month, now.slice(0, 7));
      monthMap.set(monthKey, normaliseBudgetMonthEntry(monthKey, month, currency));
    });
  }

  if (monthMap.size === 0 && plannedExpenses && plannedExpenses.length > 0) {
    const fallbackMonth = now.slice(0, 7);
    plannedExpenses.forEach((expense) => {
      const monthKey = deriveMonthKey(expense.dueDate ?? undefined, fallbackMonth);
      const existing = monthMap.get(monthKey) ?? createDefaultBudgetMonth(monthKey, currency);

      const plannedItem: BudgetPlannedItem = {
        id: expense.id,
        categoryId: expense.categoryId,
        name: expense.name,
        plannedAmount: expense.plannedAmount,
        currency,
        notes: expense.notes
      } satisfies BudgetPlannedItem;

      const plannedItems = [...existing.plannedItems.filter((item) => item.id !== plannedItem.id), plannedItem];

      const actualEntry = createActualFromPlanned(expense, currency);
      const actuals = actualEntry
        ? [...existing.actuals.filter((item) => item.id !== actualEntry.id), actualEntry]
        : existing.actuals;

      const plannedSum = plannedItems.reduce((sum, item) => sum + item.plannedAmount, 0);
      const actualSum = actuals.reduce((sum, item) => sum + item.amount, 0);

      monthMap.set(monthKey, {
        ...existing,
        plannedItems,
        actuals,
        totals: {
          planned: plannedSum,
          actual: actualSum,
          difference: plannedSum - actualSum,
          rolloverFromPrevious: existing.totals.rolloverFromPrevious,
          rolloverToNext: existing.totals.rolloverToNext
        }
      });
    });
  }

  if (monthMap.size === 0) {
    const defaultMonthKey = now.slice(0, 7);
    monthMap.set(defaultMonthKey, createDefaultBudgetMonth(defaultMonthKey, currency));
  }

  return Object.fromEntries(Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0])));
};

const normaliseBudgets = (budgets?: Category['budgets']): CategoryBudgets | undefined => {
  if (!budgets) return undefined;
  const { monthly, yearly } = budgets;
  const hasMonthly = typeof monthly === 'number' && !Number.isNaN(monthly);
  const hasYearly = typeof yearly === 'number' && !Number.isNaN(yearly);
  if (!hasMonthly && !hasYearly) {
    return undefined;
  }
  return {
    ...(hasMonthly ? { monthly } : {}),
    ...(hasYearly ? { yearly } : {})
  };
};

export function normaliseSnapshot(snapshot?: Partial<FinancialSnapshot> | null): FinancialSnapshot {
  const now = new Date().toISOString();
  const baseCurrency = snapshot?.profile?.currency ?? 'INR';
  const profile = snapshot?.profile ? ensureTimestamps<Profile>(snapshot.profile, now) : null;

  const wealthMetrics: WealthAcceleratorMetrics = snapshot?.wealthMetrics
    ? {
        capitalEfficiencyScore: snapshot.wealthMetrics.capitalEfficiencyScore ?? 0,
        opportunityCostAlerts: snapshot.wealthMetrics.opportunityCostAlerts ?? [],
        insuranceGapAnalysis: snapshot.wealthMetrics.insuranceGapAnalysis ?? '',
        updatedAt: snapshot.wealthMetrics.updatedAt ?? now
      }
    : {
        capitalEfficiencyScore: 0,
        opportunityCostAlerts: [],
        insuranceGapAnalysis: '',
        updatedAt: now
      };

  const categories = mapWithTimestamps<Category>(snapshot?.categories, now).map((category) => ({
    ...category,
    tags: Array.isArray(category.tags)
      ? category.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
      : [],
    budgets: normaliseBudgets(category.budgets)
  }));

  const plannedExpenses = mapWithTimestamps<PlannedExpenseItem>(snapshot?.plannedExpenses, now);
  const budgetMonths = normaliseBudgetMonths(snapshot?.budgetMonths, plannedExpenses, baseCurrency, now);

  return {
    profile,
    accounts: mapWithTimestamps<Account>(snapshot?.accounts, now),
    categories,
    transactions: mapWithTimestamps<Transaction>(snapshot?.transactions, now),
    monthlyIncomes: mapWithTimestamps<MonthlyIncome>(snapshot?.monthlyIncomes, now),
    plannedExpenses,
    budgetMonths,
    recurringExpenses: mapWithTimestamps<RecurringExpense>(snapshot?.recurringExpenses, now),
    goals: mapWithTimestamps<Goal>(snapshot?.goals, now),
    insights: mapWithTimestamps<Insight>(snapshot?.insights, now),
    wealthMetrics,
    smartExportRules: mapWithTimestamps<SmartExportRule>(snapshot?.smartExportRules, now),
    exportHistory: mapWithTimestamps<ExportEvent>(snapshot?.exportHistory, now),
    revision: snapshot?.revision ?? 0,
    lastLocalChangeAt: snapshot?.lastLocalChangeAt ?? now
  } satisfies FinancialSnapshot;
}

const mergeCollections = <T extends Timestamped & { id: string }>(local: T[], remote: T[]): T[] => {
  const merged = new Map<string, T>();
  for (const item of remote) {
    merged.set(item.id, item);
  }
  for (const item of local) {
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      continue;
    }
    merged.set(item.id, existing.updatedAt > item.updatedAt ? existing : item);
  }
  return Array.from(merged.values()).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
};

const mergeBudgetMonths = (
  local: Record<string, BudgetMonth>,
  remote: Record<string, BudgetMonth>,
  currency: Currency,
  now: string
): Record<string, BudgetMonth> => {
  const months = new Map<string, BudgetMonth>();
  const allKeys = new Set([...Object.keys(local), ...Object.keys(remote)]);

  allKeys.forEach((key) => {
    const localMonth = local[key];
    const remoteMonth = remote[key];
    if (localMonth && !remoteMonth) {
      months.set(key, normaliseBudgetMonthEntry(key, localMonth, localMonth.currency ?? currency));
    } else if (!localMonth && remoteMonth) {
      months.set(key, normaliseBudgetMonthEntry(key, remoteMonth, remoteMonth.currency ?? currency));
    } else if (localMonth && remoteMonth) {
      const merged: Partial<BudgetMonth> = {
        ...remoteMonth,
        plannedItems: mergeById(localMonth.plannedItems, remoteMonth.plannedItems),
        actuals: mergeById(localMonth.actuals, remoteMonth.actuals),
        unassignedActuals: mergeById(localMonth.unassignedActuals, remoteMonth.unassignedActuals),
        recurringAllocations: mergeById(localMonth.recurringAllocations, remoteMonth.recurringAllocations),
        adjustments: mergeById(localMonth.adjustments, remoteMonth.adjustments),
        totals: {
          planned: remoteMonth.totals.planned,
          actual: remoteMonth.totals.actual,
          difference:
            remoteMonth.totals.difference ?? remoteMonth.totals.planned - remoteMonth.totals.actual,
          rolloverFromPrevious: remoteMonth.totals.rolloverFromPrevious,
          rolloverToNext: remoteMonth.totals.rolloverToNext
        }
      };
      months.set(
        key,
        normaliseBudgetMonthEntry(key, merged, remoteMonth.currency ?? localMonth.currency ?? currency)
      );
    }
  });

  if (months.size === 0) {
    const defaultMonthKey = now.slice(0, 7);
    months.set(defaultMonthKey, createDefaultBudgetMonth(defaultMonthKey, currency));
  }

  return Object.fromEntries(Array.from(months.entries()).sort((a, b) => a[0].localeCompare(b[0])));
};

export function mergeSnapshots(local: FinancialSnapshot, remote: FinancialSnapshot): FinancialSnapshot {
  const baseCurrency = local.profile?.currency ?? remote.profile?.currency ?? 'INR';
  const now = new Date().toISOString();
  const profile = (() => {
    if (!local.profile) return remote.profile ? normaliseSnapshot({ profile: remote.profile }).profile : null;
    if (!remote.profile) return local.profile;
    return local.profile.updatedAt >= remote.profile.updatedAt ? local.profile : remote.profile;
  })();

  return normaliseSnapshot({
    profile: profile ? { ...profile, currency: profile.currency ?? baseCurrency } : null,
    accounts: mergeCollections(local.accounts, remote.accounts),
    categories: mergeCollections(local.categories, remote.categories),
    transactions: mergeCollections(local.transactions, remote.transactions),
    monthlyIncomes: mergeCollections(local.monthlyIncomes, remote.monthlyIncomes),
    plannedExpenses: mergeCollections(local.plannedExpenses, remote.plannedExpenses),
    budgetMonths: mergeBudgetMonths(local.budgetMonths, remote.budgetMonths, baseCurrency, now),
    recurringExpenses: mergeCollections(local.recurringExpenses, remote.recurringExpenses),
    goals: mergeCollections(local.goals, remote.goals),
    insights: mergeCollections(local.insights, remote.insights),
    wealthMetrics: local.wealthMetrics.updatedAt >= remote.wealthMetrics.updatedAt ? local.wealthMetrics : remote.wealthMetrics,
    smartExportRules: mergeCollections(local.smartExportRules, remote.smartExportRules),
    exportHistory: mergeCollections(local.exportHistory, remote.exportHistory),
    revision: Math.max(local.revision, remote.revision),
    lastLocalChangeAt: new Date(
      Math.max(new Date(local.lastLocalChangeAt).getTime(), new Date(remote.lastLocalChangeAt).getTime())
    ).toISOString()
  });
}

export const normaliseMergedSnapshot = normaliseSnapshot;
