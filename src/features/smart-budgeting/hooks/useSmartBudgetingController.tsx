import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, format, formatISO, parseISO } from 'date-fns';
import { useFinancialStore } from '../../../store/FinancialStoreProvider';
import type { Category, PlannedExpenseItem, Transaction } from '../../../types';
import {
  defaultDueDateForPeriod,
  formatCurrency,
  formatMonthLabel,
  monthKey,
  yearKey
} from '../utils/format';

type PlannedExpenseSpendingHealth = 'not-spent' | 'under' | 'over';

type PlannedExpenseDraft = {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  hasDueDate: boolean;
  categoryId: string;
  priority: PlannedExpenseItem['priority'];
};

type PlannedExpenseDetail = {
  item: PlannedExpenseItem;
  match?: Transaction;
  actual: number;
  variance: number;
  status: PlannedExpenseSpendingHealth;
  remainder: number;
  priority: PlannedExpenseItem['priority'];
};

type CategoryNode = Category & { children: CategoryNode[] };

const PRIORITY_OPTIONS: Array<{ value: PlannedExpenseItem['priority']; label: string }> = [
  { value: 'high', label: 'High priority' },
  { value: 'medium', label: 'Medium priority' },
  { value: 'low', label: 'Low priority' }
];

const PRIORITY_ORDER: PlannedExpenseItem['priority'][] = ['high', 'medium', 'low'];

const PRIORITY_TOKEN_STYLES: Record<PlannedExpenseItem['priority'], { label: string; badgeClass: string }> = {
  high: { label: 'High priority', badgeClass: 'bg-danger/20 text-danger' },
  medium: { label: 'Medium priority', badgeClass: 'bg-warning/20 text-warning' },
  low: { label: 'Low priority', badgeClass: 'bg-slate-800 text-slate-300' }
};

const SPENDING_BADGE_STYLES: Record<PlannedExpenseSpendingHealth, { label: string; badgeClass: string; toneClass: string }> = {
  'not-spent': {
    label: 'Awaiting spend',
    badgeClass: 'bg-slate-800 text-slate-300',
    toneClass: 'text-slate-300'
  },
  under: {
    label: 'Spent wisely',
    badgeClass: 'bg-success/20 text-success',
    toneClass: 'text-success'
  },
  over: {
    label: 'Overspent',
    badgeClass: 'bg-danger/20 text-danger',
    toneClass: 'text-danger'
  }
};

const PROGRESS_COLOR_BY_STATUS: Record<PlannedExpenseSpendingHealth, string> = {
  'not-spent': '#38bdf8',
  under: '#10b981',
  over: '#ef4444'
};

export type SmartBudgetingColumnKey =
  | 'category'
  | 'earliestDue'
  | 'planned'
  | 'actual'
  | 'variance'
  | 'actions';

type ColumnPreferences = {
  order: SmartBudgetingColumnKey[];
  visible: Record<SmartBudgetingColumnKey, boolean>;
  widths: Record<SmartBudgetingColumnKey, string>;
};

const DEFAULT_COLUMN_PREFERENCES: ColumnPreferences = {
  order: ['category', 'earliestDue', 'planned', 'actual', 'variance', 'actions'],
  visible: {
    category: true,
    earliestDue: true,
    planned: true,
    actual: true,
    variance: true,
    actions: true
  },
  widths: {
    category: 'minmax(0,2.6fr)',
    earliestDue: 'minmax(110px,0.9fr)',
    planned: 'minmax(120px,0.9fr)',
    actual: 'minmax(120px,0.9fr)',
    variance: 'minmax(120px,0.9fr)',
    actions: 'minmax(220px,1fr)'
  }
} as const satisfies ColumnPreferences;

function generateEntryId() {
  return Math.random().toString(36).slice(2);
}

