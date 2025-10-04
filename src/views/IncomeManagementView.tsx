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

function monthKey(date: string) {
  return date.slice(0, 7);
}

function yearKey(date: string) {
  return date.slice(0, 4);
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
    plannedExpenses.forEach((item) => months.add(monthKey(item.dueDate)));
    return Array.from(months).sort((a, b) => (a > b ? -1 : 1));
  }, [transactions, plannedExpenses, selectedCategoryMonth, defaultMonth]);

  const categoryYearOptions = useMemo(() => {
    const years = new Set<string>([selectedCategoryYear, defaultYear]);
    transactions.forEach((txn) => years.add(yearKey(txn.date)));
    plannedExpenses.forEach((item) => years.add(yearKey(item.dueDate)));
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

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    type: 'income' as Category['type'],
    parentId: '',
    tags: '',
    monthlyBudget: '',
    yearlyBudget: ''
  });

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
          ? monthKey(item.dueDate) === selectedCategoryMonth
          : yearKey(item.dueDate) === selectedCategoryYear
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
        plannedList.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

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

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const ensureNodeExpanded = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: true }));
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

  const handleAddCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryForm.name.trim()) return;
    const tags = categoryForm.tags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);
    const monthlyBudget = categoryForm.monthlyBudget.trim() ? Number(categoryForm.monthlyBudget) : undefined;
    const yearlyBudget = categoryForm.yearlyBudget.trim() ? Number(categoryForm.yearlyBudget) : undefined;
    const category = await addCategory({
      name: categoryForm.name,
      type: categoryForm.type,
      parentId: categoryForm.parentId || undefined,
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
    if (category.type === 'income') {
      setIncomeForm((prev) => ({ ...prev, categoryId: category.id }));
    }
    setCategoryForm({ name: '', type: 'income', parentId: '', tags: '', monthlyBudget: '', yearlyBudget: '' });
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

  const parentOptions = useMemo(
    () =>
      categories.filter((category) => category.type === categoryForm.type),
    [categories, categoryForm.type]
  );

  const incomePeriodLabel = incomeViewMode === 'monthly' ? formatMonthLabel(selectedIncomeMonth) : selectedIncomeYear;
  const categoryPeriodLabel =
    categoryViewMode === 'monthly' ? formatMonthLabel(selectedCategoryMonth) : selectedCategoryYear;

  const renderCategoryNodes = (nodes: CategoryNode[]) => (
    <ul className="space-y-3">
      {nodes.map((node) => {
        const summary = summariseNode(node);
        const isExpanded = expandedNodes[node.category.id] ?? false;
        const isEditing = editingCategoryId === node.category.id;
        const hasDetails =
          node.children.length > 0 || summary.transactions.length > 0 || summary.plannedItems.length > 0;
        const variance = summary.plannedTotal - summary.totalSpent;
        const nodeBudget = categoryBudgetMap.get(node.category.id);
        const hasBudget = nodeBudget !== undefined;
        const invalidParents = descendantMap.get(node.category.id) ?? new Set<string>([node.category.id]);
        const editParentOptions = categories.filter(
          (category) =>
            category.type === editingCategoryState.type &&
            category.id !== node.category.id &&
            !invalidParents.has(category.id)
        );

        return (
          <li key={node.category.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className={`inline-flex items-center gap-2 text-left font-semibold ${
                  hasDetails ? 'text-slate-100' : 'cursor-default text-slate-400'
                }`}
                onClick={() => (hasDetails ? toggleNode(node.category.id) : undefined)}
              >
                <span className="text-xs text-slate-500">{node.category.type.toUpperCase()}</span>
                <span>{node.category.name}</span>
                {hasDetails && <span className="text-xs text-slate-500">{isExpanded ? '▾' : '▸'}</span>}
              </button>
              <div className="flex flex-wrap gap-2">
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
            </div>

            <div className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
              {hasBudget ? (
                <span className="rounded-full bg-warning/10 px-2 py-1 text-warning">
                  Budget baseline: {formatCurrency(nodeBudget ?? 0)}
                </span>
              ) : (
                <span className="rounded-full bg-slate-800 px-2 py-1">No baseline budget</span>
              )}
              {node.category.tags.length > 0 &&
                node.category.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-slate-800 px-2 py-1 uppercase tracking-wide text-slate-300">
                    #{tag}
                  </span>
                ))}
            </div>

            {isExpanded && (
              <div className="mt-4 space-y-4 border-t border-slate-800 pt-4">
                {isEditing ? (
                  <form onSubmit={handleCategoryUpdate} className="space-y-3 text-xs">
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
                          placeholder="comma separated"
                        />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1">
                        <span className="uppercase text-slate-500">Monthly budget</span>
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
                        <span className="uppercase text-slate-500">Yearly budget</span>
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
                        className="rounded-lg bg-success/20 px-4 py-2 text-xs font-semibold text-success"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-100"
                        onClick={cancelCategoryEdit}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    {summary.transactions.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Transactions
                        </h5>
                        <ul className="space-y-2">
                          {summary.transactions.map((txn) => (
                            <li key={txn.id} className="flex items-center justify-between text-xs">
                              <span>
                                {format(parseISO(txn.date), 'd MMM yyyy')} • {txn.description}
                              </span>
                              <span className={txn.amount < 0 ? 'text-danger font-semibold' : 'text-success font-semibold'}>
                                {formatCurrency(txn.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {summary.plannedItems.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Planned items
                        </h5>
                        <ul className="space-y-2">
                          {summary.plannedItems.map((item) => (
                            <li key={item.id} className="flex items-center justify-between text-xs">
                              <span>
                                {format(parseISO(item.dueDate), 'd MMM yyyy')} • {item.name}
                              </span>
                              <span className="font-semibold text-warning">
                                {formatCurrency(item.plannedAmount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {node.children.length > 0 && (
                      <div>
                        <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Sub-categories</h5>
                        <div className="mt-2 space-y-3 border-l border-slate-800 pl-4">
                          {renderCategoryNodes(node.children)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

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
          className="flex flex-col gap-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-start"
        >
          <a
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-accent hover:text-accent"
            href="#monthly-income-tracker"
          >
            <span className="block text-sm font-semibold text-slate-200">Monthly income tracker</span>
            <span className="mt-1 block text-xs text-slate-500">
              Log the exact receipts for each month or year to mirror real-world cash flow swings.
            </span>
          </a>
          <a
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-accent hover:text-accent"
            href="#category-governance"
          >
            <span className="block text-sm font-semibold text-slate-200">Category governance</span>
            <span className="mt-1 block text-xs text-slate-500">
              Navigate directly to manage hierarchies, budgets, and tags that steer disciplined spending.
            </span>
          </a>
        </nav>
      </header>

      <section
        id="monthly-income-tracker"
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
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
                    No income entries for this period. Add your first source above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section
        id="category-governance"
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
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

        <form
          onSubmit={handleAddCategory}
          className="mt-6 space-y-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Name
              <input
                required
                className="mt-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={categoryForm.name}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Type
              <select
                className="mt-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={categoryForm.type}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
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
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Parent (same root type)
              <select
                className="mt-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={categoryForm.parentId}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, parentId: event.target.value }))}
              >
                <option value="">No parent</option>
                {parentOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Tags
              <input
                className="mt-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={categoryForm.tags}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, tags: event.target.value }))}
                placeholder="e.g. bill, essentials"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Monthly budget (₹)
              <input
                type="number"
                min={0}
                className="mt-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={categoryForm.monthlyBudget}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, monthlyBudget: event.target.value }))}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs uppercase text-slate-500">
              Yearly budget (₹)
              <input
                type="number"
                min={0}
                className="mt-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                value={categoryForm.yearlyBudget}
                onChange={(event) => setCategoryForm((prev) => ({ ...prev, yearlyBudget: event.target.value }))}
              />
            </label>
          </div>
          <div className="flex flex-col gap-2 text-xs text-slate-400">
            <p>Use lowercase tags to flag categories, e.g. <code>bill</code> for payment reminders.</p>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-300"
          >
            Create category
          </button>
        </form>

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
                renderCategoryNodes(nodes)
              ) : (
                <p className="text-xs text-slate-500">No categories defined for this type yet.</p>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
