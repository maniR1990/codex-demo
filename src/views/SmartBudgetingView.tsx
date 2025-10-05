import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addMonths, format, formatISO, parseISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import type { Category, PlannedExpenseItem, Transaction } from '../types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function yearKey(date: string) {
  return date.slice(0, 4);
}

function formatMonthLabel(month: string) {
  try {
    return format(parseISO(`${month}-01`), 'MMMM yyyy');
  } catch {
    return month;
  }
}

function defaultDueDateForPeriod(viewMode: 'monthly' | 'yearly', month: string, year: string) {
  const today = new Date();
  if (viewMode === 'monthly') {
    const [yearPart, monthPart] = month.split('-');
    const safeYear = Number.parseInt(yearPart, 10);
    const safeMonth = Number.parseInt(monthPart, 10) - 1;
    if (Number.isNaN(safeYear) || Number.isNaN(safeMonth)) {
      return formatISO(today, { representation: 'date' });
    }
    const lastDayOfMonth = new Date(safeYear, safeMonth + 1, 0).getDate();
    const preferredDay = Math.min(today.getDate(), lastDayOfMonth);
    const defaultDate = new Date(safeYear, safeMonth, preferredDay);
    return formatISO(defaultDate, { representation: 'date' });
  }

  const safeYear = Number.parseInt(year, 10);
  if (Number.isNaN(safeYear)) {
    return formatISO(today, { representation: 'date' });
  }
  const defaultDate = new Date(safeYear, today.getMonth(), today.getDate());
  return formatISO(defaultDate, { representation: 'date' });
}

