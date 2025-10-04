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

export function SmartBudgetingView() {
  const {
    plannedExpenses,
    categories,
    transactions,
    addPlannedExpense,
    updatePlannedExpense,
    deletePlannedExpense,
    addCategory,
    updateCategory
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

  const [formState, setFormState] = useState({
    name: '',
    amount: 0,
    dueDate: formatISO(addMonths(new Date(), 1), { representation: 'date' }),
    categoryId: expenseCategories[0]?.id ?? ''
  });
  useEffect(() => {
    if (!expenseCategories.some((category) => category.id === formState.categoryId) && expenseCategories[0]) {
      setFormState((prev) => ({ ...prev, categoryId: expenseCategories[0].id }));
    }
  }, [expenseCategories, formState.categoryId]);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

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

  const categoryMonthOptions = useMemo(() => {
    const months = new Set<string>([selectedMonth, defaultMonth]);
    plannedExpenses.forEach((item) => months.add(monthKey(item.dueDate)));
    transactions
      .filter((txn) => txn.amount < 0)
      .forEach((txn) => months.add(monthKey(txn.date)));
    return Array.from(months).sort((a, b) => (a > b ? -1 : 1));
  }, [plannedExpenses, transactions, selectedMonth, defaultMonth]);

  const categoryYearOptions = useMemo(() => {
    const years = new Set<string>([selectedYear, defaultYear]);
    plannedExpenses.forEach((item) => years.add(yearKey(item.dueDate)));
    transactions
      .filter((txn) => txn.amount < 0)
      .forEach((txn) => years.add(yearKey(txn.date)));
    return Array.from(years).sort((a, b) => (a > b ? -1 : 1));
  }, [plannedExpenses, transactions, selectedYear, defaultYear]);

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

  const categorySuggestions = useMemo(() => {
    const spendByCategory = new Map<string, number>();
    periodTransactions.forEach((txn) => {
      if (txn.categoryId) {
        spendByCategory.set(txn.categoryId, (spendByCategory.get(txn.categoryId) ?? 0) + Math.abs(txn.amount));
      }
    });
    return [...expenseCategories]
      .sort((a, b) => (spendByCategory.get(b.id) ?? 0) - (spendByCategory.get(a.id) ?? 0))
      .slice(0, 5);
  }, [expenseCategories, periodTransactions]);

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
  const [navigatorFilter, setNavigatorFilter] = useState<'all' | PlannedExpenseSpendingHealth>('all');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [savingBudgetId, setSavingBudgetId] = useState<string | null>(null);
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
  const inspectorSummary = focusedCategoryId ? categorySummaries.get(focusedCategoryId) : undefined;
  const inspectorStatus: PlannedExpenseSpendingHealth | null = inspectorSummary
    ? inspectorSummary.actual === 0
      ? 'not-spent'
      : inspectorSummary.variance >= 0
      ? 'under'
      : 'over'
    : null;
  const inspectorStatusToken = inspectorStatus ? spendingBadgeStyles[inspectorStatus] : null;
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
  const isBudgetDraftInvalid =
    budgetDraft.trim() !== '' && (Number.isNaN(Number(budgetDraft)) || Number(budgetDraft) < 0);
  const isSavingBudget = savingBudgetId === focusedCategoryId;

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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await addPlannedExpense({
      name: formState.name,
      plannedAmount: Number(formState.amount),
      categoryId: formState.categoryId,
      dueDate: formState.dueDate,
      status: 'pending'
    });
    setFormState((prev) => ({ ...prev, name: '', amount: 0 }));
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const category = await addCategory({
      name: newCategoryName,
      type: 'expense',
      isCustom: true
    });
    setFormState((prev) => ({ ...prev, categoryId: category.id }));
    setNewCategoryName('');
    setIsCreatingCategory(false);
  };

  const toggleCategory = (id: string) => {
    setExpandedCategories((previous) => ({ ...previous, [id]: !previous[id] }));
  };

  const focusCategory = (id: string, expandSelf = false) => {
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
  };

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

  const handleApplyActualToBudget = () => {
    if (!inspectorSummary) return;
    setBudgetDraft(String(Math.round(Math.max(inspectorSummary.actual, 0))));
  };

  const handleIncreaseBudgetByTenPercent = () => {
    const baseValue =
      budgetDraft.trim() === ''
        ? Math.max(inspectorSummary?.planned ?? 0, 0)
        : Number(budgetDraft);
    if (Number.isNaN(baseValue)) {
      return;
    }
    const increased = Math.round(baseValue * 1.1);
    setBudgetDraft(String(increased));
  };

  const handleResetBudgetToPlan = () => {
    if (!inspectorSummary) {
      setBudgetDraft('');
      return;
    }
    setBudgetDraft(String(Math.round(Math.max(inspectorSummary.planned, 0))));
  };

  const handleSaveBudget = async () => {
    if (!focusedCategoryId || isBudgetDraftInvalid) {
      return;
    }
    const category = categoryLookup.get(focusedCategoryId);
    if (!category) {
      return;
    }
    const trimmed = budgetDraft.trim();
    const { monthly, yearly } = category.budgets ?? {};
    let budgetsPayload: Category['budgets'] | undefined;
    if (trimmed === '') {
      budgetsPayload =
        viewMode === 'monthly'
          ? typeof yearly === 'number'
            ? { yearly }
            : undefined
          : typeof monthly === 'number'
          ? { monthly }
          : undefined;
    } else {
      const numeric = Number(trimmed);
      if (Number.isNaN(numeric) || numeric < 0) {
        return;
      }
      budgetsPayload =
        viewMode === 'monthly'
          ? {
              monthly: numeric,
              ...(typeof yearly === 'number' ? { yearly } : {})
            }
          : {
              yearly: numeric,
              ...(typeof monthly === 'number' ? { monthly } : {})
            };
    }
    setSavingBudgetId(focusedCategoryId);
    try {
      await updateCategory(focusedCategoryId, { budgets: budgetsPayload });
    } finally {
      setSavingBudgetId(null);
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
    const varianceDisplay = Math.abs(detail.variance);
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

    return (
      <article
        key={detail.item.id}
        className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm"
        style={{ marginLeft: depth * 12 }}
      >
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-base font-semibold text-slate-100">{detail.item.name}</h4>
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
              {dueDateLabel}
              {statusBadge(detail.item.status)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-xs">
            <span className="font-semibold text-warning">{formatCurrency(detail.item.plannedAmount)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusToken.badgeClass}`}>
              {statusToken.label}
            </span>
          </div>
        </header>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <p className="text-[11px] uppercase text-slate-500">Planned</p>
            <p className="text-sm font-semibold text-warning">{formatCurrency(detail.item.plannedAmount)}</p>
          </div>
          <div className={`rounded-lg border border-slate-800 p-3 ${actualBackgroundClass}`}>
            <p className="text-[11px] uppercase text-slate-500">Spent</p>
            <p className={`text-sm font-semibold ${actualToneClass}`}>{formatCurrency(detail.actual)}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${statusToken.badgeClass}`}>
            {statusToken.label}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${detail.variance >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
            {varianceLabel} {formatCurrency(varianceDisplay)}
          </span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 font-semibold text-slate-300">{categoryName}</span>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Utilisation</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-800">
            <div className="h-2 rounded-full" style={{ width: `${progressWidth}%`, backgroundColor: progressColor }} />
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-[11px] text-slate-400">
          {typeof detail.item.actualAmount === 'number' && !Number.isNaN(detail.item.actualAmount)
            ? `Manual spend recorded: ${formatCurrency(detail.actual)}.`
            : detail.match
            ? `Matched with ${detail.match.description} on ${new Date(detail.match.date).toLocaleDateString('en-IN')}`
            : 'No matching transaction yet — update spent once the payment is made.'}
        </div>

        {isEditing && (
          <div className="mt-4 space-y-3 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-[11px] uppercase text-slate-500">Category</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
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
              <div>
                <label className="text-[11px] uppercase text-slate-500">Planned (₹)</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  value={editDraft.plannedAmount}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, plannedAmount: event.target.value }))}
                />
                {hasPlannedError && <p className="mt-1 text-[10px] text-danger">Enter a valid planned amount.</p>}
              </div>
              <div>
                <label className="text-[11px] uppercase text-slate-500">Spent (₹)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Auto from transactions"
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  value={editDraft.actualAmount}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, actualAmount: event.target.value }))}
                />
                {hasActualError && <p className="mt-1 text-[10px] text-danger">Enter a valid spent amount.</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSaveEdit(detail)}
                disabled={isSaveDisabled}
                className="rounded-lg bg-success px-4 py-2 text-xs font-semibold text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Leave the spent field blank to keep using the automatically matched transactions.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            className="rounded-lg bg-success/20 px-3 py-1 font-semibold text-success"
            onClick={() => updatePlannedExpense(detail.item.id, { status: 'purchased' })}
          >
            Mark purchased
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-800 px-3 py-1 text-slate-300"
            onClick={() => updatePlannedExpense(detail.item.id, { status: 'cancelled' })}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-sky-500/20 px-3 py-1 font-semibold text-sky-300"
            onClick={() => updatePlannedExpense(detail.item.id, { status: 'reconciled' })}
            disabled={detail.item.status === 'reconciled'}
          >
            Reconcile
          </button>
          <button
            type="button"
            className="rounded-lg bg-danger/20 px-3 py-1 font-semibold text-danger"
            onClick={() => deletePlannedExpense(detail.item.id)}
          >
            Delete
          </button>
          <button
            type="button"
            className="rounded-lg bg-accent/20 px-3 py-1 font-semibold text-accent"
            onClick={() => (isEditing ? handleCancelEdit() : handleStartEdit(detail))}
            disabled={isSaving}
          >
            {isEditing ? 'Close editor' : 'Edit details'}
          </button>
        </div>
      </article>
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
      <div key={category.id} className={`border-t border-slate-800 ${dimClass}`}>
        <div
          className={`grid grid-cols-[minmax(0,3fr)_minmax(140px,1fr)_minmax(120px,0.8fr)] items-center gap-4 px-4 py-3 text-sm transition hover:bg-slate-900/50 ${focusClass}`}
        >
          <div className="flex items-center gap-3" style={{ paddingLeft: indentation }}>
            <button
              type="button"
              onClick={handleToggle}
              aria-expanded={Boolean(isExpanded)}
              aria-disabled={!canExpand}
              className={`flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-900/60 text-slate-400 transition ${
                canExpand ? 'hover:border-accent hover:text-accent' : 'cursor-default opacity-50'
              }`}
            >
              <span aria-hidden className={`text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                {canExpand ? '▸' : '•'}
              </span>
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-100">{category.name}</p>
              <p className="text-[11px] text-slate-500">
                {summary.itemCount} planned item{summary.itemCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="text-right text-sm font-semibold text-warning">
            {formatCurrency(summary.planned)}
          </div>
          <div className="flex justify-end text-[11px]">
            {isFocused ? (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 font-semibold text-accent">In focus</span>
            ) : (
              <button
                type="button"
                onClick={() => focusCategory(category.id, true)}
                className="rounded-lg border border-slate-700 px-3 py-1 font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
              >
                Focus
              </button>
            )}
          </div>
        </div>
        {isExpanded && (
          <div className="bg-slate-950/40">
            {visibleDirectItems.length > 0 && (
              <div className="space-y-3 border-t border-slate-800/60 px-4 py-3">
                {visibleDirectItems.map((detail) => renderItemCard(detail, depth + 1))}
              </div>
            )}
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
  const inspectorBreadcrumb = (() => {
    if (!focusedCategoryId) return '';
    const names: string[] = [];
    const visited = new Set<string>();
    let current: string | null = focusedCategoryId;
    while (current) {
      if (visited.has(current)) break;
      visited.add(current);
      const node = categoryLookup.get(current);
      if (!node || node.type !== 'expense') {
        break;
      }
      names.unshift(node.name);
      const parent = categoryParentMap.get(current);
      current = parent ?? null;
    }
    return names.join(' › ');
  })();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Smart Budgeting & Planned Expenses</h2>
        <p className="text-sm text-slate-400">
          Build proactive shopping lists, leverage AI suggestions for categories, and reconcile budgets with actual spends.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Budget vs Actuals</h3>
            <p className="text-xs text-slate-500">Including all planned variable expenses in the selected window</p>
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

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setViewMode('monthly')}
              className={`rounded-md px-3 py-1 font-semibold ${
                viewMode === 'monthly' ? 'bg-accent text-slate-900' : 'text-slate-300'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setViewMode('yearly')}
              className={`rounded-md px-3 py-1 font-semibold ${
                viewMode === 'yearly' ? 'bg-accent text-slate-900' : 'text-slate-300'
              }`}
            >
              Yearly
            </button>
          </div>
          {viewMode === 'monthly' ? (
            <select
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              {categoryMonthOptions.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            >
              {categoryYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}
          <select
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
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
          <span className="text-slate-500">Period: {viewMode === 'monthly' ? formatMonthLabel(selectedMonth) : selectedYear}</span>
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

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Add planned expense</h4>
            <div>
              <label className="text-xs uppercase text-slate-500">Name</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase text-slate-500">Amount (₹)</label>
              <input
                type="number"
                min={0}
                required
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={formState.amount}
                onChange={(event) => setFormState((prev) => ({ ...prev, amount: Number(event.target.value) }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase text-slate-500">Due Date</label>
              <input
                type="date"
                required
                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={formState.dueDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, dueDate: event.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs uppercase text-slate-500">Category</label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <select
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                  value={formState.categoryId}
                  onChange={(event) => setFormState((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  {expenseCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory((prev) => !prev)}
                  className="rounded-lg border border-accent px-3 py-2 text-xs font-semibold text-accent sm:w-auto"
                >
                  {isCreatingCategory ? 'Cancel' : 'New Category'}
                </button>
              </div>
              {isCreatingCategory && (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                    placeholder="Category name"
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-slate-900 sm:w-auto"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-success px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400"
            >
              Add planned expense
            </button>
          </form>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">AI category suggestions</h4>
            <ul className="mt-3 space-y-3 text-sm">
              {categorySuggestions.map((category) => (
                <li
                  key={category.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-800 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>{category.name}</span>
                  <button
                    type="button"
                    onClick={() => setFormState((prev) => ({ ...prev, categoryId: category.id }))}
                    className="text-xs font-semibold text-accent"
                  >
                    Use suggestion
                  </button>
                </li>
              ))}
              {categorySuggestions.length === 0 && <p className="text-slate-500">No suggestions available.</p>}
            </ul>
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
                <div className="grid grid-cols-[minmax(0,3fr)_minmax(140px,1fr)_minmax(120px,0.8fr)] items-center gap-4 border-b border-slate-800/80 bg-slate-950 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  <span>Category</span>
                  <span className="text-right">Planned</span>
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
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Category workbench</h4>
              {inspectorCategory ? (
                <>
                  <p className="mt-1 text-xs text-slate-500">{inspectorBreadcrumb}</p>
                  {inspectorStatusToken && (
                    <span
                      className={`mt-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${inspectorStatusToken.badgeClass}`}
                    >
                      {inspectorStatusToken.label}
                    </span>
                  )}
                </>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Pick a category to see actionable insights.</p>
              )}
            </div>
            {inspectorCategory ? (
              <>
                <div className="grid gap-3 text-[11px] sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                    <p className="uppercase text-slate-500">Planned</p>
                    <p className="text-sm font-semibold text-warning">
                      {formatCurrency(inspectorSummary?.planned ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
                    <p className="uppercase text-slate-500">Actual</p>
                    <p className="text-sm font-semibold text-slate-200">
                      {formatCurrency(inspectorSummary?.actual ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 sm:col-span-2">
                    <label className="text-[11px] uppercase text-slate-500">
                      {viewMode === 'monthly' ? 'Monthly budget baseline' : 'Yearly budget baseline'}
                    </label>
                    <input
                      value={budgetDraft}
                      onChange={(event) => setBudgetDraft(event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
                      placeholder="Leave blank to clear"
                    />
                    {isBudgetDraftInvalid && (
                      <p className="mt-1 text-[10px] text-danger">
                        Enter a valid amount or leave blank to clear this baseline.
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleApplyActualToBudget}
                        className="rounded-lg border border-slate-700 px-3 py-1 font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
                      >
                        Match actual
                      </button>
                      <button
                        type="button"
                        onClick={handleIncreaseBudgetByTenPercent}
                        className="rounded-lg border border-slate-700 px-3 py-1 font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
                      >
                        +10%
                      </button>
                      <button
                        type="button"
                        onClick={handleResetBudgetToPlan}
                        className="rounded-lg border border-slate-700 px-3 py-1 font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
                      >
                        Use planned total
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleSaveBudget()}
                        disabled={isBudgetDraftInvalid || isSavingBudget}
                        className="rounded-lg bg-success px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isSavingBudget ? 'Saving…' : 'Save baseline'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setBudgetDraft('')}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>
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
              </>
            ) : (
              <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-500">
                Choose a category on the left to review baselines, overspending, and upcoming expenses.
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