export function useSmartBudgetingController() {
  const {
    allBudgetedPlannedExpenses,
    categories,
    budgetMonthMap,
    transactions,
    profile,
    addPlannedExpense,
    updatePlannedExpense,
    updateCategory,
    deletePlannedExpense,
    addCategory
  } = useFinancialStore();

  const now = new Date();
  const defaultMonth = format(now, 'yyyy-MM');
  const defaultYear = format(now, 'yyyy');

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  );

  const [viewMode, setViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(defaultYear);
  const [selectedCategoryId, setSelectedCategoryId] = useState<'all' | string>('all');
  const [columnPreferences, setColumnPreferences] = useState<ColumnPreferences>(() => ({
    order: [...DEFAULT_COLUMN_PREFERENCES.order],
    visible: { ...DEFAULT_COLUMN_PREFERENCES.visible },
    widths: { ...DEFAULT_COLUMN_PREFERENCES.widths }
  }));

  const visibleColumns = useMemo(
    () => columnPreferences.order.filter((key) => columnPreferences.visible[key]),
    [columnPreferences.order, columnPreferences.visible]
  );

  const gridTemplateColumns = useMemo(
    () => visibleColumns.map((key) => columnPreferences.widths[key] ?? 'minmax(0,1fr)').join(' '),
    [columnPreferences.widths, visibleColumns]
  );

  const toggleColumnVisibility = useCallback((column: SmartBudgetingColumnKey) => {
    setColumnPreferences((previous) => {
      const nextVisible = { ...previous.visible, [column]: !previous.visible[column] };
      const visibleCount = previous.order.reduce(
        (count, key) => count + (nextVisible[key] ? 1 : 0),
        0
      );
      if (visibleCount === 0) {
        return previous;
      }
      return { ...previous, visible: nextVisible };
    });
  }, []);

  const resetColumnPreferences = useCallback(() => {
    setColumnPreferences({
      order: [...DEFAULT_COLUMN_PREFERENCES.order],
      visible: { ...DEFAULT_COLUMN_PREFERENCES.visible },
      widths: { ...DEFAULT_COLUMN_PREFERENCES.widths }
    });
  }, []);

  const setColumnWidth = useCallback((column: SmartBudgetingColumnKey, width: string) => {
    setColumnPreferences((previous) => ({
      ...previous,
      widths: { ...previous.widths, [column]: width || previous.widths[column] }
    }));
  }, []);

  const setColumnOrder = useCallback((nextOrder: SmartBudgetingColumnKey[]) => {
    const uniqueKeys = Array.from(new Set(nextOrder));
    if (uniqueKeys.length !== DEFAULT_COLUMN_PREFERENCES.order.length) {
      return;
    }
    setColumnPreferences((previous) => ({
      ...previous,
      order: uniqueKeys
    }));
  }, []);

  const periodLabel = useMemo(
    () => (viewMode === 'monthly' ? formatMonthLabel(selectedMonth) : selectedYear),
    [viewMode, selectedMonth, selectedYear]
  );

  const handleViewModeChange = (mode: 'monthly' | 'yearly') => {
    if (mode === viewMode) {
      return;
    }
    if (mode === 'yearly') {
      const derivedYear = selectedMonth.slice(0, 4);
      if (derivedYear) {
        setSelectedYear(derivedYear);
      }
    }
    setViewMode(mode);
  };

  const shiftPeriod = (direction: -1 | 1) => {
    if (viewMode === 'monthly') {
      try {
        const baseDate = parseISO(`${selectedMonth}-01`);
        if (Number.isNaN(baseDate.getTime())) {
          throw new Error('Invalid month');
        }
        const nextDate = addMonths(baseDate, direction);
        setSelectedMonth(format(nextDate, 'yyyy-MM'));
      } catch {
        const fallbackDate = addMonths(new Date(), direction);
        setSelectedMonth(format(fallbackDate, 'yyyy-MM'));
      }
      return;
    }

    const safeYear = Number.parseInt(selectedYear, 10);
    if (Number.isNaN(safeYear)) {
      const fallbackYear = Number.parseInt(defaultYear, 10) + direction;
      setSelectedYear(String(fallbackYear));
      return;
    }
    setSelectedYear(String(safeYear + direction));
  };

  const goToPreviousPeriod = () => shiftPeriod(-1);
  const goToNextPeriod = () => shiftPeriod(1);

  const resolveDefaultDueDate = () => {
    try {
      if (viewMode === 'monthly') {
        return formatISO(parseISO(`${selectedMonth}-01`), { representation: 'date' });
      }
      if (viewMode === 'yearly') {
        return formatISO(parseISO(`${selectedYear}-01-01`), { representation: 'date' });
      }
    } catch {
      // Fall through to the generic fallback below when parsing fails.
    }
    return formatISO(addMonths(new Date(), 1), { representation: 'date' });
  };

  const createEmptyEntry = (categoryId?: string): PlannedExpenseDraft => ({
    id: generateEntryId(),
    name: '',
    amount: '',
    dueDate: resolveDefaultDueDate(),
    hasDueDate: true,
    categoryId: categoryId ?? expenseCategories[0]?.id ?? '',
    priority: 'medium'
  });

  const [plannedEntries, setPlannedEntries] = useState<PlannedExpenseDraft[]>(() => [createEmptyEntry()]);
  const [isAddExpenseDialogOpen, setIsAddExpenseDialogOpen] = useState(false);
  const [isSubmittingPlannedExpenses, setIsSubmittingPlannedExpenses] = useState(false);
  const [categoryCreationTargetId, setCategoryCreationTargetId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  useEffect(() => {
    if (viewMode === 'monthly') {
      const derivedYear = selectedMonth.slice(0, 4);
      if (derivedYear && derivedYear !== selectedYear) {
        setSelectedYear(derivedYear);
      }
    }
  }, [selectedMonth, selectedYear, viewMode]);

  useEffect(() => {
    if (viewMode === 'yearly') {
      setSelectedMonth((previous) => {
        const parts = previous.split('-');
        const monthPart = parts[1] ? parts[1].padStart(2, '0') : format(new Date(), 'MM');
        const nextValue = `${selectedYear}-${monthPart}`;
        return nextValue === previous ? previous : nextValue;
      });
    }
  }, [selectedYear, viewMode]);

  useEffect(() => {
    if (expenseCategories.length === 0) {
      setPlannedEntries((previous) => previous.map((entry) => ({ ...entry, categoryId: '' })));
      return;
    }
    setPlannedEntries((previous) =>
      previous.map((entry) =>
        expenseCategories.some((category) => category.id === entry.categoryId)
          ? entry
          : { ...entry, categoryId: expenseCategories[0].id }
      )
    );
  }, [expenseCategories]);

  const categoryLookup = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  useEffect(() => {
    if (selectedCategoryId !== 'all' && !categoryLookup.has(selectedCategoryId)) {
      setSelectedCategoryId('all');
    }
  }, [categoryLookup, selectedCategoryId]);

  const expenseDescendantsMap = useMemo(() => {
    const childrenMap = new Map<string, string[]>();
    expenseCategories.forEach((category) => {
      if (!category.parentId) return;
      const parent = categoryLookup.get(category.parentId);
      if (!parent || parent.type !== 'expense') return;
      const list = childrenMap.get(category.parentId) ?? [];
      list.push(category.id);
      childrenMap.set(category.parentId, list);
    });
    const map = new Map<string, Set<string>>();
    const visit = (id: string): Set<string> => {
      const existing = map.get(id);
      if (existing) return existing;
      const set = new Set<string>([id]);
      (childrenMap.get(id) ?? []).forEach((childId) => {
        visit(childId).forEach((descId) => set.add(descId));
      });
      map.set(id, set);
      return set;
    };
    expenseCategories.forEach((category) => visit(category.id));
    return map;
  }, [expenseCategories, categoryLookup]);

  const allExpenseIdsSet = useMemo(() => new Set(expenseCategories.map((category) => category.id)), [expenseCategories]);

  const periodPlannedExpenses = useMemo(
    () =>
      allBudgetedPlannedExpenses.filter((item) => {
        if (item.status === 'cancelled') {
          return false;
        }
        const referenceDate = item.dueDate ?? item.createdAt;
        return viewMode === 'monthly'
          ? monthKey(referenceDate) === selectedMonth
          : yearKey(referenceDate) === selectedYear;
      }),
    [allBudgetedPlannedExpenses, viewMode, selectedMonth, selectedYear]
  );

  const periodTransactions = useMemo(
    () =>
      transactions.filter(
        (txn) =>
          txn.amount < 0 &&
          (viewMode === 'monthly' ? monthKey(txn.date) === selectedMonth : yearKey(txn.date) === selectedYear)
      ),
    [transactions, viewMode, selectedMonth, selectedYear]
  );

  const resolveCategoryIds = useCallback(
    (categoryId: 'all' | string) => {
      if (categoryId === 'all') return allExpenseIdsSet;
      return expenseDescendantsMap.get(categoryId) ?? new Set<string>([categoryId]);
    },
    [allExpenseIdsSet, expenseDescendantsMap]
  );

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    categoryId: '',
    plannedAmount: '',
    actualAmount: '',
    remainderAmount: '',
    dueDate: '',
    hasDueDate: true,
    priority: 'medium' as PlannedExpenseItem['priority']
  });
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [quickActualDrafts, setQuickActualDrafts] = useState<Record<string, string>>({});
  const [quickActualSavingId, setQuickActualSavingId] = useState<string | null>(null);
  const [navigatorFilter, setNavigatorFilter] = useState<'all' | PlannedExpenseSpendingHealth>('all');
  const [navigatorView, setNavigatorView] = useState<'category' | 'priority'>('category');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | null>(null);
  const [focusedDetailId, setFocusedDetailId] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetFeedback, setBudgetFeedback] = useState<'saved' | 'cleared' | null>(null);

  const navigatorFilterOptions: Array<{ key: 'all' | PlannedExpenseSpendingHealth; label: string }> = [
    { key: 'all', label: 'All statuses' },
    { key: 'over', label: 'Overspending' },
    { key: 'under', label: 'Under budget' },
    { key: 'not-spent', label: 'Awaiting spend' }
  ];

  const navigatorViewOptions: Array<{ key: 'category' | 'priority'; label: string }> = [
    { key: 'category', label: 'Category view' },
    { key: 'priority', label: 'Priority view' }
  ];

  const normalisedSearchTerm = categorySearchTerm.trim().toLowerCase();

  useEffect(() => {
    setBudgetError(null);
    setBudgetFeedback(null);
  }, [focusedCategoryId, viewMode]);

  const plannedExpenseDetails = useMemo<PlannedExpenseDetail[]>(() => {
    return periodPlannedExpenses
      .map((item) => {
        const match = periodTransactions.find(
          (txn) =>
            txn.categoryId === item.categoryId &&
            txn.amount < 0 &&
            Math.abs(Math.abs(txn.amount) - item.plannedAmount) <= Math.max(500, item.plannedAmount * 0.1)
        );
        const matchedAmount = match ? Math.abs(match.amount) : 0;
        const manualActual =
          typeof item.actualAmount === 'number' && !Number.isNaN(item.actualAmount) ? item.actualAmount : undefined;
        const remainderOverride =
          typeof item.remainderAmount === 'number' && !Number.isNaN(item.remainderAmount)
            ? Math.max(item.remainderAmount, 0)
            : null;
        const actualAmount =
          manualActual ??
          (remainderOverride !== null ? Math.max(item.plannedAmount - remainderOverride, 0) : matchedAmount);
        const variance = item.plannedAmount - actualAmount;
        const remainder = remainderOverride !== null ? remainderOverride : variance;
        const status: PlannedExpenseSpendingHealth = actualAmount === 0 ? 'not-spent' : variance >= 0 ? 'under' : 'over';
        return {
          item: { ...item, priority: item.priority ?? 'medium' },
          match,
          actual: actualAmount,
          variance,
          status,
          remainder,
          priority: item.priority ?? 'medium'
        } satisfies PlannedExpenseDetail;
      })
      .sort((a, b) => {
        const hasDueA = Boolean(a.item.dueDate);
        const hasDueB = Boolean(b.item.dueDate);
        if (hasDueA && hasDueB) {
          const diff = new Date(a.item.dueDate!).getTime() - new Date(b.item.dueDate!).getTime();
          if (diff !== 0) {
            return diff;
          }
        } else if (hasDueA !== hasDueB) {
          return hasDueA ? -1 : 1;
        }
        const createdDiff = new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime();
        if (createdDiff !== 0) {
          return createdDiff;
        }
        return a.item.name.localeCompare(b.item.name);
      });
  }, [periodPlannedExpenses, periodTransactions]);

  const plannedDetailsById = useMemo(
    () => new Map(plannedExpenseDetails.map((detail) => [detail.item.id, detail])),
    [plannedExpenseDetails]
  );

  useEffect(() => {
    if (focusedDetailId && !plannedDetailsById.has(focusedDetailId)) {
      setFocusedDetailId(null);
    }
  }, [focusedDetailId, plannedDetailsById]);

  const matchedTransactionIds = useMemo(
    () =>
      new Set(
        plannedExpenseDetails
          .map((detail) => detail.match?.id)
          .filter((id): id is string => typeof id === 'string')
      ),
    [plannedExpenseDetails]
  );

  const computeTotals = useCallback(
    (categoryId: 'all' | string) => {
      const ids = resolveCategoryIds(categoryId);
      const plannedItems = periodPlannedExpenses.filter((item) => ids.has(item.categoryId));
      const plannedFromItems = plannedItems.reduce((sum, item) => sum + item.plannedAmount, 0);
      const actualFromPlanned = plannedItems.reduce((sum, item) => {
        const detail = plannedDetailsById.get(item.id);
        if (detail) {
          return sum + detail.actual;
        }
        const manualActual =
          typeof item.actualAmount === 'number' && !Number.isNaN(item.actualAmount) ? item.actualAmount : 0;
        if (manualActual > 0) {
          return sum + manualActual;
        }
        const remainderOverride =
          typeof item.remainderAmount === 'number' && !Number.isNaN(item.remainderAmount)
            ? Math.max(item.remainderAmount, 0)
            : null;
        if (remainderOverride !== null) {
          return sum + Math.max(item.plannedAmount - remainderOverride, 0);
        }
        return sum;
      }, 0);
      const actualEntries = periodTransactions.filter((txn) => txn.categoryId && ids.has(txn.categoryId));
      const unmatchedActual = actualEntries.reduce(
        (sum, txn) => (matchedTransactionIds.has(txn.id) ? sum : sum + Math.abs(txn.amount)),
        0
      );
      const actualTotal = Math.max(0, actualFromPlanned + unmatchedActual);
      const budgetTotal = Array.from(ids).reduce((sum, id) => {
        const category = categoryLookup.get(id);
        if (!category) return sum;
        const budget = viewMode === 'monthly' ? category.budgets?.monthly : category.budgets?.yearly;
        return sum + (budget ?? 0);
      }, 0);
      return {
        plannedItems,
        actualEntries,
        plannedFromItems,
        budgetTotal,
        totalPlanned: plannedFromItems + budgetTotal,
        actualTotal
      };
    },
    [
      resolveCategoryIds,
      periodPlannedExpenses,
      plannedDetailsById,
      periodTransactions,
      matchedTransactionIds,
      categoryLookup,
      viewMode
    ]
  );

  const totalsForAll = useMemo(() => computeTotals('all'), [computeTotals]);

  const totalsForSelected = useMemo(() => computeTotals(selectedCategoryId), [computeTotals, selectedCategoryId]);

  const expenseCategoryTree = useMemo<CategoryNode[]>(() => {
    const nodes = new Map<string, CategoryNode>();
    expenseCategories.forEach((category) => {
      nodes.set(category.id, { ...category, children: [] });
    });
    const roots: CategoryNode[] = [];
    nodes.forEach((node) => {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    const sortNodes = (list: CategoryNode[]) => {
      list.sort((a, b) => a.name.localeCompare(b.name));
      list.forEach((child) => sortNodes(child.children));
    };
    sortNodes(roots);
    return roots;
  }, [expenseCategories]);

  const categoryOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = [];
    const walk = (nodes: CategoryNode[], depth = 0) => {
      nodes.forEach((node) => {
        const prefix = depth === 0 ? '' : `${'—'.repeat(depth)} `;
        options.push({ id: node.id, label: `${prefix}${node.name}` });
        if (node.children.length > 0) {
          walk(node.children, depth + 1);
        }
      });
    };
    walk(expenseCategoryTree);
    return options;
  }, [expenseCategoryTree]);

  const expenseCategoryIds = useMemo(() => new Set(expenseCategories.map((category) => category.id)), [expenseCategories]);

  const { itemsByCategory, categorySummaries } = useMemo(() => {
    const byCategory = new Map<string, PlannedExpenseDetail[]>();
    plannedExpenseDetails.forEach((detail) => {
      const list = byCategory.get(detail.item.categoryId) ?? [];
      list.push(detail);
      byCategory.set(detail.item.categoryId, list);
    });

    const summaries = new Map<
      string,
      { planned: number; actual: number; variance: number; itemCount: number; remainder: number }
    >();

    expenseCategories.forEach((category) => {
      const ids = expenseDescendantsMap.get(category.id) ?? new Set<string>([category.id]);
      let planned = 0;
      let actual = 0;
      let remainder = 0;
      let itemCount = 0;
      ids.forEach((id) => {
        const entries = byCategory.get(id);
        if (!entries) return;
        itemCount += entries.length;
        entries.forEach((detail) => {
          planned += detail.item.plannedAmount;
          actual += detail.actual;
          remainder += detail.remainder;
        });
      });
      summaries.set(category.id, {
        planned,
        actual,
        variance: planned - actual,
        itemCount,
        remainder
      });
    });

    return { itemsByCategory: byCategory, categorySummaries: summaries };
  }, [plannedExpenseDetails, expenseCategories, expenseDescendantsMap]);

  const categoriesWithContent = useMemo(
    () => expenseCategories.filter((category) => (categorySummaries.get(category.id)?.itemCount ?? 0) > 0),
    [expenseCategories, categorySummaries]
  );

  const activeCategoryIds = useMemo(() => {
    if (selectedCategoryId === 'all') {
      return null;
    }
    return resolveCategoryIds(selectedCategoryId);
  }, [resolveCategoryIds, selectedCategoryId]);

  const visibleNavigatorDetails = useMemo(() => {
    return plannedExpenseDetails.filter((detail) => {
      if (activeCategoryIds && !activeCategoryIds.has(detail.item.categoryId)) {
        return false;
      }
      if (navigatorFilter !== 'all' && detail.status !== navigatorFilter) {
        return false;
      }
      if (normalisedSearchTerm === '') {
        return true;
      }
      const categoryName =
        categoryLookup.get(detail.item.categoryId)?.name?.toLowerCase() ?? 'uncategorised';
      return (
        detail.item.name.toLowerCase().includes(normalisedSearchTerm) ||
        categoryName.includes(normalisedSearchTerm)
      );
    });
  }, [
    plannedExpenseDetails,
    activeCategoryIds,
    navigatorFilter,
    normalisedSearchTerm,
    categoryLookup
  ]);

  useEffect(() => {
    if (editingItemId && !periodPlannedExpenses.some((item) => item.id === editingItemId)) {
      setEditingItemId(null);
    }
  }, [editingItemId, periodPlannedExpenses]);

  useEffect(() => {
    const fallbackCategories = categoriesWithContent.length > 0 ? categoriesWithContent : expenseCategories;
    if (fallbackCategories.length === 0) {
      setFocusedCategoryId(null);
      return;
    }
    if (!focusedCategoryId || !fallbackCategories.some((category) => category.id === focusedCategoryId)) {
      setFocusedCategoryId(fallbackCategories[0].id);
    }
  }, [categoriesWithContent, expenseCategories, focusedCategoryId]);

  useEffect(() => {
    if (!focusedCategoryId) {
      setBudgetDraft('');
      return;
    }
    const category = categoryLookup.get(focusedCategoryId);
    if (!category) {
      setBudgetDraft('');
      return;
    }
    const budgetValue = viewMode === 'monthly' ? category.budgets?.monthly : category.budgets?.yearly;
    setBudgetDraft(typeof budgetValue === 'number' && !Number.isNaN(budgetValue) ? String(budgetValue) : '');
  }, [focusedCategoryId, categoryLookup, viewMode]);

  const filteredPriorityDetails = useMemo(() => {
    return plannedExpenseDetails.filter((detail) => {
      if (activeCategoryIds && !activeCategoryIds.has(detail.item.categoryId)) {
        return false;
      }
      const matchesFilter = navigatorFilter === 'all' || detail.status === navigatorFilter;
      if (!matchesFilter) {
        return false;
      }
      if (normalisedSearchTerm === '') {
        return true;
      }
      const categoryName = categoryLookup.get(detail.item.categoryId)?.name?.toLowerCase() ?? 'uncategorised';
      return (
        detail.item.name.toLowerCase().includes(normalisedSearchTerm) || categoryName.includes(normalisedSearchTerm)
      );
    });
  }, [
    plannedExpenseDetails,
    activeCategoryIds,
    navigatorFilter,
    normalisedSearchTerm,
    categoryLookup
  ]);

  const priorityGroups = useMemo(() => {
    const groups: Record<PlannedExpenseItem['priority'], PlannedExpenseDetail[]> = {
      high: [],
      medium: [],
      low: []
    };
    const timeForDetail = (detail: PlannedExpenseDetail) =>
      detail.item.dueDate ? new Date(detail.item.dueDate).getTime() : Number.POSITIVE_INFINITY;
    filteredPriorityDetails.forEach((detail) => {
      const priority = detail.priority ?? 'medium';
      groups[priority].push(detail);
    });
    PRIORITY_ORDER.forEach((priority) => {
      groups[priority].sort((a, b) => {
        const dueComparison = timeForDetail(a) - timeForDetail(b);
        if (dueComparison !== 0) {
          return dueComparison;
        }
        return a.item.name.localeCompare(b.item.name);
      });
    });
    return groups;
  }, [filteredPriorityDetails]);

  const overallSummary = useMemo(() => {
    const planned = totalsForAll.totalPlanned;
    const actual = totalsForAll.actualTotal;
    const variance = planned - actual;
    const status: PlannedExpenseSpendingHealth =
      actual <= 0 ? 'not-spent' : variance >= 0 ? 'under' : 'over';
    return { planned, actual, variance, status };
  }, [totalsForAll]);

  const overallUtilisationPercent =
    overallSummary.planned <= 0
      ? 0
      : Math.round((overallSummary.actual / overallSummary.planned) * 100);
  const overallUtilisationWidth = Math.max(0, Math.min(100, overallUtilisationPercent));

  const overspendingCategories = useMemo(() => {
    const list: Array<{
      category: Category;
      summary: { planned: number; actual: number; variance: number; itemCount: number };
    }> = [];
    expenseCategories.forEach((category) => {
      const summary = categorySummaries.get(category.id);
      if (summary && summary.itemCount > 0 && summary.variance < 0) {
        list.push({ category, summary });
      }
    });
    return list.sort((a, b) => a.summary.variance - b.summary.variance).slice(0, 3);
  }, [expenseCategories, categorySummaries]);

  const focusedCategory = focusedCategoryId ? categoryLookup.get(focusedCategoryId) ?? null : null;
  const inspectorDetails = useMemo(() => {
    if (!focusedCategoryId) {
      return [] as PlannedExpenseDetail[];
    }
    const ids = expenseDescendantsMap.get(focusedCategoryId) ?? new Set<string>([focusedCategoryId]);
    return plannedExpenseDetails.filter((detail) => ids.has(detail.item.categoryId));
  }, [focusedCategoryId, plannedExpenseDetails, expenseDescendantsMap]);

  const inspectorOverspendingItems = useMemo(() => {
    const overs = inspectorDetails.filter((detail) => detail.status === 'over');
    overs.sort((a, b) => a.variance - b.variance);
    return overs.slice(0, 3);
  }, [inspectorDetails]);

  const inspectorUpcomingItems = useMemo(() => {
    const upcoming = inspectorDetails.filter((detail) => detail.status !== 'over' && detail.item.dueDate);
    upcoming.sort((a, b) => new Date(a.item.dueDate!).getTime() - new Date(b.item.dueDate!).getTime());
    return upcoming.slice(0, 3);
  }, [inspectorDetails]);

  const inspectorInProgressItems = useMemo(() => {
    const inProgress = inspectorDetails.filter(
      (detail) => detail.item.status === 'pending' || detail.item.status === 'purchased'
    );
    inProgress.sort((a, b) => new Date(a.item.dueDate).getTime() - new Date(b.item.dueDate).getTime());
    return inProgress.slice(0, 3);
  }, [inspectorDetails]);

  const inspectorCompletedItems = useMemo(() => {
    const completed = inspectorDetails.filter((detail) => detail.item.status === 'reconciled');
    completed.sort((a, b) => new Date(b.item.dueDate).getTime() - new Date(a.item.dueDate).getTime());
    return completed.slice(0, 3);
  }, [inspectorDetails]);

  const statusBadge = (status: PlannedExpenseItem['status']) => {
    const baseClass = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide';
    switch (status) {
      case 'pending':
        return <span className={`${baseClass} bg-warning/20 text-warning`}>Pending</span>;
      case 'purchased':
        return <span className={`${baseClass} bg-sky-500/20 text-sky-300`}>Purchased</span>;
      case 'reconciled':
        return <span className={`${baseClass} bg-success/20 text-success`}>Reconciled</span>;
      case 'cancelled':
      default:
        return <span className={`${baseClass} bg-danger/20 text-danger`}>Cancelled</span>;
    }
  };

  const resetPlannedEntries = () => setPlannedEntries([createEmptyEntry()]);

  const isEntryValid = (entry: PlannedExpenseDraft) => {
    if (!entry.name.trim()) return false;
    if (entry.amount.trim() === '') return false;
    const numericAmount = Number(entry.amount);
    if (Number.isNaN(numericAmount) || numericAmount < 0) return false;
    if (entry.hasDueDate && !entry.dueDate) return false;
    if (!entry.categoryId) return false;
    return true;
  };

  const handleEntryChange = (id: string, patch: Partial<PlannedExpenseDraft>) => {
    setPlannedEntries((previous) => previous.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const handleAddEntryRow = () => {
    setPlannedEntries((previous) => [...previous, createEmptyEntry()]);
  };

  const handleRemoveEntryRow = (id: string) => {
    setPlannedEntries((previous) => {
      if (previous.length <= 1) {
        return [createEmptyEntry()];
      }
      return previous.filter((entry) => entry.id !== id);
    });
    setCategoryCreationTargetId((previous) => (previous === id ? null : previous));
  };

  const handleToggleCategoryCreation = (id: string) => {
    setCategoryCreationTargetId((previous) => {
      const next = previous === id ? null : id;
      setNewCategoryName('');
      return next;
    });
  };

  const handleSubmitPlannedExpenses = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    if (expenseCategories.length === 0) {
      return;
    }
    const hasInvalidEntries = plannedEntries.some((entry) => !isEntryValid(entry));
    if (hasInvalidEntries) {
      return;
    }
    setIsSubmittingPlannedExpenses(true);
    try {
      for (const entry of plannedEntries) {
        await addPlannedExpense({
          name: entry.name.trim(),
          plannedAmount: Number(entry.amount),
          categoryId: entry.categoryId,
          dueDate: entry.hasDueDate ? entry.dueDate : null,
          priority: entry.priority,
          status: 'pending'
        });
      }
      resetPlannedEntries();
      setCategoryCreationTargetId(null);
      setNewCategoryName('');
      setHasAttemptedSubmit(false);
      setIsAddExpenseDialogOpen(false);
    } finally {
      setIsSubmittingPlannedExpenses(false);
    }
  };

  const handleOpenDialog = () => {
    if (plannedEntries.length === 0) {
      resetPlannedEntries();
    }
    setHasAttemptedSubmit(false);
    setCategoryCreationTargetId(null);
    setNewCategoryName('');
    setIsAddExpenseDialogOpen(true);
  };

  const handleCancelDialog = () => {
    setIsAddExpenseDialogOpen(false);
    setCategoryCreationTargetId(null);
    setNewCategoryName('');
    setHasAttemptedSubmit(false);
    resetPlannedEntries();
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const category = await addCategory({
      name: newCategoryName.trim(),
      type: 'expense',
      isCustom: true
    });
    setPlannedEntries((previous) =>
      previous.map((entry) =>
        categoryCreationTargetId && entry.id === categoryCreationTargetId
          ? { ...entry, categoryId: category.id }
          : entry
      )
    );
    setNewCategoryName('');
    setCategoryCreationTargetId(null);
  };

  const hasInvalidEntries = plannedEntries.some((entry) => !isEntryValid(entry));
  const shouldShowValidationError = hasAttemptedSubmit && (hasInvalidEntries || expenseCategories.length === 0);
  const canRemoveRows = plannedEntries.length > 1;

  function focusCategory(id: string) {
    setFocusedCategoryId(id);
    setFocusedDetailId((previous) => {
      if (!previous) {
        return null;
      }
      const detail = plannedDetailsById.get(previous);
      return detail && detail.item.categoryId === id ? previous : null;
    });
  }

  const handleSummaryScopeChange = (value: 'all' | string) => {
    setSelectedCategoryId(value);
    if (value !== 'all') {
      focusCategory(value);
    }
  };

  const handleMonthInputChange = (value: string) => {
    if (!value) {
      setSelectedMonth(defaultMonth);
      return;
    }
    setSelectedMonth(value);
  };

  const handleYearInputChange = (value: string) => {
    if (!value) {
      setSelectedYear(defaultYear);
      return;
    }
    const sanitised = value.replace(/[^0-9]/g, '').slice(0, 4);
    setSelectedYear(sanitised || defaultYear);
  };

  const handleResetFilters = () => {
    setNavigatorFilter('all');
    setNavigatorView('category');
    setCategorySearchTerm('');
    setSelectedCategoryId('all');
  };

  const handleBudgetDraftChange = (value: string) => {
    setBudgetDraft(value);
    setBudgetError(null);
    setBudgetFeedback(null);
  };

  const applyBudgetDraft = async (rawValue: string) => {
    if (isSavingBudget) {
      return;
    }
    if (!focusedCategory) {
      setBudgetError('Choose a category in the navigator to set a baseline budget.');
      return;
    }
    const trimmed = rawValue.trim();
    const budgetKey = viewMode === 'monthly' ? 'monthly' : 'yearly';
    const nextBudgets: Category['budgets'] = { ...(focusedCategory.budgets ?? {}) };
    if (trimmed === '') {
      delete nextBudgets[budgetKey];
    } else {
      const numericValue = Number(trimmed);
      if (Number.isNaN(numericValue) || numericValue < 0) {
        setBudgetError('Enter a valid amount to save.');
        return;
      }
      nextBudgets[budgetKey] = numericValue;
    }
    setIsSavingBudget(true);
    setBudgetError(null);
    setBudgetFeedback(null);
    try {
      await updateCategory(focusedCategory.id, { budgets: nextBudgets });
      setBudgetFeedback(trimmed === '' ? 'cleared' : 'saved');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleBudgetSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await applyBudgetDraft(budgetDraft);
  };

  const handleBudgetClear = async () => {
    if (!focusedCategory) {
      setBudgetError('Choose a category in the navigator to set a baseline budget.');
      return;
    }
    setBudgetDraft('');
    await applyBudgetDraft('');
  };

  const handleStartEdit = (detail: PlannedExpenseDetail) => {
    setEditingItemId(detail.item.id);
    setFocusedDetailId(detail.item.id);
    setFocusedCategoryId(detail.item.categoryId);
    const manualActual =
      typeof detail.item.actualAmount === 'number' && !Number.isNaN(detail.item.actualAmount)
        ? detail.item.actualAmount
        : undefined;
    const fallbackDate = formatISO(parseISO(detail.item.createdAt), { representation: 'date' });
    const remainderSource =
      typeof detail.item.remainderAmount === 'number' && !Number.isNaN(detail.item.remainderAmount)
        ? detail.item.remainderAmount
        : detail.remainder > 0
        ? detail.remainder
        : undefined;
    setEditDraft({
      categoryId: detail.item.categoryId,
      plannedAmount: String(detail.item.plannedAmount),
      actualAmount:
        manualActual !== undefined
          ? String(manualActual)
          : detail.actual > 0
          ? String(detail.actual)
          : '',
      remainderAmount:
        remainderSource !== undefined && remainderSource > 0 ? String(remainderSource) : '',
      dueDate: detail.item.dueDate ?? fallbackDate,
      hasDueDate: Boolean(detail.item.dueDate),
      priority: detail.item.priority ?? 'medium'
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditDraft({
      categoryId: '',
      plannedAmount: '',
      actualAmount: '',
      remainderAmount: '',
      dueDate: '',
      hasDueDate: true,
      priority: 'medium'
    });
  };

  const handleQuickActualChange = (id: string, value: string) => {
    setQuickActualDrafts((previous) => ({ ...previous, [id]: value }));
  };

  const handleQuickActualSubmit = async (detail: PlannedExpenseDetail) => {
    const rawValue = (quickActualDrafts[detail.item.id] ?? '').trim();
    if (rawValue === '') {
      return;
    }
    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue) || numericValue < 0) {
      return;
    }
    setQuickActualSavingId(detail.item.id);
    try {
      await updatePlannedExpense(detail.item.id, { actualAmount: numericValue });
      setQuickActualDrafts((previous) => ({ ...previous, [detail.item.id]: '' }));
    } finally {
      setQuickActualSavingId(null);
    }
  };

  const handleSaveEdit = async (detail: PlannedExpenseDetail) => {
    const plannedValue = Number(editDraft.plannedAmount);
    const trimmedActual = editDraft.actualAmount.trim();
    const actualValue = trimmedActual === '' ? undefined : Number(trimmedActual);
    const trimmedRemainder = editDraft.remainderAmount.trim();
    const remainderValue = trimmedRemainder === '' ? null : Number(trimmedRemainder);
    const requiresDueDate = editDraft.hasDueDate && editDraft.dueDate.trim() === '';
    if (!editDraft.categoryId || Number.isNaN(plannedValue) || plannedValue < 0) {
      return;
    }
    if (actualValue !== undefined && (Number.isNaN(actualValue) || actualValue < 0)) {
      return;
    }
    if (remainderValue !== null && (Number.isNaN(remainderValue) || remainderValue < 0 || remainderValue > plannedValue)) {
      return;
    }
    if (requiresDueDate) {
      return;
    }
    setSavingItemId(detail.item.id);
    try {
      let nextActualValue = actualValue;
      if (remainderValue !== null) {
        nextActualValue = Math.max(plannedValue - remainderValue, 0);
      }
      await updatePlannedExpense(detail.item.id, {
        categoryId: editDraft.categoryId,
        plannedAmount: plannedValue,
        actualAmount: nextActualValue,
        remainderAmount: remainderValue,
        priority: editDraft.priority,
        dueDate: editDraft.hasDueDate
          ? editDraft.dueDate || detail.item.dueDate || formatISO(new Date(), { representation: 'date' })
          : null
      });
      setEditingItemId(null);
      setEditDraft({
        categoryId: '',
        plannedAmount: '',
        actualAmount: '',
        remainderAmount: '',
        dueDate: '',
        hasDueDate: true,
        priority: 'medium'
      });
    } finally {
      setSavingItemId(null);
    }
  };

  const handleFocusDetail = (detail: PlannedExpenseDetail) => {
    setNavigatorFilter('all');
    setCategorySearchTerm('');
    setNavigatorView('category');
    setFocusedCategoryId(detail.item.categoryId);
    setFocusedDetailId(detail.item.id);
    if (activeCategoryIds && !activeCategoryIds.has(detail.item.categoryId)) {
      setSelectedCategoryId('all');
    }
    handleStartEdit(detail);
  };

  const summaryPeriodLabel = viewMode === 'monthly' ? 'Monthly' : 'Yearly';
  const summaryPeriodDescriptor = viewMode === 'monthly' ? 'month' : 'year';
  const overallStatusToken = SPENDING_BADGE_STYLES[overallSummary.status];
  const selectedCategoryLabel =
    selectedCategoryId === 'all'
      ? 'All categories'
      : categoryLookup.get(selectedCategoryId)?.name ?? 'All categories';
  const selectedCategoryVariance = totalsForSelected.totalPlanned - totalsForSelected.actualTotal;
  const selectedCategoryStatus: PlannedExpenseSpendingHealth =
    totalsForSelected.actualTotal === 0
      ? 'not-spent'
      : selectedCategoryVariance >= 0
      ? 'under'
      : 'over';
  const selectedStatusToken = SPENDING_BADGE_STYLES[selectedCategoryStatus];
  const baselineLabel = viewMode === 'monthly' ? 'Monthly baseline (₹)' : 'Yearly baseline (₹)';
  const hasNavigatorResults =
    visibleNavigatorDetails.length > 0 || filteredPriorityDetails.length > 0;

  const tableConfig = useMemo(
    () => ({
      columnPreferences,
      visibleColumns,
      gridTemplateColumns,
      toggleColumnVisibility,
      resetColumnPreferences,
      setColumnOrder,
      setColumnWidth
    }),
    [
      columnPreferences,
      gridTemplateColumns,
      resetColumnPreferences,
      setColumnOrder,
      setColumnWidth,
      toggleColumnVisibility,
      visibleColumns
    ]
  );

  const schema = useMemo(() => {
    const categoryEntities = Object.fromEntries(categories.map((category) => [category.id, category]));
    const plannedExpenseEntities = Object.fromEntries(
      allBudgetedPlannedExpenses.map((item) => [item.id, item])
    );
    const transactionEntities = Object.fromEntries(transactions.map((txn) => [txn.id, txn]));
    const budgetMonthEntities = Object.fromEntries(
      Object.entries(budgetMonthMap).map(([key, month]) => [
        key,
        {
          month: key,
          plannedExpenses: month.plannedItems.map((item) => item.id),
          plannedItems: [],
          actuals: month.actuals.map((item) => item.id),
          unassignedActuals: month.unassignedActuals.map((item) => item.id),
          adjustments: month.adjustments.map((item) => item.id),
          recurringAllocations: month.recurringAllocations.map((item) => item.id),
          rollovers: Array.isArray((month as unknown as { rollovers?: { id: string }[] }).rollovers)
            ? ((month as unknown as { rollovers: { id: string }[] }).rollovers.map((entry) => entry.id))
            : [],
          totals: month.totals
        }
      ])
    );
    const plannedExpenseIdsByCategory = Object.fromEntries(
      Array.from(itemsByCategory.entries()).map(([key, list]) => [
        key,
        list.map((detail) => detail.item.id)
      ])
    );
    const categorySummariesIndex = Object.fromEntries(
      Array.from(categorySummaries.entries()).map(([key, summary]) => [key, { ...summary }])
    );
    const categoryDescendantsIndex = Object.fromEntries(
      Array.from(expenseDescendantsMap.entries()).map(([key, set]) => [key, Array.from(set)])
    );
    const nextDueByCategory = Object.fromEntries(
      Array.from(itemsByCategory.entries())
        .map(([key, list]) => {
          const next = list
            .filter((detail) => Boolean(detail.item.dueDate))
            .reduce<PlannedExpenseDetail | null>((closest, detail) => {
              if (!detail.item.dueDate) return closest;
              if (!closest || !closest.item.dueDate) {
                return detail;
              }
              const currentTime = new Date(detail.item.dueDate).getTime();
              const closestTime = new Date(closest.item.dueDate).getTime();
              return currentTime < closestTime ? detail : closest;
            }, null);
          if (!next || !next.item.dueDate) {
            return null;
          }
          return [key, { plannedExpenseId: next.item.id, dueDate: next.item.dueDate }];
        })
        .filter((entry): entry is [string, { plannedExpenseId: string; dueDate: string }] => Boolean(entry))
    );
    const tablePeriod =
      viewMode === 'monthly'
        ? { mode: 'monthly' as const, month: selectedMonth }
        : { mode: 'yearly' as const, year: selectedYear };
    return {
      entities: {
        categories: categoryEntities,
        plannedExpenses: plannedExpenseEntities,
        transactions: transactionEntities,
        budgetMonths: budgetMonthEntities
      },
      collections: {
        budgetMonthByPeriod: {
          [`monthly:${selectedMonth}`]: selectedMonth,
          [`yearly:${selectedYear}`]: selectedYear
        }
      },
      indices: {
        plannedExpenseIdsByCategory,
        categorySummaries: categorySummariesIndex,
        categoryDescendants: categoryDescendantsIndex,
        nextDueByCategory
      },
      views: {
        smartBudgetingTable: {
          period: tablePeriod,
          rows: categoriesWithContent.map((category) => category.id),
          visibleDetailIds: plannedExpenseDetails.map((detail) => detail.item.id),
          columnOrder: [...columnPreferences.order]
        }
      },
      uiState: {
        smartBudgeting: {
          period: {
            viewMode,
            selectedMonth,
            selectedYear,
            focusedCategoryId
          },
          filters: {
            navigatorFilter,
            navigatorView,
            searchTerm: categorySearchTerm,
            selectedCategoryId
          },
          dialog: {
            isOpen: isAddExpenseDialogOpen,
            entries: plannedEntries,
            hasAttemptedSubmit,
            categoryCreationTargetId,
            newCategoryName
          },
          columnPreferences: {
            order: [...columnPreferences.order],
            visible: { ...columnPreferences.visible },
            widths: { ...columnPreferences.widths }
          },
          editing: {
            editingItemId,
            draft: editDraft,
            quickActualDrafts: { ...quickActualDrafts }
          }
        }
      }
    };
  }, [
    allBudgetedPlannedExpenses,
    budgetMonthMap,
    categories,
    categoriesWithContent,
    categoryCreationTargetId,
    categorySearchTerm,
    categorySummaries,
    columnPreferences.order,
    columnPreferences.visible,
    columnPreferences.widths,
    editDraft,
    expenseDescendantsMap,
    focusedCategoryId,
    hasAttemptedSubmit,
    isAddExpenseDialogOpen,
    itemsByCategory,
    navigatorFilter,
    navigatorView,
    plannedEntries,
    plannedExpenseDetails,
    quickActualDrafts,
    selectedCategoryId,
    selectedMonth,
    selectedYear,
    transactions,
    viewMode
  ]);

  return {
    utils: {
      formatCurrency,
      PRIORITY_OPTIONS,
      PRIORITY_TOKEN_STYLES,
      SPENDING_BADGE_STYLES,
      PROGRESS_COLOR_BY_STATUS,
      statusBadge
    },
    period: {
      viewMode,
      selectedMonth,
      selectedYear,
      periodLabel,
      summaryPeriodLabel,
      summaryPeriodDescriptor,
      handleViewModeChange,
      goToNextPeriod,
      goToPreviousPeriod,
      handleMonthInputChange,
      handleYearInputChange
    },
    dialog: {
      isOpen: isAddExpenseDialogOpen,
      open: handleOpenDialog,
      close: handleCancelDialog,
      entries: plannedEntries,
      canRemoveRows,
      isSubmitting: isSubmittingPlannedExpenses,
      handleSubmit: handleSubmitPlannedExpenses,
      handleAddEntryRow,
      handleRemoveEntryRow,
      handleEntryChange,
      shouldShowValidationError,
      expenseCategories,
      categoryCreationTargetId,
      handleToggleCategoryCreation,
      newCategoryName,
      setNewCategoryName,
      handleCreateCategory,
      resolveDefaultDueDate,
      PRIORITY_OPTIONS
    },
    categories: {
      options: categoryOptions,
      lookup: categoryLookup,
      focusCategory,
      categorySummaries,
      itemsByCategory,
      expenseDescendantsMap,
      expenseCategoryIds,
      visibleNavigatorDetails,
      navigatorFilter,
      setNavigatorFilter,
      navigatorFilterOptions,
      navigatorView,
      setNavigatorView,
      navigatorViewOptions,
      categorySearchTerm,
      setCategorySearchTerm,
      normalisedSearchTerm,
      priorityGroups,
      visibleCategoryDetails: plannedExpenseDetails,
      focusedCategoryId,
      setFocusedCategoryId,
      focusedDetailId,
      setFocusedDetailId,
      selectedCategoryId,
      handleSummaryScopeChange,
      selectedCategoryLabel,
      totalsForSelected,
      selectedCategoryStatus,
      selectedStatusToken,
      selectedCategoryVariance,
      hasNavigatorResults,
      setSelectedCategoryId,
      handleResetFilters
    },
    overview: {
      totalsForAll,
      overallSummary,
      overallStatusToken,
      overallUtilisationPercent,
      overallUtilisationWidth,
      periodLabel,
      summaryPeriodLabel,
      summaryPeriodDescriptor,
      overspendingCategories
    },
    inspector: {
      baselineLabel,
      focusedCategory,
      budgetDraft,
      setBudgetDraft: handleBudgetDraftChange,
      handleBudgetSubmit,
      handleBudgetClear,
      isSavingBudget,
      budgetError,
      budgetFeedback,
      inspectorDetails,
      inspectorOverspendingItems,
      inspectorUpcomingItems,
      inspectorInProgressItems,
      inspectorCompletedItems,
      handleFocusDetail
    },
    editing: {
      editingItemId,
      editDraft,
      setEditDraft,
      savingItemId,
      quickActualDrafts,
      quickActualSavingId,
      handleStartEdit,
      handleCancelEdit,
      handleQuickActualChange,
      handleQuickActualSubmit,
      handleSaveEdit,
      deletePlannedExpense,
      updatePlannedExpense
    },
    table: tableConfig,
    schema
  };
}

export type SmartBudgetingController = ReturnType<typeof useSmartBudgetingController>;
export type { PlannedExpenseDetail, PlannedExpenseSpendingHealth, CategoryNode };