export function SmartBudgetingView() {
  const {
    plannedExpenses,
    categories,
    transactions,
    addPlannedExpense,
    updatePlannedExpense,
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

  type PlannedExpenseDraft = {
    id: string;
    name: string;
    amount: string;
    dueDate: string;
    categoryId: string;
  };

  const generateEntryId = () => Math.random().toString(36).slice(2);

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
    categoryId: categoryId ?? expenseCategories[0]?.id ?? ''
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
      setPlannedEntries((previous) =>
        previous.map((entry) => ({ ...entry, categoryId: '' }))
      );
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
  const categoryParentMap = useMemo(() => {
    const map = new Map<string, string | null>();
    expenseCategories.forEach((category) => {
      if (!category.parentId) {
        map.set(category.id, null);
        return;
      }
      const parent = categoryLookup.get(category.parentId);
      if (parent && parent.type === 'expense') {
        map.set(category.id, parent.id);
      } else {
        map.set(category.id, null);
      }
    });
    return map;
  }, [expenseCategories, categoryLookup]);
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
      plannedExpenses.filter(
        (item) =>
          item.status !== 'cancelled' &&
          (viewMode === 'monthly' ? monthKey(item.dueDate) === selectedMonth : yearKey(item.dueDate) === selectedYear)
      ),
    [plannedExpenses, viewMode, selectedMonth, selectedYear]
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

  const resolveCategoryIds = (categoryId: 'all' | string) => {
    if (categoryId === 'all') return allExpenseIdsSet;
    return expenseDescendantsMap.get(categoryId) ?? new Set<string>([categoryId]);
  };

  const computeTotals = (categoryId: 'all' | string) => {
    const ids = resolveCategoryIds(categoryId);
    const plannedItems = periodPlannedExpenses.filter((item) => ids.has(item.categoryId));
    const plannedFromItems = plannedItems.reduce((sum, item) => sum + item.plannedAmount, 0);
    const actualEntries = periodTransactions.filter(
      (txn) => txn.categoryId && ids.has(txn.categoryId)
    );
    const actualTotal = actualEntries.reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
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
  };

  const totalsForAll = useMemo(
    () => computeTotals('all'),
    [periodPlannedExpenses, periodTransactions, viewMode, categoryLookup, expenseDescendantsMap, allExpenseIdsSet]
  );

  const totalsForSelected = useMemo(
    () => computeTotals(selectedCategoryId),
    [selectedCategoryId, periodPlannedExpenses, periodTransactions, viewMode, categoryLookup, expenseDescendantsMap, allExpenseIdsSet]
  );

  type PlannedExpenseSpendingHealth = 'not-spent' | 'under' | 'over';

  type PlannedExpenseDetail = {
    item: PlannedExpenseItem;
    match?: Transaction;
    actual: number;
    variance: number;
    status: PlannedExpenseSpendingHealth;
  };

  type CategoryNode = Category & { children: CategoryNode[] };

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ categoryId: string; plannedAmount: string; actualAmount: string }>({
    categoryId: '',
    plannedAmount: '',
    actualAmount: ''
  });
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [quickActualDrafts, setQuickActualDrafts] = useState<Record<string, string>>({});
  const [quickActualSavingId, setQuickActualSavingId] = useState<string | null>(null);
  const [navigatorFilter, setNavigatorFilter] = useState<'all' | PlannedExpenseSpendingHealth>('all');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | null>(null);
  const navigatorFilterOptions: Array<{ key: 'all' | PlannedExpenseSpendingHealth; label: string }> = [
    { key: 'all', label: 'All statuses' },
    { key: 'over', label: 'Overspending' },
    { key: 'under', label: 'Under budget' },
    { key: 'not-spent', label: 'Awaiting spend' }
  ];
  const normalisedSearchTerm = categorySearchTerm.trim().toLowerCase();

  useEffect(() => {
    setExpandedCategories((previous) => {
      const next: Record<string, boolean> = {};
      expenseCategories.forEach((category) => {
        const parent = expenseCategories.find((candidate) => candidate.id === category.parentId);
        const isRoot = !category.parentId || !parent;
        next[category.id] = previous[category.id] ?? isRoot;
      });
      return next;
    });
  }, [expenseCategories]);

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
        const actualAmount =
          typeof item.actualAmount === 'number' && !Number.isNaN(item.actualAmount)
            ? item.actualAmount
            : matchedAmount;
        const variance = item.plannedAmount - actualAmount;
        const status: PlannedExpenseSpendingHealth =
          actualAmount === 0 ? 'not-spent' : variance >= 0 ? 'under' : 'over';
        return {
          item,
          match,
          actual: actualAmount,
          variance,
          status
        } satisfies PlannedExpenseDetail;
      })
      .sort((a, b) => new Date(a.item.dueDate).getTime() - new Date(b.item.dueDate).getTime());
  }, [periodPlannedExpenses, periodTransactions]);

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
      { planned: number; actual: number; variance: number; itemCount: number }
    >();

    expenseCategories.forEach((category) => {
      const ids = expenseDescendantsMap.get(category.id) ?? new Set<string>([category.id]);
      let planned = 0;
      let actual = 0;
      let itemCount = 0;
      ids.forEach((id) => {
        const entries = byCategory.get(id);
        if (!entries) return;
        itemCount += entries.length;
        entries.forEach((detail) => {
          planned += detail.item.plannedAmount;
          actual += detail.actual;
        });
      });
      summaries.set(category.id, {
        planned,
        actual,
        variance: planned - actual,
        itemCount
      });
    });

    return { itemsByCategory: byCategory, categorySummaries: summaries };
  }, [plannedExpenseDetails, expenseCategories, expenseDescendantsMap]);

  const categoriesWithContent = useMemo(
    () =>
      expenseCategories.filter((category) => (categorySummaries.get(category.id)?.itemCount ?? 0) > 0),
    [expenseCategories, categorySummaries]
  );

  useEffect(() => {
    if (editingItemId && !periodPlannedExpenses.some((item) => item.id === editingItemId)) {
      setEditingItemId(null);
    }
  }, [editingItemId, periodPlannedExpenses]);

  useEffect(() => {
    const fallbackCategories =
      categoriesWithContent.length > 0 ? categoriesWithContent : expenseCategories;
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
    setBudgetDraft(
      typeof budgetValue === 'number' && !Number.isNaN(budgetValue) ? String(budgetValue) : ''
    );
  }, [focusedCategoryId, categoryLookup, viewMode]);

  const spendingBadgeStyles: Record<PlannedExpenseSpendingHealth, { label: string; badgeClass: string; toneClass: string }> = {
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

  const progressColorByStatus: Record<PlannedExpenseSpendingHealth, string> = {
    'not-spent': '#38bdf8',
    under: '#10b981',
    over: '#ef4444'
  };

  const uncategorisedDetails = useMemo(
    () => plannedExpenseDetails.filter((detail) => !expenseCategoryIds.has(detail.item.categoryId)),
    [plannedExpenseDetails, expenseCategoryIds]
  );

  const visibleUncategorisedDetails = useMemo(
    () =>
      uncategorisedDetails.filter((detail) => {
        const matchesFilter = navigatorFilter === 'all' || detail.status === navigatorFilter;
        const matchesSearch =
          normalisedSearchTerm === '' || detail.item.name.toLowerCase().includes(normalisedSearchTerm);
        return matchesFilter && matchesSearch;
      }),
    [uncategorisedDetails, navigatorFilter, normalisedSearchTerm]
  );

  const overallSummary = useMemo(() => {
    const planned = plannedExpenseDetails.reduce((sum, detail) => sum + detail.item.plannedAmount, 0);
    const actual = plannedExpenseDetails.reduce((sum, detail) => sum + detail.actual, 0);
    const variance = planned - actual;
    const status: PlannedExpenseSpendingHealth =
      plannedExpenseDetails.length === 0 || actual === 0
        ? 'not-spent'
        : variance >= 0
        ? 'under'
        : 'over';
    return { planned, actual, variance, status };
  }, [plannedExpenseDetails]);

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
  const inspectorCategory = focusedCategoryId ? categoryLookup.get(focusedCategoryId) : undefined;
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
    const upcoming = inspectorDetails.filter((detail) => detail.status !== 'over');
    upcoming.sort((a, b) => new Date(a.item.dueDate).getTime() - new Date(b.item.dueDate).getTime());
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

  const updateAllCategoryExpansion = (expanded: boolean) => {
    const next: Record<string, boolean> = {};
    const visit = (nodes: CategoryNode[]) => {
      nodes.forEach((node) => {
        next[node.id] = expanded;
        if (node.children.length > 0) {
          visit(node.children);
        }
      });
    };
    visit(expenseCategoryTree);
    setExpandedCategories(next);
  };

  const expandAllCategories = () => {
    updateAllCategoryExpansion(true);
  };

  const collapseAllCategories = () => {
    updateAllCategoryExpansion(false);
  };

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
    if (!entry.dueDate) return false;
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
          dueDate: entry.dueDate,
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
  const shouldShowValidationError =
    hasAttemptedSubmit && (hasInvalidEntries || expenseCategories.length === 0);
  const canRemoveRows = plannedEntries.length > 1;

  const toggleCategory = (id: string) => {
    setExpandedCategories((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  function focusCategory(id: string, expandSelf = false) {
    setFocusedCategoryId(id);
    setExpandedCategories((previous) => {
      const next = { ...previous } as Record<string, boolean>;
      let currentParent = categoryParentMap.get(id) ?? null;
      while (currentParent) {
        next[currentParent] = true;
        currentParent = categoryParentMap.get(currentParent) ?? null;
      }
      if (expandSelf) {
        next[id] = true;
      }
      return next;
    });
  }

  const handleStartEdit = (detail: PlannedExpenseDetail) => {
    setEditingItemId(detail.item.id);
    const manualActual =
      typeof detail.item.actualAmount === 'number' && !Number.isNaN(detail.item.actualAmount)
        ? detail.item.actualAmount
        : undefined;
    setEditDraft({
      categoryId: detail.item.categoryId,
      plannedAmount: String(detail.item.plannedAmount),
      actualAmount:
        manualActual !== undefined
          ? String(manualActual)
          : detail.actual > 0
          ? String(detail.actual)
          : ''
    });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditDraft({ categoryId: '', plannedAmount: '', actualAmount: '' });
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
    if (!editDraft.categoryId || Number.isNaN(plannedValue) || plannedValue < 0) {
      return;
    }
    if (actualValue !== undefined && (Number.isNaN(actualValue) || actualValue < 0)) {
      return;
    }
    setSavingItemId(detail.item.id);
    try {
      await updatePlannedExpense(detail.item.id, {
        categoryId: editDraft.categoryId,
        plannedAmount: plannedValue,
        actualAmount: actualValue
      });
      setEditingItemId(null);
      setEditDraft({ categoryId: '', plannedAmount: '', actualAmount: '' });
    } finally {
      setSavingItemId(null);
    }
  };

  const handleFocusDetail = (detail: PlannedExpenseDetail) => {
    setNavigatorFilter('all');
    setCategorySearchTerm('');
    focusCategory(detail.item.categoryId, true);
    handleStartEdit(detail);
  };

  const renderItemCard = (detail: PlannedExpenseDetail, depth: number) => {
    const isEditing = editingItemId === detail.item.id;
    const isSaving = savingItemId === detail.item.id;
    const categoryName =
      categoryLookup.get(detail.item.categoryId)?.name ??
      categories.find((cat) => cat.id === detail.item.categoryId)?.name ??
      'Uncategorised';
    const dueDateLabel = new Date(detail.item.dueDate).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric'
    });
    const progressPercentRaw =
      detail.item.plannedAmount <= 0
        ? detail.actual > 0
          ? 100
          : 0
        : (detail.actual / detail.item.plannedAmount) * 100;
    const progressPercent = Number.isFinite(progressPercentRaw) ? progressPercentRaw : 0;
    const progressWidth = Math.max(0, Math.min(100, progressPercent));
    const progressColor = progressColorByStatus[detail.status];
    const varianceLabel = detail.variance >= 0 ? 'Saved' : 'Overspent';
    const statusToken = spendingBadgeStyles[detail.status];
    const actualToneClass = statusToken.toneClass;
    const actualBackgroundClass =
      detail.status === 'over'
        ? 'bg-danger/10'
        : detail.status === 'under'
        ? 'bg-success/10'
        : 'bg-slate-950/80';
    const isCurrentCategoryMissing =
      isEditing && editDraft.categoryId && !categoryOptions.some((option) => option.id === editDraft.categoryId);
    const parsedPlanned = Number(editDraft.plannedAmount);
    const parsedActual = editDraft.actualAmount.trim() === '' ? undefined : Number(editDraft.actualAmount);
    const hasPlannedError = isEditing && (Number.isNaN(parsedPlanned) || parsedPlanned < 0);
    const hasActualError = isEditing && parsedActual !== undefined && (Number.isNaN(parsedActual) || parsedActual < 0);
    const isSaveDisabled =
      !isEditing ||
      !editDraft.categoryId ||
      editDraft.plannedAmount.trim() === '' ||
      hasPlannedError ||
      hasActualError ||
      isSaving;
    const quickActualDraft = quickActualDrafts[detail.item.id] ?? '';
    const quickActualTrimmed = quickActualDraft.trim();
    const quickActualValue = quickActualTrimmed === '' ? undefined : Number(quickActualTrimmed);
    const hasQuickActualError =
      quickActualValue !== undefined && (Number.isNaN(quickActualValue) || quickActualValue < 0);
    const isQuickSaving = quickActualSavingId === detail.item.id;
    const quickPlaceholder =
      typeof detail.item.actualAmount === 'number' && !Number.isNaN(detail.item.actualAmount)
        ? String(detail.item.actualAmount)
        : detail.actual > 0
        ? String(detail.actual)
        : '';
    const infoMessage =
      typeof detail.item.actualAmount === 'number' && !Number.isNaN(detail.item.actualAmount)
        ? `Manual spend recorded: ${formatCurrency(detail.actual)}.`
        : detail.match
        ? `Matched with ${detail.match.description} on ${new Date(detail.match.date).toLocaleDateString('en-IN')}`
        : 'No matching transaction yet — update spent once the payment is made.';
    const remainderColor = detail.variance >= 0 ? 'text-success' : 'text-danger';

    const handleSubmitQuickActual = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!hasQuickActualError && quickActualValue !== undefined && !isQuickSaving) {
        void handleQuickActualSubmit(detail);
      }
    };

    return (
      <div
        key={detail.item.id}
        className={`border-t border-slate-800/60 ${isEditing ? 'bg-slate-950/35' : 'bg-slate-950/10 hover:bg-slate-900/30'}`}
      >
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(160px,1fr)] items-start gap-4 px-4 py-2 text-xs sm:text-sm">
          <div className="min-w-0 space-y-2" style={{ paddingLeft: depth * 16 }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-100">{detail.item.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusToken.badgeClass}`}>
                {statusToken.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
              <span>{dueDateLabel}</span>
              {statusBadge(detail.item.status)}
              <span>{categoryName}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full" style={{ width: `${progressWidth}%`, backgroundColor: progressColor }} />
            </div>
            <p className="text-[10px] text-slate-500">{infoMessage}</p>
            {isEditing && (
              <div className="pt-1">
                <label className="text-[10px] uppercase text-slate-500">Category</label>
                <select
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-100 focus:border-accent focus:outline-none"
                  value={editDraft.categoryId}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  {isCurrentCategoryMissing && (
                    <option value={detail.item.categoryId}>
                      {categories.find((cat) => cat.id === detail.item.categoryId)?.name ?? 'Uncategorised'}
                    </option>
                  )}
                  {categoryOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="text-right">
            {isEditing ? (
              <div className="space-y-1">
                <input
                  type="number"
                  min={0}
                  className={`w-full rounded-md border bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none ${
                    hasPlannedError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
                  }`}
                  value={editDraft.plannedAmount}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, plannedAmount: event.target.value }))}
                />
                {hasPlannedError && <p className="text-[10px] text-danger">Enter a valid planned amount.</p>}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-sm font-semibold text-warning">{formatCurrency(detail.item.plannedAmount)}</div>
                <div className="text-[10px] text-slate-500">Planned</div>
              </div>
            )}
          </div>
          <div className="text-right">
            {isEditing ? (
              <div className="space-y-1">
                <input
                  type="number"
                  min={0}
                  placeholder="Auto from transactions"
                  className={`w-full rounded-md border bg-slate-950/80 px-3 py-1.5 text-sm text-slate-100 focus:border-accent focus:outline-none ${
                    hasActualError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
                  }`}
                  value={editDraft.actualAmount}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, actualAmount: event.target.value }))}
                />
                {hasActualError && <p className="text-[10px] text-danger">Enter a valid spent amount.</p>}
              </div>
            ) : (
              <div className={`space-y-1 rounded-md border border-slate-800/70 px-3 py-1.5 text-right ${actualBackgroundClass}`}>
                <div className={`text-sm font-semibold ${actualToneClass}`}>{formatCurrency(detail.actual)}</div>
                <div className="text-[10px] text-slate-500">Spent</div>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className={`text-sm font-semibold ${remainderColor}`}>{formatCurrency(detail.variance)}</div>
            <div className="text-[10px] text-slate-500">{varianceLabel}</div>
            <div className="text-[10px] text-slate-500">Utilisation {Math.round(progressPercent)}%</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {!isEditing && (
              <form className="flex w-full items-center justify-end gap-2" onSubmit={handleSubmitQuickActual}>
                <input
                  type="number"
                  min={0}
                  value={quickActualDraft}
                  onChange={(event) => handleQuickActualChange(detail.item.id, event.target.value)}
                  placeholder={quickPlaceholder || 'Spent'}
                  className={`w-24 rounded-md border bg-slate-950/80 px-2 py-1 text-xs text-slate-100 focus:border-accent focus:outline-none ${
                    hasQuickActualError ? 'border-danger text-danger focus:border-danger' : 'border-slate-700'
                  }`}
                />
                <button
                  type="submit"
                  disabled={hasQuickActualError || quickActualValue === undefined || isQuickSaving}
                  className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-slate-900 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isQuickSaving ? 'Saving…' : 'Save'}
                </button>
              </form>
            )}
            {hasQuickActualError && !isEditing && (
              <p className="text-[10px] text-danger">Enter a valid amount to save.</p>
            )}
            <div className="flex flex-wrap justify-end gap-1 text-[10px]">
              <button
                type="button"
                className="rounded-full bg-success/15 px-2 py-1 font-semibold text-success hover:bg-success/25"
                onClick={() => updatePlannedExpense(detail.item.id, { status: 'purchased' })}
              >
                Purchased
              </button>
              <button
                type="button"
                className="rounded-full bg-slate-800 px-2 py-1 text-slate-300 hover:bg-slate-700"
                onClick={() => updatePlannedExpense(detail.item.id, { status: 'cancelled' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-sky-500/15 px-2 py-1 font-semibold text-sky-300 hover:bg-sky-500/25"
                onClick={() => updatePlannedExpense(detail.item.id, { status: 'reconciled' })}
                disabled={detail.item.status === 'reconciled'}
              >
                Reconcile
              </button>
              <button
                type="button"
                className="rounded-full bg-danger/15 px-2 py-1 font-semibold text-danger hover:bg-danger/25"
                onClick={() => deletePlannedExpense(detail.item.id)}
              >
                Delete
              </button>
            </div>
            {isEditing ? (
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveEdit(detail)}
                  disabled={isSaveDisabled}
                  className="rounded-md bg-success px-3 py-1 text-[11px] font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                  className="rounded-md border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-300 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleStartEdit(detail)}
                className="text-[11px] font-semibold text-accent hover:text-accent/80"
              >
                Edit details
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCategorySection = (category: CategoryNode, depth = 0): JSX.Element | null => {
    const summary = categorySummaries.get(category.id) ?? {
      planned: 0,
      actual: 0,
      variance: 0,
      itemCount: 0
    };
    const directItems = itemsByCategory.get(category.id) ?? [];
    const categoryStatus: PlannedExpenseSpendingHealth =
      summary.actual === 0 ? 'not-spent' : summary.variance >= 0 ? 'under' : 'over';
    const statusToken = spendingBadgeStyles[categoryStatus];
    const descendantIds = expenseDescendantsMap.get(category.id) ?? new Set<string>([category.id]);
    const remainderClass = summary.variance >= 0 ? 'text-success' : 'text-danger';
    const remainderLabel = summary.variance >= 0 ? 'Remaining' : 'Overspent';
    const remainderDescriptor = summary.actual === 0 ? 'Awaiting spend' : remainderLabel;
    const nextDueDetail = plannedExpenseDetails.reduce<PlannedExpenseDetail | null>((closest, detail) => {
      if (!descendantIds.has(detail.item.categoryId)) {
        return closest;
      }
      if (!closest) return detail;
      const currentTime = new Date(detail.item.dueDate).getTime();
      const closestTime = new Date(closest.item.dueDate).getTime();
      return currentTime < closestTime ? detail : closest;
    }, null);
    const nextDueLabel = nextDueDetail
      ? new Date(nextDueDetail.item.dueDate).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric'
        })
      : null;
    const matchesCategorySearch =
      normalisedSearchTerm !== '' && category.name.toLowerCase().includes(normalisedSearchTerm);
    const visibleDirectItems = directItems.filter((detail) => {
      const matchesStatus = navigatorFilter === 'all' || detail.status === navigatorFilter;
      const matchesName =
        normalisedSearchTerm === '' ||
        detail.item.name.toLowerCase().includes(normalisedSearchTerm) ||
        matchesCategorySearch;
      return matchesStatus && matchesName;
    });
    const childSections = category.children
      .map((child) => renderCategorySection(child, depth + 1))
      .filter((child): child is JSX.Element => child !== null);
    const hasVisibleItems = visibleDirectItems.length > 0;
    const hasVisibleChildren = childSections.length > 0;
    const canExpand = hasVisibleItems || hasVisibleChildren;
    const matchesStatusForCategory = navigatorFilter === 'all' || categoryStatus === navigatorFilter;

    if (!matchesStatusForCategory && !hasVisibleItems && !hasVisibleChildren && !matchesCategorySearch) {
      return null;
    }

    // Always render expense categories so they can be focused for baseline adjustments,
    // even if they don't yet have planned items in the current period.

    const isFocused = focusedCategoryId === category.id;
    const shouldAutoExpand =
      normalisedSearchTerm !== '' && (matchesCategorySearch || hasVisibleItems || hasVisibleChildren);
    const isExpanded = canExpand && (shouldAutoExpand || Boolean(expandedCategories[category.id]));
    const focusClass = isFocused ? 'bg-slate-900/70 ring-1 ring-inset ring-accent/40' : '';
    const dimClass =
      normalisedSearchTerm !== '' && !matchesCategorySearch && !hasVisibleItems && !hasVisibleChildren
        ? 'opacity-70'
        : '';
    const handleToggle = () => {
      focusCategory(category.id);
      if (canExpand) {
        toggleCategory(category.id);
      }
    };
    const indentation = depth * 20;

    return (
      <div key={category.id} className={dimClass}>
        <div
          onClick={() => focusCategory(category.id, true)}
          className={`grid cursor-pointer grid-cols-[minmax(0,3fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(160px,1fr)] items-center gap-4 border-t border-slate-800/70 px-4 py-3 text-xs sm:text-sm transition ${
            isFocused ? 'bg-slate-900/60 ring-1 ring-inset ring-accent/40' : 'bg-slate-950/20 hover:bg-slate-900/35'
          }`}
        >
          <div className="flex min-w-0 items-center gap-3" style={{ paddingLeft: indentation }}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleToggle();
              }}
              aria-expanded={Boolean(isExpanded)}
              aria-disabled={!canExpand}
              className={`flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-950/60 text-slate-400 transition ${
                canExpand ? 'hover:border-accent hover:text-accent' : 'cursor-default opacity-40'
              }`}
            >
              <span aria-hidden className={`text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                {canExpand ? '▸' : '•'}
              </span>
            </button>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-100">{category.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusToken.badgeClass}`}>
                  {statusToken.label}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                <span>
                  {summary.itemCount} planned item{summary.itemCount === 1 ? '' : 's'}
                </span>
                {nextDueLabel && <span>Next due {nextDueLabel}</span>}
              </div>
            </div>
          </div>
          <div className="text-right text-sm font-semibold text-warning">{formatCurrency(summary.planned)}</div>
          <div className="text-right text-sm font-semibold text-slate-200">{formatCurrency(summary.actual)}</div>
          <div className="text-right">
            <div className={`text-sm font-semibold ${remainderClass}`}>{formatCurrency(summary.variance)}</div>
            <div className="text-[10px] text-slate-500">{remainderDescriptor}</div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-[10px] text-slate-500">
            {nextDueLabel && (
              <span className="rounded-full bg-slate-800/70 px-2 py-0.5 text-slate-300">Next {nextDueLabel}</span>
            )}
            {canExpand && (
              <span className="text-slate-400">{isExpanded ? 'Collapse' : 'Expand'}</span>
            )}
          </div>
        </div>
        {isExpanded && (
          <div className="bg-slate-950/10">
            {visibleDirectItems.length > 0 && visibleDirectItems.map((detail) => renderItemCard(detail, depth + 1))}
            {childSections}
          </div>
        )}
      </div>
    );
  };

  const renderedCategorySections = expenseCategoryTree
    .map((category) => renderCategorySection(category))
    .filter((section): section is JSX.Element => section !== null);
  const hasNavigatorResults = renderedCategorySections.length > 0 || visibleUncategorisedDetails.length > 0;
  return (
    <div className="space-y-6">
      {isAddExpenseDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl">
            <form onSubmit={handleSubmitPlannedExpenses} className="space-y-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">Add planned expenses</h3>
                  <p className="text-sm text-slate-400">
                    Capture multiple planned expenses at once and assign them to categories.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCancelDialog}
                  className="self-start rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-slate-500"
                >
                  Close
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2 font-semibold">Name</th>
                      <th className="px-3 py-2 font-semibold">Amount (₹)</th>
                      <th className="px-3 py-2 font-semibold">Due date</th>
                      <th className="px-3 py-2 font-semibold">Category</th>
                      <th className="px-3 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {plannedEntries.map((entry, index) => {
                      const isCreatingForRow = categoryCreationTargetId === entry.id;
                      return (
                        <tr key={entry.id} className="align-top">
                          <td className="px-3 py-2">
                            <input
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                              placeholder="e.g. School fees"
                              value={entry.name}
                              onChange={(event) => handleEntryChange(entry.id, { name: event.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                              placeholder="0"
                              value={entry.amount}
                              onChange={(event) => handleEntryChange(entry.id, { amount: event.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="date"
                              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                              value={entry.dueDate}
                              onChange={(event) => handleEntryChange(entry.id, { dueDate: event.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col gap-2">
                              <select
                                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                                value={entry.categoryId}
                                onChange={(event) => handleEntryChange(entry.id, { categoryId: event.target.value })}
                                disabled={expenseCategories.length === 0}
                              >
                                <option value="" disabled>
                                  {expenseCategories.length === 0 ? 'No categories available' : 'Select category'}
                                </option>
                                {expenseCategories.map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleToggleCategoryCreation(entry.id)}
                                className="self-start text-xs font-semibold text-accent"
                              >
                                {isCreatingForRow ? 'Cancel new category' : 'New category'}
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleRemoveEntryRow(entry.id)}
                              className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100 disabled:opacity-40"
                              disabled={!canRemoveRows}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {categoryCreationTargetId && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-sm font-semibold text-slate-200">Create a new category</p>
                  <p className="text-xs text-slate-500">
                    The new category will automatically be assigned to the selected planned expense row.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                      placeholder="Category name"
                      value={newCategoryName}
                      onChange={(event) => setNewCategoryName(event.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCreateCategory}
                        className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-slate-900 disabled:opacity-50"
                        disabled={!newCategoryName.trim()}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryCreationTargetId(null);
                          setNewCategoryName('');
                        }}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {shouldShowValidationError && (
                <p className="text-sm text-danger">
                  Please complete every row or remove the ones you do not need before saving.
                </p>
              )}
              {!expenseCategories.length && (
                <p className="text-sm text-warning">
                  Add an expense category first to start planning your expenses.
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={handleAddEntryRow}
                  className="inline-flex items-center justify-center rounded-lg border border-dashed border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
                >
                  + Add another row
                </button>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handleCancelDialog}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-success px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:opacity-50"
                    disabled={
                      isSubmittingPlannedExpenses ||
                      hasInvalidEntries ||
                      expenseCategories.length === 0
                    }
                  >
                    {isSubmittingPlannedExpenses ? 'Saving...' : 'Save planned expenses'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <header>
        <h2 className="text-2xl font-semibold">Smart Budgeting & Planned Expenses</h2>
        <p className="text-sm text-slate-400">
          Build proactive shopping lists, leverage AI suggestions for categories, and reconcile budgets with actual spends.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Budget vs Actuals</h3>
              <p className="text-xs text-slate-500">Including all planned variable expenses in the selected window</p>
            </div>

            <div className="flex flex-col gap-3 text-xs text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <button
                    type="button"
                    onClick={goToPreviousPeriod}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-lg text-slate-400 transition hover:border-slate-700 hover:text-slate-100"
                    aria-label="Previous period"
                  >
                    ‹
                  </button>
                  <span className="text-base font-semibold text-slate-100 sm:text-lg">{periodLabel}</span>
                  <button
                    type="button"
                    onClick={goToNextPeriod}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-lg text-slate-400 transition hover:border-slate-700 hover:text-slate-100"
                    aria-label="Next period"
                  >
                    ›
                  </button>
                </div>
                <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1 text-[11px] font-semibold sm:text-xs">
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('monthly')}
                    className={`rounded-md px-3 py-1 transition ${
                      viewMode === 'monthly'
                        ? 'bg-accent text-slate-900'
                        : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => handleViewModeChange('yearly')}
                    className={`rounded-md px-3 py-1 transition ${
                      viewMode === 'yearly'
                        ? 'bg-accent text-slate-900'
                        : 'text-slate-300 hover:text-slate-100'
                    }`}
                  >
                    Yearly
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 sm:text-sm"
                  value={selectedCategoryId}
                  onChange={(event) => setSelectedCategoryId(event.target.value as 'all' | string)}
                >
                  <option value="all">All categories</option>
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <span className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-300">
                  Period: {periodLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm">
            Planned: <span className="font-semibold text-warning">{formatCurrency(totalsForAll.totalPlanned)}</span>{' '}
            Actual: <span className="font-semibold text-danger">{formatCurrency(totalsForAll.actualTotal)}</span>{' '}
            Variance:{' '}
            <span
              className={`font-semibold ${
                totalsForAll.totalPlanned - totalsForAll.actualTotal >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {formatCurrency(totalsForAll.totalPlanned - totalsForAll.actualTotal)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={handleOpenDialog}
            className="inline-flex items-center rounded-lg bg-success px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-emerald-400"
          >
            Add planned expense
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Planned vs Spent</h4>
            <p className="text-xs text-slate-500">
              Comparing planned items and category budgets against realised spending for the selected category.
            </p>
            <div className="mt-4 space-y-3">
              {[{ label: 'Planned', value: totalsForSelected.totalPlanned, color: '#38bdf8' }, { label: 'Actual', value: totalsForSelected.actualTotal, color: '#ef4444' }].map((item) => {
                const maxValue = Math.max(totalsForSelected.totalPlanned, totalsForSelected.actualTotal, 1);
                const width = Math.max(6, Math.min(100, (item.value / maxValue) * 100));
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{item.label}</span>
                      <span className="font-semibold text-slate-200">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="mt-1 h-3 rounded-full bg-slate-800">
                      <div
                        className="h-3 rounded-full"
                        style={{ width: `${width}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Category summary</h4>
            <p className="mt-1 text-xs text-slate-500">
              Focus: {selectedCategoryId === 'all' ? 'All expense categories' : categoryLookup.get(selectedCategoryId)?.name ?? 'Uncategorised'}
            </p>
            <dl className="mt-3 space-y-2 text-xs text-slate-300">
              <div className="flex items-center justify-between">
                <dt>Budget baseline</dt>
                <dd className="font-semibold text-warning">{formatCurrency(totalsForSelected.budgetTotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Planned items ({totalsForSelected.plannedItems.length})</dt>
                <dd className="font-semibold text-slate-200">{formatCurrency(totalsForSelected.plannedFromItems)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Actual spend ({totalsForSelected.actualEntries.length})</dt>
                <dd className="font-semibold text-danger">{formatCurrency(totalsForSelected.actualTotal)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Variance</dt>
                <dd className={`font-semibold ${totalsForSelected.totalPlanned - totalsForSelected.actualTotal >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(totalsForSelected.totalPlanned - totalsForSelected.actualTotal)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Planned Expense Navigator</h3>
            <p className="text-xs text-slate-500">
              Drill into categories, spot overspending, and update plans without leaving this screen.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Total planned</p>
              <p className="text-lg font-semibold text-warning">{formatCurrency(overallSummary.planned)}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-left">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Spent</p>
              <p className="text-lg font-semibold text-slate-200">{formatCurrency(overallSummary.actual)}</p>
            </div>
            <div
              className={`rounded-xl border px-4 py-3 text-left ${
                overallSummary.variance >= 0
                  ? 'border-success/40 bg-success/10'
                  : 'border-danger/40 bg-danger/10'
              }`}
            >
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Balance</p>
              <p
                className={`text-lg font-semibold ${
                  overallSummary.variance >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {formatCurrency(overallSummary.variance)}
              </p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide ${
                spendingBadgeStyles[overallSummary.status].badgeClass
              }`}
            >
              {spendingBadgeStyles[overallSummary.status].label}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {navigatorFilterOptions.map(({ key, label }) => {
              const isActive = navigatorFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setNavigatorFilter(key)}
                  className={`rounded-full border px-3 py-1 font-semibold transition ${
                    isActive
                      ? 'border-accent bg-accent text-slate-900'
                      : 'border-slate-700 text-slate-300 hover:border-accent hover:text-accent'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <input
                value={categorySearchTerm}
                onChange={(event) => setCategorySearchTerm(event.target.value)}
                className="w-56 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 pr-8 text-sm text-slate-200 placeholder:text-slate-500"
                placeholder="Search categories or items"
              />
              {categorySearchTerm && (
                <button
                  type="button"
                  onClick={() => setCategorySearchTerm('')}
                  className="absolute inset-y-0 right-2 text-slate-500 hover:text-accent"
                  aria-label="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={expandAllCategories}
              className="rounded-lg border border-slate-700 px-3 py-2 font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
            >
              Expand all
            </button>
            <button
              type="button"
              onClick={collapseAllCategories}
              className="rounded-lg border border-slate-700 px-3 py-2 font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
            >
              Collapse all
            </button>
          </div>
        </div>

        {overspendingCategories.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] uppercase tracking-wide text-slate-500">Hotspots:</span>
            {overspendingCategories.map(({ category, summary }) => (
              <button
                key={category.id}
                type="button"
                onClick={() => {
                  setNavigatorFilter('over');
                  setCategorySearchTerm('');
                  focusCategory(category.id, true);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-danger/40 bg-danger/10 px-3 py-1 font-semibold text-danger transition hover:border-danger/60"
              >
                {category.name}
                <span className="text-[10px] font-semibold text-danger/80">
                  {formatCurrency(Math.abs(summary.variance))}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
          <div className="space-y-4">
            {renderedCategorySections.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
                <div className="grid grid-cols-[minmax(0,3fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(160px,1fr)] items-center gap-4 border-b border-slate-800/80 bg-slate-950 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Category / Item</span>
                  <span className="text-right">Planned</span>
                  <span className="text-right">Spent</span>
                  <span className="text-right">Variance</span>
                  <span className="text-right">Actions</span>
                </div>
                <div>{renderedCategorySections}</div>
              </div>
            )}
            {visibleUncategorisedDetails.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">Uncategorised items</h4>
                    <p className="text-[11px] text-slate-500">
                      Assign a category so these expenses roll into the right budgets.
                    </p>
                  </div>
                  <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[10px] font-semibold text-warning">
                    {visibleUncategorisedDetails.length} item{visibleUncategorisedDetails.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {visibleUncategorisedDetails.map((detail) => renderItemCard(detail, 0))}
                </div>
              </div>
            )}
            {!hasNavigatorResults && (
              <p className="text-sm text-slate-500">
                No planned expenses match your filters yet. Adjust the filters or add new planned spends.
              </p>
            )}
          </div>
          <aside className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
            {inspectorCategory ? (
              <>
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overspending watchlist</h5>
                  {inspectorOverspendingItems.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {inspectorOverspendingItems.map((detail) => (
                        <li
                          key={detail.item.id}
                          className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{detail.item.name}</span>
                            <span>{formatCurrency(Math.abs(detail.variance))}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-danger/80">
                            <span>
                              Spent {formatCurrency(detail.actual)} of {formatCurrency(detail.item.plannedAmount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleFocusDetail(detail)}
                              className="font-semibold text-danger hover:underline"
                            >
                              Adjust
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No overspending yet. Keep tracking!</p>
                  )}
                </div>
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Upcoming items</h5>
                  {inspectorUpcomingItems.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {inspectorUpcomingItems.map((detail) => (
                        <li
                          key={detail.item.id}
                          className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-100">{detail.item.name}</span>
                            <span>
                              {new Date(detail.item.dueDate).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span>{formatCurrency(detail.item.plannedAmount)}</span>
                            <button
                              type="button"
                              onClick={() => handleFocusDetail(detail)}
                              className="font-semibold text-accent hover:underline"
                            >
                              Edit plan
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No upcoming items in this category.</p>
                  )}
                </div>
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">In-progress items</h5>
                  {inspectorInProgressItems.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {inspectorInProgressItems.map((detail) => (
                        <li
                          key={detail.item.id}
                          className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-100">{detail.item.name}</span>
                            {statusBadge(detail.item.status)}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                            <span>
                              Due{' '}
                              {new Date(detail.item.dueDate).toLocaleDateString('en-IN', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleFocusDetail(detail)}
                              className="font-semibold text-accent hover:underline"
                            >
                              Update
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No items currently in progress.</p>
                  )}
                </div>
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Completed items</h5>
                  {inspectorCompletedItems.length > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {inspectorCompletedItems.map((detail) => (
                        <li
                          key={detail.item.id}
                          className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-100">{detail.item.name}</span>
                            <span className="font-semibold text-success">{formatCurrency(detail.actual)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                            <span>Planned {formatCurrency(detail.item.plannedAmount)}</span>
                            <button
                              type="button"
                              onClick={() => handleFocusDetail(detail)}
                              className="font-semibold text-accent hover:underline"
                            >
                              Review
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">No completed items recorded yet.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-500">
                Choose a category on the left to review overspending, upcoming work, and progress.
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
