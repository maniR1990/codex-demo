import { FormEvent, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import type { Category, PlannedExpenseItem, Transaction } from '../types';

const categoryTypes: Category['type'][] = ['income', 'expense', 'asset', 'liability'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

interface CategorySummary {
  totalSpent: number;
  totalIncome: number;
  plannedTotal: number;
  transactions: Transaction[];
  plannedItems: PlannedExpenseItem[];
}

interface CategoryDraftForm {
  id: string;
  name: string;
  type: Category['type'];
  parentId: string;
  tags: string;
  monthlyBudget: string;
  yearlyBudget: string;
}

function createBlankDraft(type: Category['type'] = 'income'): CategoryDraftForm {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    type,
    parentId: '',
    tags: '',
    monthlyBudget: '',
    yearlyBudget: ''
  };
}

function monthKey(date?: string | null) {
  return date ? date.slice(0, 7) : '';
}

function yearKey(date?: string | null) {
  return date ? date.slice(0, 4) : '';
}

function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  categories.forEach((category) => {
    nodes.set(category.id, { category, children: [] });
  });

  const roots: CategoryNode[] = [];
  nodes.forEach((node) => {
    const parentId = node.category.parentId;
    if (parentId && nodes.has(parentId)) {
      const parentNode = nodes.get(parentId)!;
      if (parentNode.category.type === node.category.type) {
        parentNode.children.push(node);
        return;
      }
    }
    roots.push(node);
  });

  const sortNodes = (items: CategoryNode[]) => {
    items.sort((a, b) => a.category.name.localeCompare(b.category.name));
    items.forEach((item) => sortNodes(item.children));
  };

  sortNodes(roots);
  return roots;
}

