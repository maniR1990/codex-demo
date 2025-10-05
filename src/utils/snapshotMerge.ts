import type {
  Account,
  BudgetMonth,
  Category,
  CategoryBudgets,
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

const ensureTimestamps = <T extends Timestamped>(record: T, fallback: string): T => ({
  ...record,
  createdAt: record.createdAt ?? fallback,
  updatedAt: record.updatedAt ?? fallback
});

const mapWithTimestamps = <T extends Timestamped>(items: T[] | undefined, fallback: string): T[] =>
  (items ?? []).map((item) => ensureTimestamps(item, fallback));

const normaliseBudgetMonth = (month: BudgetMonth | undefined, key: string, fallback: string): BudgetMonth => {
  const createdAt = month?.createdAt ?? fallback;
  const updatedAt = month?.updatedAt ?? fallback;
  return {
    month: month?.month ?? key,
    createdAt,
    updatedAt,
    plannedExpenses: mapWithTimestamps(month?.plannedExpenses, fallback),
    recurringAllocations: mapWithTimestamps(month?.recurringAllocations, fallback),
    rollovers: mapWithTimestamps(month?.rollovers, fallback),
    unassignedActuals: mapWithTimestamps(month?.unassignedActuals, fallback),
    totals: {
      planned: month?.totals?.planned ?? 0,
      actual: month?.totals?.actual ?? 0,
      recurring: month?.totals?.recurring ?? 0,
      rollover: month?.totals?.rollover ?? 0,
      unassignedActuals: month?.totals?.unassignedActuals ?? 0,
      variance: month?.totals?.variance ?? 0
    }
  } satisfies BudgetMonth;
};

const normaliseBudgetMonths = (
  months: Record<string, BudgetMonth> | undefined,
  fallback: string
): Record<string, BudgetMonth> => {
  const entries = Object.entries(months ?? {});
  const normalised: Record<string, BudgetMonth> = {};
  for (const [key, month] of entries) {
    normalised[key] = normaliseBudgetMonth(month, key, fallback);
  }
  return normalised;
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

  return {
    profile,
    accounts: mapWithTimestamps<Account>(snapshot?.accounts, now),
    categories,
    transactions: mapWithTimestamps<Transaction>(snapshot?.transactions, now),
    monthlyIncomes: mapWithTimestamps<MonthlyIncome>(snapshot?.monthlyIncomes, now),
    plannedExpenses: mapWithTimestamps<PlannedExpenseItem>(snapshot?.plannedExpenses, now),
    budgetMonths: normaliseBudgetMonths(snapshot?.budgetMonths, now),
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

export function mergeSnapshots(local: FinancialSnapshot, remote: FinancialSnapshot): FinancialSnapshot {
  const baseCurrency = local.profile?.currency ?? remote.profile?.currency ?? 'INR';
  const profile = (() => {
    if (!local.profile) return remote.profile ? normaliseSnapshot({ profile: remote.profile }).profile : null;
    if (!remote.profile) return local.profile;
    return local.profile.updatedAt >= remote.profile.updatedAt ? local.profile : remote.profile;
  })();

  const mergeBudgetMonths = (
    lhs: Record<string, BudgetMonth>,
    rhs: Record<string, BudgetMonth>
  ): Record<string, BudgetMonth> => {
    const keys = new Set([...Object.keys(lhs), ...Object.keys(rhs)]);
    const merged: Record<string, BudgetMonth> = {};
    for (const key of keys) {
      const left = lhs[key];
      const right = rhs[key];
      if (!left) {
        merged[key] = right;
        continue;
      }
      if (!right) {
        merged[key] = left;
        continue;
      }
      merged[key] = left.updatedAt >= right.updatedAt ? left : right;
    }
    return merged;
  };

  return normaliseSnapshot({
    profile: profile ? { ...profile, currency: profile.currency ?? baseCurrency } : null,
    accounts: mergeCollections(local.accounts, remote.accounts),
    categories: mergeCollections(local.categories, remote.categories),
    transactions: mergeCollections(local.transactions, remote.transactions),
    monthlyIncomes: mergeCollections(local.monthlyIncomes, remote.monthlyIncomes),
    plannedExpenses: mergeCollections(local.plannedExpenses, remote.plannedExpenses),
    budgetMonths: mergeBudgetMonths(local.budgetMonths ?? {}, remote.budgetMonths ?? {}),
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