function buildDescendantMap(roots: CategoryNode[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const traverse = (node: CategoryNode): Set<string> => {
    const ids = new Set<string>([node.category.id]);
    node.children.forEach((child) => {
      const childIds = traverse(child);
      childIds.forEach((id) => ids.add(id));
    });
    map.set(node.category.id, ids);
    return ids;
  };
  roots.forEach((root) => traverse(root));
  return map;
}

function formatMonthLabel(month: string) {
  try {
    return format(parseISO(`${month}-01`), 'MMMM yyyy');
  } catch {
    return month;
  }
}

export function IncomeManagementView() {
  const {
    monthlyIncomes,
    categories,
    transactions,
    plannedExpenses,
    addMonthlyIncome,
    updateMonthlyIncome,
    deleteMonthlyIncome,
    addCategory,
    updateCategory,
    deleteCategory
  } = useFinancialStore();

  const now = new Date();
  const defaultMonth = format(now, 'yyyy-MM');
  const defaultYear = format(now, 'yyyy');

  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === 'income'),
    [categories]
  );

  const [incomeViewMode, setIncomeViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedIncomeMonth, setSelectedIncomeMonth] = useState(defaultMonth);
  const [selectedIncomeYear, setSelectedIncomeYear] = useState(defaultYear);

  const [categoryViewMode, setCategoryViewMode] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedCategoryMonth, setSelectedCategoryMonth] = useState(defaultMonth);
  const [selectedCategoryYear, setSelectedCategoryYear] = useState(defaultYear);

  const [incomeForm, setIncomeForm] = useState({
    source: '',
    amount: 0,
    receivedOn: `${defaultMonth}-01`,
    categoryId: incomeCategories[0]?.id ?? '',
    notes: ''
  });

  useEffect(() => {
    if (!incomeForm.categoryId && incomeCategories[0]) {
      setIncomeForm((prev) => ({ ...prev, categoryId: incomeCategories[0].id }));
    }
  }, [incomeCategories, incomeForm.categoryId]);

  useEffect(() => {
    setIncomeForm((prev) => ({
      ...prev,
      receivedOn: incomeViewMode === 'monthly' ? `${selectedIncomeMonth}-01` : `${selectedIncomeYear}-01-01`
    }));
  }, [incomeViewMode, selectedIncomeMonth, selectedIncomeYear]);

  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editingIncomeState, setEditingIncomeState] = useState({
    source: '',
    amount: 0,
    receivedOn: `${defaultMonth}-01`,
    categoryId: '',
    notes: ''
  });

  const availableIncomeMonths = useMemo(() => {
    const months = new Set<string>([selectedIncomeMonth, defaultMonth]);
    monthlyIncomes.forEach((income) => months.add(monthKey(income.receivedOn)));
    return Array.from(months).sort((a, b) => (a > b ? -1 : 1));
  }, [monthlyIncomes, selectedIncomeMonth, defaultMonth]);

  const availableIncomeYears = useMemo(() => {
    const years = new Set<string>([selectedIncomeYear, defaultYear]);
    monthlyIncomes.forEach((income) => years.add(yearKey(income.receivedOn)));
    return Array.from(years).sort((a, b) => (a > b ? -1 : 1));
  }, [monthlyIncomes, selectedIncomeYear, defaultYear]);

  const categoryMonthOptions = useMemo(() => {
    const months = new Set<string>([selectedCategoryMonth, defaultMonth]);
    transactions.forEach((txn) => months.add(monthKey(txn.date)));
    plannedExpenses.forEach((item) => months.add(monthKey(item.dueDate ?? item.createdAt)));
    return Array.from(months).sort((a, b) => (a > b ? -1 : 1));
  }, [transactions, plannedExpenses, selectedCategoryMonth, defaultMonth]);

  const categoryYearOptions = useMemo(() => {
    const years = new Set<string>([selectedCategoryYear, defaultYear]);
    transactions.forEach((txn) => years.add(yearKey(txn.date)));
    plannedExpenses.forEach((item) => years.add(yearKey(item.dueDate ?? item.createdAt)));
    return Array.from(years).sort((a, b) => (a > b ? -1 : 1));
  }, [transactions, plannedExpenses, selectedCategoryYear, defaultYear]);

  const filteredIncomes = useMemo(
    () =>
      monthlyIncomes.filter((income) =>
        incomeViewMode === 'monthly'
          ? monthKey(income.receivedOn) === selectedIncomeMonth
          : yearKey(income.receivedOn) === selectedIncomeYear
      ),
    [monthlyIncomes, incomeViewMode, selectedIncomeMonth, selectedIncomeYear]
  );

  const incomeSummary = useMemo(
    () => filteredIncomes.reduce((sum, income) => sum + income.amount, 0),
    [filteredIncomes]
  );

  const totalCommittedIncome = useMemo(
    () => monthlyIncomes.reduce((sum, income) => sum + income.amount, 0),
    [monthlyIncomes]
  );

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryState, setEditingCategoryState] = useState({
    name: '',
    type: 'income' as Category['type'],
    parentId: '',
    tags: '',
    monthlyBudget: '',
    yearlyBudget: ''
  });

  const categoryTrees = useMemo(() => buildCategoryTree(categories), [categories]);
  const categoryTreesByType = useMemo(
    () =>
      categoryTypes.map((type) => ({
        type,
        nodes: categoryTrees.filter((node) => node.category.type === type)
      })),
    [categoryTrees]
  );

  const descendantMap = useMemo(() => buildDescendantMap(categoryTrees), [categoryTrees]);
  const categoryLookup = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const categoryBudgetMap = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((category) => {
      const budget = categoryViewMode === 'monthly' ? category.budgets?.monthly : category.budgets?.yearly;
      if (typeof budget === 'number') {
        map.set(category.id, budget);
      }
    });
    return map;
  }, [categories, categoryViewMode]);

  const relevantTransactions = useMemo(
    () =>
      transactions.filter((txn) =>
        categoryViewMode === 'monthly'
          ? monthKey(txn.date) === selectedCategoryMonth
          : yearKey(txn.date) === selectedCategoryYear
      ),
    [transactions, categoryViewMode, selectedCategoryMonth, selectedCategoryYear]
  );

  const relevantPlannedExpenses = useMemo(
    () =>
      plannedExpenses.filter((item) =>
        categoryViewMode === 'monthly'
          ? monthKey(item.dueDate ?? item.createdAt) === selectedCategoryMonth
          : yearKey(item.dueDate ?? item.createdAt) === selectedCategoryYear
      ),
    [plannedExpenses, categoryViewMode, selectedCategoryMonth, selectedCategoryYear]
  );

  const transactionMap = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    relevantTransactions.forEach((txn) => {
      if (!txn.categoryId) return;
      const items = map.get(txn.categoryId) ?? [];
      items.push(txn);
      map.set(txn.categoryId, items);
    });
    return map;
  }, [relevantTransactions]);

  const plannedMap = useMemo(() => {
    const map = new Map<string, PlannedExpenseItem[]>();
    relevantPlannedExpenses.forEach((item) => {
      const items = map.get(item.categoryId) ?? [];
      items.push(item);
      map.set(item.categoryId, items);
    });
    return map;
  }, [relevantPlannedExpenses]);

  const summariseNode = useMemo(
    () =>
      (node: CategoryNode): CategorySummary => {
        const queue: CategoryNode[] = [node];
        let totalSpent = 0;
        let totalIncome = 0;
        let plannedTotal = 0;
        const transactionsList: Transaction[] = [];
        const plannedList: PlannedExpenseItem[] = [];

        while (queue.length > 0) {
          const current = queue.shift()!;
          const txns = transactionMap.get(current.category.id) ?? [];
          txns.forEach((txn) => {
            if (txn.amount < 0) {
              totalSpent += Math.abs(txn.amount);
            } else {
              totalIncome += txn.amount;
            }
            transactionsList.push(txn);
          });

          const plannedItems = plannedMap.get(current.category.id) ?? [];
          plannedItems.forEach((item) => {
            plannedTotal += item.plannedAmount;
            plannedList.push(item);
          });

          const budget = categoryBudgetMap.get(current.category.id);
          if (typeof budget === 'number') {
            plannedTotal += budget;
          }

          queue.push(...current.children);
        }

        transactionsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        plannedList.sort((a, b) => {
          const hasDueA = Boolean(a.dueDate);
          const hasDueB = Boolean(b.dueDate);
          if (hasDueA && hasDueB) {
            const diff = new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime();
            if (diff !== 0) {
              return diff;
            }
          } else if (hasDueA !== hasDueB) {
            return hasDueA ? -1 : 1;
          }
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });

        return {
          totalSpent,
          totalIncome,
          plannedTotal,
          transactions: transactionsList,
          plannedItems: plannedList
        };
      },
    [transactionMap, plannedMap, categoryBudgetMap]
  );

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<'income' | 'category'>('income');
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState<CategoryDraftForm[]>([]);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const ensureNodeExpanded = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: true }));
  };

  const openCreatePanel = () => {
    setIsCreatePanelOpen(true);
    setCategoryDrafts((prev) => (prev.length > 0 ? prev : [createBlankDraft()]));
  };

  const closeCreatePanel = () => {
    setIsCreatePanelOpen(false);
    setCategoryDrafts([]);
  };

  function updateDraft<Key extends keyof CategoryDraftForm>(
    id: string,
    key: Key,
    value: CategoryDraftForm[Key]
  ) {
    setCategoryDrafts((prev) => prev.map((draft) => (draft.id === id ? { ...draft, [key]: value } : draft)));
  }

  const addDraftRow = () => {
    setCategoryDrafts((prev) => {
      const lastType = prev[prev.length - 1]?.type ?? 'income';
      return [...prev, createBlankDraft(lastType)];
    });
  };

  const removeDraftRow = (id: string) => {
    setCategoryDrafts((prev) => prev.filter((draft) => draft.id !== id));
  };

  const handleIncomeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await addMonthlyIncome({
      source: incomeForm.source,
      amount: Number(incomeForm.amount),
      receivedOn: incomeForm.receivedOn,
      categoryId: incomeForm.categoryId || incomeCategories[0]?.id || '',
      notes: incomeForm.notes || undefined
    });
    setIncomeForm((prev) => ({ ...prev, source: '', amount: 0, notes: '' }));
  };

  const startEditingIncome = (incomeId: string) => {
    const income = monthlyIncomes.find((item) => item.id === incomeId);
    if (!income) return;
    setEditingIncomeId(incomeId);
    setEditingIncomeState({
      source: income.source,
      amount: income.amount,
      receivedOn: income.receivedOn.slice(0, 10),
      categoryId: income.categoryId,
      notes: income.notes ?? ''
    });
  };

  const handleIncomeUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingIncomeId) return;
    await updateMonthlyIncome(editingIncomeId, {
      source: editingIncomeState.source,
      amount: Number(editingIncomeState.amount),
      receivedOn: editingIncomeState.receivedOn,
      categoryId: editingIncomeState.categoryId,
      notes: editingIncomeState.notes || undefined
    });
    setEditingIncomeId(null);
  };

  const handleCreateCategories = async (event: FormEvent) => {
    event.preventDefault();
    const draftsToCreate = categoryDrafts.filter((draft) => draft.name.trim());
    if (draftsToCreate.length === 0) return;

    const created: Category[] = [];

    for (const draft of draftsToCreate) {
      const tags = draft.tags
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);
      const monthlyBudget = draft.monthlyBudget.trim() ? Number(draft.monthlyBudget) : undefined;
      const yearlyBudget = draft.yearlyBudget.trim() ? Number(draft.yearlyBudget) : undefined;

      const category = await addCategory({
        name: draft.name,
        type: draft.type,
        parentId: draft.parentId || undefined,
        tags,
        budgets:
          monthlyBudget !== undefined || yearlyBudget !== undefined
            ? {
                ...(monthlyBudget !== undefined ? { monthly: monthlyBudget } : {}),
                ...(yearlyBudget !== undefined ? { yearly: yearlyBudget } : {})
              }
            : undefined,
        isCustom: true
      });

      created.push(category);
    }

    const lastIncomeCategory = [...created].reverse().find((category) => category.type === 'income');
    if (lastIncomeCategory) {
      setIncomeForm((prev) => ({ ...prev, categoryId: lastIncomeCategory.id }));
    }

    const defaultType = draftsToCreate[draftsToCreate.length - 1]?.type ?? 'income';
    setCategoryDrafts([createBlankDraft(defaultType)]);
    setIsCreatePanelOpen(false);
  };

  const startEditingCategory = (categoryId: string) => {
    const category = categoryLookup.get(categoryId);
    if (!category) return;
    setEditingCategoryId(categoryId);
    ensureNodeExpanded(categoryId);
    setEditingCategoryState({
      name: category.name,
      type: category.type,
      parentId: category.parentId ?? '',
      tags: category.tags.join(', '),
      monthlyBudget: category.budgets?.monthly !== undefined ? String(category.budgets.monthly) : '',
      yearlyBudget: category.budgets?.yearly !== undefined ? String(category.budgets.yearly) : ''
    });
  };

  const handleCategoryUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCategoryId) return;
    const tags = editingCategoryState.tags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);
    const monthlyBudget = editingCategoryState.monthlyBudget.trim()
      ? Number(editingCategoryState.monthlyBudget)
      : undefined;
    const yearlyBudget = editingCategoryState.yearlyBudget.trim() ? Number(editingCategoryState.yearlyBudget) : undefined;
    await updateCategory(editingCategoryId, {
      name: editingCategoryState.name,
      type: editingCategoryState.type,
      parentId: editingCategoryState.parentId || undefined,
      tags,
      budgets:
        monthlyBudget !== undefined || yearlyBudget !== undefined
          ? {
              ...(monthlyBudget !== undefined ? { monthly: monthlyBudget } : {}),
              ...(yearlyBudget !== undefined ? { yearly: yearlyBudget } : {})
            }
          : undefined
    });
    setEditingCategoryId(null);
  };

  const cancelCategoryEdit = () => {
    setEditingCategoryId(null);
  };

  const incomePeriodLabel = incomeViewMode === 'monthly' ? formatMonthLabel(selectedIncomeMonth) : selectedIncomeYear;
  const categoryPeriodLabel =
    categoryViewMode === 'monthly' ? formatMonthLabel(selectedCategoryMonth) : selectedCategoryYear;

  const renderCategoryRows = (nodes: CategoryNode[], level = 0): JSX.Element[] => {
    return nodes.flatMap((node) => {
      const summary = summariseNode(node);
      const isExpanded = expandedNodes[node.category.id] ?? false;
      const isEditing = editingCategoryId === node.category.id;
      const hasChildren = node.children.length > 0;
      const hasTransactions = summary.transactions.length > 0;
      const hasPlans = summary.plannedItems.length > 0;
      const canExpand = hasChildren || hasTransactions || hasPlans;
      const variance = summary.plannedTotal - summary.totalSpent;
      const nodeBudget = categoryBudgetMap.get(node.category.id);
      const invalidParents = descendantMap.get(node.category.id) ?? new Set<string>([node.category.id]);
      const editParentOptions = categories.filter(
        (category) =>
          category.type === editingCategoryState.type &&
          category.id !== node.category.id &&
          !invalidParents.has(category.id)
      );

      const baseRow = (
        <tr key={node.category.id} className="bg-slate-950/60">
          <td className="px-4 py-3 align-top">
            <div className="flex items-start gap-3" style={{ paddingLeft: `${level * 1.25}rem` }}>
              {canExpand ? (
                <button
                  type="button"
                  onClick={() => toggleNode(node.category.id)}
                  className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-xs"
                  aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${node.category.name}`}
                >
                  {isExpanded ? '▾' : '▸'}
                </button>
              ) : (
                <span className="mt-2 text-slate-700">•</span>
              )}
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-100">{node.category.name}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{node.category.type}</p>
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-slate-300">
            {typeof nodeBudget === 'number' ? formatCurrency(nodeBudget) : <span className="text-slate-600">—</span>}
          </td>
          <td className="px-4 py-3 text-sm text-warning">{formatCurrency(summary.plannedTotal)}</td>
          <td className="px-4 py-3 text-sm text-danger">{formatCurrency(summary.totalSpent)}</td>
          <td className="px-4 py-3 text-sm text-success">{formatCurrency(summary.totalIncome)}</td>
          <td className="px-4 py-3 text-sm">
            <span className={variance >= 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
              {formatCurrency(variance)}
            </span>
          </td>
          <td className="px-4 py-3 text-sm text-slate-300">
            {node.category.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {node.category.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-800 px-2 py-1 text-[11px] uppercase tracking-wide">
                    #{tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-600">No tags</span>
            )}
          </td>
          <td className="px-4 py-3 text-right text-sm">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold"
                onClick={() => startEditingCategory(node.category.id)}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded-lg bg-danger/20 px-3 py-1 text-xs font-semibold text-danger"
                onClick={() => deleteCategory(node.category.id)}
              >
                Delete
              </button>
            </div>
          </td>
        </tr>
      );

      const detailRow = isExpanded ? (
        <tr key={`${node.category.id}-details`} className="border-t border-slate-900/60">
          <td colSpan={8} className="px-6 pb-5 pt-4">
            {isEditing ? (
              <form onSubmit={handleCategoryUpdate} className="space-y-4 text-xs">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-slate-500">Name</span>
                    <input
                      required
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={editingCategoryState.name}
                      onChange={(event) =>
                        setEditingCategoryState((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-slate-500">Type</span>
                    <select
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={editingCategoryState.type}
                      onChange={(event) =>
                        setEditingCategoryState((prev) => ({
                          ...prev,
                          type: event.target.value as Category['type'],
                          parentId: ''
                        }))
                      }
                    >
                      {categoryTypes.map((type) => (
                        <option key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-slate-500">Parent</span>
                    <select
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={editingCategoryState.parentId}
                      onChange={(event) =>
                        setEditingCategoryState((prev) => ({ ...prev, parentId: event.target.value }))
                      }
                    >
                      <option value="">No parent</option>
                      {editParentOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-slate-500">Tags</span>
                    <input
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={editingCategoryState.tags}
                      onChange={(event) =>
                        setEditingCategoryState((prev) => ({ ...prev, tags: event.target.value }))
                      }
                      placeholder="e.g. bill, essentials"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-slate-500">Monthly budget (₹)</span>
                    <input
                      type="number"
                      min={0}
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={editingCategoryState.monthlyBudget}
                      onChange={(event) =>
                        setEditingCategoryState((prev) => ({ ...prev, monthlyBudget: event.target.value }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-slate-500">Yearly budget (₹)</span>
                    <input
                      type="number"
                      min={0}
                      className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                      value={editingCategoryState.yearlyBudget}
                      onChange={(event) =>
                        setEditingCategoryState((prev) => ({ ...prev, yearlyBudget: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-accent px-4 py-2 font-semibold text-slate-900 hover:bg-sky-300"
                  >
                    Save category
                  </button>
                  <button
                    type="button"
                    onClick={cancelCategoryEdit}
                    className="rounded-lg border border-slate-700 px-4 py-2 font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-slate-400">Planned this period</p>
                    <p className="text-warning font-semibold">{formatCurrency(summary.plannedTotal)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Actual spend</p>
                    <p className="text-danger font-semibold">{formatCurrency(summary.totalSpent)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Recorded income</p>
                    <p className="text-success font-semibold">{formatCurrency(summary.totalIncome)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Variance</p>
                    <p className={variance >= 0 ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                      {formatCurrency(variance)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {typeof nodeBudget === 'number' ? (
                    <span className="rounded-full bg-warning/10 px-2 py-1 text-warning">
                      Budget baseline: {formatCurrency(nodeBudget)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-800 px-2 py-1">No baseline budget</span>
                  )}
                  {node.category.tags.length > 0 &&
                    node.category.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-800 px-2 py-1 uppercase tracking-wide text-slate-300"
                      >
                        #{tag}
                      </span>
                    ))}
                </div>
                {hasTransactions ? (
                  <div className="space-y-2">
                    <h5 className="text-[11px] uppercase tracking-wide text-slate-500">Recent transactions</h5>
                    <ul className="space-y-2">
                      {summary.transactions.slice(0, 5).map((txn) => (
                        <li key={txn.id} className="flex justify-between rounded-lg bg-slate-900/80 px-3 py-2">
                          <span>{txn.description || txn.merchant || 'Unnamed transaction'}</span>
                          <span className="font-semibold text-danger">{formatCurrency(Math.abs(txn.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">No transactions recorded for this node.</p>
                )}
                {hasPlans ? (
                  <div className="space-y-2">
                    <h5 className="text-[11px] uppercase tracking-wide text-slate-500">Upcoming planned items</h5>
                    <ul className="space-y-2">
                      {summary.plannedItems.slice(0, 5).map((item) => (
                        <li key={item.id} className="flex justify-between rounded-lg bg-slate-900/80 px-3 py-2">
                          <span>{item.description}</span>
                          <span className="font-semibold text-warning">
                            {formatCurrency(item.plannedAmount)}{' '}
                            {item.dueDate
                              ? `on ${format(parseISO(item.dueDate), 'dd MMM yyyy')}`
                              : '— no due date'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">No planned expense items linked to this node.</p>
                )}
              </div>
            )}
          </td>
        </tr>
      ) : null;

      const childRows = isExpanded ? renderCategoryRows(node.children, level + 1) : [];

      return detailRow ? [baseRow, detailRow, ...childRows] : [baseRow, ...childRows];
    });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Income & Category Management</h2>
          <p className="text-sm text-slate-400">
            Capture month-specific income variations, maintain category hierarchies with budgets, and enrich every node
            with tags for future-scale analytics.
          </p>
        </div>
        <nav
          aria-label="Income & Category Management shortcuts"
          className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 sm:flex-row sm:items-start"
        >
          <button
            type="button"
            onClick={() => setActiveSection('income')}
            className={`flex-1 rounded-xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:py-6 ${
              activeSection === 'income'
                ? 'border-accent/60 bg-accent/10 text-accent shadow-[0_0_0_1px_rgba(94,234,212,0.35)]'
                : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-accent/40 hover:text-accent'
            }`}
          >
            <span className="block text-sm font-semibold">Monthly income tracker</span>
            <span className="mt-1 block text-xs text-slate-500">
              Log the exact receipts for each month or year to mirror real-world cash flow swings.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('category')}
            className={`flex-1 rounded-xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:py-6 ${
              activeSection === 'category'
                ? 'border-accent/60 bg-accent/10 text-accent shadow-[0_0_0_1px_rgba(94,234,212,0.35)]'
                : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-accent/40 hover:text-accent'
            }`}
          >
            <span className="block text-sm font-semibold">Category governance</span>
            <span className="mt-1 block text-xs text-slate-500">
              Navigate directly to manage hierarchies, budgets, and tags that steer disciplined spending.
            </span>
          </button>
        </nav>
      </header>

      {activeSection === 'income' && (
        <section
          id="monthly-income-tracker"
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-900/40 sm:p-6"
        >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Monthly income tracker</h3>
            <p className="text-xs text-slate-500">
              Log the exact receipts for each month or year to mirror real-world cash flow swings.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm">
            Total committed income: <span className="font-semibold text-success">{formatCurrency(totalCommittedIncome)}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setIncomeViewMode('monthly')}
              className={`rounded-md px-3 py-1 font-semibold ${
                incomeViewMode === 'monthly' ? 'bg-accent text-slate-900' : 'text-slate-300'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setIncomeViewMode('yearly')}
              className={`rounded-md px-3 py-1 font-semibold ${
                incomeViewMode === 'yearly' ? 'bg-accent text-slate-900' : 'text-slate-300'
              }`}
            >
              Yearly
            </button>
          </div>
          {incomeViewMode === 'monthly' ? (
            <select
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
              value={selectedIncomeMonth}
              onChange={(event) => setSelectedIncomeMonth(event.target.value)}
            >
              {availableIncomeMonths.map((month) => (
                <option key={month} value={month}>
                  {formatMonthLabel(month)}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
              value={selectedIncomeYear}
              onChange={(event) => setSelectedIncomeYear(event.target.value)}
            >
              {availableIncomeYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}
          <span className="text-slate-500">Currently viewing: {incomePeriodLabel}</span>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
          <p className="text-xs uppercase text-slate-500">Total for {incomePeriodLabel}</p>
          <p className="mt-1 text-lg font-semibold text-success">{formatCurrency(incomeSummary)}</p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Received</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredIncomes.map((income) => {
                const categoryName = categoryLookup.get(income.categoryId)?.name ?? 'Uncategorised';
                const isEditing = editingIncomeId === income.id;
                return (
                  <tr key={income.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm"
                          value={editingIncomeState.source}
                          onChange={(event) =>
                            setEditingIncomeState((prev) => ({ ...prev, source: event.target.value }))
                          }
                        />
                      ) : (
                        income.source
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm"
                          value={editingIncomeState.categoryId}
                          onChange={(event) =>
                            setEditingIncomeState((prev) => ({ ...prev, categoryId: event.target.value }))
                          }
                        >
                          <option value="">Select category</option>
                          {incomeCategories.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        categoryName
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          type="date"
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm"
                          value={editingIncomeState.receivedOn}
                          onChange={(event) =>
                            setEditingIncomeState((prev) => ({ ...prev, receivedOn: event.target.value }))
                          }
                        />
                      ) : (
                        format(parseISO(income.receivedOn), 'd MMM yyyy')
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-success">
                      {isEditing ? (
                        <input
                          type="number"
                          min={0}
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm"
                          value={editingIncomeState.amount}
                          onChange={(event) =>
                            setEditingIncomeState((prev) => ({ ...prev, amount: Number(event.target.value) }))
                          }
                        />
                      ) : (
                        formatCurrency(income.amount)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <input
                          className="w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm"
                          value={editingIncomeState.notes}
                          onChange={(event) =>
                            setEditingIncomeState((prev) => ({ ...prev, notes: event.target.value }))
                          }
                        />
                      ) : (
                        income.notes ?? '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-success/20 px-3 py-1 text-xs font-semibold text-success"
                            onClick={handleIncomeUpdate}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold"
                            onClick={() => setEditingIncomeId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold"
                            onClick={() => startEditingIncome(income.id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-danger/20 px-3 py-1 text-xs font-semibold text-danger"
                            onClick={() => deleteMonthlyIncome(income.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredIncomes.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-center text-sm text-slate-500" colSpan={6}>
                    No income entries for this period. Add your first source below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleIncomeSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase text-slate-500">Source</label>
            <input
              required
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={incomeForm.source}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, source: event.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Amount (₹)</label>
            <input
              type="number"
              min={0}
              required
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={incomeForm.amount}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, amount: Number(event.target.value) }))}
            />
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Received on</label>
            <input
              type="date"
              required
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={incomeForm.receivedOn}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, receivedOn: event.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Category</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={incomeForm.categoryId}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, categoryId: event.target.value }))}
            >
              <option value="">Select category</option>
              {incomeCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs uppercase text-slate-500">Notes</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              rows={2}
              value={incomeForm.notes}
              onChange={(event) => setIncomeForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-300 md:col-span-2 md:w-auto"
          >
            Add income stream
          </button>
        </form>
        </section>
      )}

      {activeSection === 'category' && (
        <section
          id="category-governance"
          className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-900/40 sm:p-6"
        >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Category governance</h3>
            <p className="text-xs text-slate-500">
              Model hierarchies, tag bill categories for reminders, and embed monthly or annual budgets for variance
              analysis.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-slate-400">
            Viewing spend plan for {categoryPeriodLabel}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-200">Stage new categories</h4>
              <p className="text-xs text-slate-500">
                Draft multiple categories and publish them together to keep hierarchies tidy.
              </p>
            </div>
            <button
              type="button"
              onClick={() => (isCreatePanelOpen ? closeCreatePanel() : openCreatePanel())}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-300"
            >
              {isCreatePanelOpen ? 'Hide creator' : 'Create category'}
            </button>
          </div>

          {isCreatePanelOpen && (
            <form onSubmit={handleCreateCategories} className="mt-4 space-y-4">
              {categoryDrafts.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-700 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                  Add at least one category draft to begin.
                </p>
              )}
              {categoryDrafts.map((draft, index) => {
                const parentOptions = categories.filter((category) => category.type === draft.type);
                return (
                  <fieldset
                    key={draft.id}
                    className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/60 p-4"
                  >
                    <legend className="sr-only">Category {index + 1}</legend>

                    <div className="overflow-x-auto">
                      <div role="table" className="min-w-full">
                        <div
                          role="row"
                          className="flex flex-wrap items-start gap-x-6 gap-y-4 rounded-md border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-xs"
                        >
                          <div
                            role="rowheader"
                            className="flex items-center gap-2 whitespace-nowrap text-[11px] uppercase tracking-wide text-slate-400"
                          >
                            <span>Category {index + 1}</span>
                            {categoryDrafts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeDraftRow(draft.id)}
                                className="rounded-md border border-slate-700 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:border-slate-500"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <label role="cell" className="flex min-w-[12rem] flex-1 basis-48 flex-col gap-1 text-[11px] uppercase text-slate-500">
                            <span>Name</span>
                            <input
                              required
                              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                              value={draft.name}
                              onChange={(event) => updateDraft(draft.id, 'name', event.target.value)}
                            />
                          </label>
                          <label role="cell" className="flex min-w-[11rem] flex-1 basis-40 flex-col gap-1 text-[11px] uppercase text-slate-500">
                            <span>Type</span>
                            <select
                              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                              value={draft.type}
                              onChange={(event) => {
                                updateDraft(draft.id, 'type', event.target.value as Category['type']);
                                updateDraft(draft.id, 'parentId', '');
                              }}
                            >
                              {categoryTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type.charAt(0).toUpperCase() + type.slice(1)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label role="cell" className="flex min-w-[14rem] flex-1 basis-52 flex-col gap-1 text-[11px] uppercase text-slate-500">
                            <span>Parent (same root type)</span>
                            <select
                              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                              value={draft.parentId}
                              onChange={(event) => updateDraft(draft.id, 'parentId', event.target.value)}
                            >
                              <option value="">No parent</option>
                              {parentOptions.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label role="cell" className="flex min-w-[13rem] flex-1 basis-48 flex-col gap-1 text-[11px] uppercase text-slate-500">
                            <span>Tags</span>
                            <input
                              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                              value={draft.tags}
                              onChange={(event) => updateDraft(draft.id, 'tags', event.target.value)}
                              placeholder="e.g. bill, essentials"
                            />
                          </label>
                          <label role="cell" className="flex min-w-[12rem] flex-1 basis-44 flex-col gap-1 text-[11px] uppercase text-slate-500">
                            <span>Monthly budget (₹)</span>
                            <input
                              type="number"
                              min={0}
                              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                              value={draft.monthlyBudget}
                              onChange={(event) => updateDraft(draft.id, 'monthlyBudget', event.target.value)}
                            />
                          </label>
                          <label role="cell" className="flex min-w-[12rem] flex-1 basis-44 flex-col gap-1 text-[11px] uppercase text-slate-500">
                            <span>Yearly budget (₹)</span>
                            <input
                              type="number"
                              min={0}
                              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200"
                              value={draft.yearlyBudget}
                              onChange={(event) => updateDraft(draft.id, 'yearlyBudget', event.target.value)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </fieldset>
                );
              })}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={addDraftRow}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold"
                >
                  Add another category
                </button>
                <span className="text-[11px] text-slate-500">
                  Use lowercase tags to flag categories, e.g. <code>bill</code> for reminders.
                </span>
                <div className="grow" />
                <button
                  type="button"
                  onClick={closeCreatePanel}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-300"
                >
                  Create {categoryDrafts.length > 1 ? 'categories' : 'category'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-1">
            <button
              type="button"
              onClick={() => setCategoryViewMode('monthly')}
              className={`rounded-md px-3 py-1 font-semibold ${
                categoryViewMode === 'monthly' ? 'bg-accent text-slate-900' : 'text-slate-300'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setCategoryViewMode('yearly')}
              className={`rounded-md px-3 py-1 font-semibold ${
                categoryViewMode === 'yearly' ? 'bg-accent text-slate-900' : 'text-slate-300'
              }`}
            >
              Yearly
            </button>
          </div>
          {categoryViewMode === 'monthly' ? (
            <select
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
              value={selectedCategoryMonth}
              onChange={(event) => setSelectedCategoryMonth(event.target.value)}
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
              value={selectedCategoryYear}
              onChange={(event) => setSelectedCategoryYear(event.target.value)}
            >
              {categoryYearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          )}
          <span className="text-slate-500">Analytics window: {categoryPeriodLabel}</span>
        </div>

        <div className="mt-6 space-y-6">
          {categoryTreesByType.map(({ type, nodes }) => (
            <div key={type} className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {type.toUpperCase()} CATEGORIES
              </h4>
              {nodes.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">Category</th>
                        <th className="px-4 py-3 text-left">Baseline</th>
                        <th className="px-4 py-3 text-left">Planned</th>
                        <th className="px-4 py-3 text-left">Actual spend</th>
                        <th className="px-4 py-3 text-left">Income</th>
                        <th className="px-4 py-3 text-left">Variance</th>
                        <th className="px-4 py-3 text-left">Tags</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">{renderCategoryRows(nodes)}</tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No categories defined for this type yet.</p>
              )}
            </div>
          ))}
        </div>
        </section>
      )}
    </div>
  );
}
