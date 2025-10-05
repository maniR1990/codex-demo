import { FormEvent, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import type { BudgetAdjustment, Category, PlannedExpenseItem, Transaction } from '../types';
import { interpretCategoryJson, normaliseCategoryName } from '../utils/categoryImport';

const categoryTypes: Category['type'][] = ['income', 'expense', 'asset', 'liability'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

interface CategoryDraftForm {
  id: string;
  name: string;
  type: Category['type'];
  parentId: string;
  tags: string;
}

interface CategorySummary {
  transactions: Transaction[];
  plannedItems: PlannedExpenseItem[];
  rolloverTotal: number;
}

interface CategoryImportSummary {
  created: number;
  skipped: string[];
  warnings: string[];
  errors: string[];
}

function createBlankDraft(type: Category['type'] = 'income'): CategoryDraftForm {
  return {
    id: Math.random().toString(36).slice(2),
    name: '',
    type,
    parentId: '',
    tags: ''
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
    budgetMonthMap,
    budgetMonthsList,
    getBudgetMonth,
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
    budgetMonthsList.forEach((month) => months.add(month.month));
    return Array.from(months).sort((a, b) => (a > b ? -1 : 1));
  }, [transactions, budgetMonthsList, selectedCategoryMonth, defaultMonth]);

  const categoryYearOptions = useMemo(() => {
    const years = new Set<string>([selectedCategoryYear, defaultYear]);
    transactions.forEach((txn) => years.add(yearKey(txn.date)));
    budgetMonthsList.forEach((month) => years.add(yearKey(month.month)));
    return Array.from(years).sort((a, b) => (a > b ? -1 : 1));
  }, [transactions, budgetMonthsList, selectedCategoryYear, defaultYear]);

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
    tags: ''
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

  const relevantTransactions = useMemo(
    () =>
      transactions.filter((txn) =>
        categoryViewMode === 'monthly'
          ? monthKey(txn.date) === selectedCategoryMonth
          : yearKey(txn.date) === selectedCategoryYear
      ),
    [transactions, categoryViewMode, selectedCategoryMonth, selectedCategoryYear]
  );

  const relevantPlannedExpenses = useMemo(() => {
    if (categoryViewMode === 'monthly') {
      const month = budgetMonthMap[selectedCategoryMonth];
      return Array.isArray(month?.plannedExpenses) ? month!.plannedExpenses : [];
    }
    const items: PlannedExpenseItem[] = [];
    Object.values(budgetMonthMap).forEach((month) => {
      if (!month) return;
      if (yearKey(month.month) === selectedCategoryYear && Array.isArray(month.plannedExpenses)) {
        items.push(...month.plannedExpenses);
      }
    });
    return items;
  }, [budgetMonthMap, categoryViewMode, selectedCategoryMonth, selectedCategoryYear]);

  const relevantAdjustments = useMemo(() => {
    const adjustments: BudgetAdjustment[] = [];
    if (categoryViewMode === 'monthly') {
      const month = getBudgetMonth(selectedCategoryMonth);
      adjustments.push(...(month.adjustments ?? []));
    } else {
      budgetMonthsList.forEach((month) => {
        if (yearKey(month.month) === selectedCategoryYear) {
          const data = getBudgetMonth(month.month);
          adjustments.push(...(data.adjustments ?? []));
        }
      });
    }
    return adjustments;
  }, [categoryViewMode, selectedCategoryMonth, selectedCategoryYear, getBudgetMonth, budgetMonthsList]);

  const categoryAdjustmentMap = useMemo(() => {
    const map = new Map<string, number>();
    relevantAdjustments.forEach((adjustment) => {
      if (!adjustment.categoryId) return;
      map.set(adjustment.categoryId, (map.get(adjustment.categoryId) ?? 0) + adjustment.amount);
    });
    return map;
  }, [relevantAdjustments]);

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
        const transactionsList: Transaction[] = [];
        const plannedList: PlannedExpenseItem[] = [];
        let rolloverTotal = 0;

        while (queue.length > 0) {
          const current = queue.shift()!;
          const txns = transactionMap.get(current.category.id) ?? [];
          txns.forEach((txn) => {
            transactionsList.push(txn);
          });

          const plannedItems = plannedMap.get(current.category.id) ?? [];
          plannedItems.forEach((item) => {
            plannedList.push(item);
          });

          rolloverTotal += categoryAdjustmentMap.get(current.category.id) ?? 0;

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
          transactions: transactionsList,
          plannedItems: plannedList,
          rolloverTotal
        };
      },
    [transactionMap, plannedMap, categoryAdjustmentMap]
  );

  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [activeSection, setActiveSection] = useState<'income' | 'category'>('income');
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState<CategoryDraftForm[]>([]);
  const [importJson, setImportJson] = useState('');
  const [isImportingCategories, setIsImportingCategories] = useState(false);
  const [importSummary, setImportSummary] = useState<CategoryImportSummary | null>(null);

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

  const resetImportState = () => {
    setImportJson('');
    setImportSummary(null);
  };

  const handleImportCategories = async () => {
    setImportSummary(null);
    if (!importJson.trim()) {
      setImportSummary({
        created: 0,
        skipped: [],
        warnings: [],
        errors: ['Please paste category JSON before importing.']
      });
      return;
    }

    setIsImportingCategories(true);
    try {
      const { entries, warnings: parseWarnings, errors: parseErrors } = interpretCategoryJson(importJson);
      if (parseErrors.length > 0) {
        setImportSummary({ created: 0, skipped: [], warnings: [], errors: parseErrors });
        return;
      }

      if (entries.length === 0) {
        setImportSummary({ created: 0, skipped: [], warnings: parseWarnings, errors: [] });
        return;
      }

      const existingByName = new Map<string, string>();
      categories.forEach((category) => {
        existingByName.set(normaliseCategoryName(category.name), category.id);
      });

      const createdByName = new Map<string, string>();
      const skippedNames = new Map<string, string>();
      const warnings = [...parseWarnings];
      const errors: string[] = [];
      let createdCount = 0;

      let remaining = entries.slice();
      let safetyCounter = 0;

      while (remaining.length > 0 && safetyCounter < entries.length * 2) {
        const nextRound: typeof remaining = [];
        let progressInPass = 0;

        for (const entry of remaining) {
          const key = normaliseCategoryName(entry.name);
          if (existingByName.has(key) || createdByName.has(key)) {
            if (!skippedNames.has(key)) {
              skippedNames.set(key, entry.name);
              warnings.push(`Category "${entry.name}" already exists and was skipped.`);
            }
            continue;
          }

          let parentId: string | undefined;
          if (entry.parentName) {
            const parentKey = normaliseCategoryName(entry.parentName);
            parentId = createdByName.get(parentKey) ?? existingByName.get(parentKey);
            if (!parentId) {
              nextRound.push(entry);
              continue;
            }
          }

          try {
            const category = await addCategory({
              name: entry.name,
              type: entry.type,
              parentId,
              tags: entry.tags,
              isCustom: true
            });
            createdByName.set(key, category.id);
            existingByName.set(key, category.id);
            createdCount += 1;
            progressInPass += 1;
          } catch (error) {
            errors.push(`Failed to import "${entry.name}": ${(error as Error).message}`);
          }
        }

        if (nextRound.length === remaining.length && progressInPass === 0) {
          nextRound.forEach((entry) => {
            errors.push(
              `Skipped "${entry.name}" because parent "${entry.parentName ?? 'root'}" could not be resolved.`
            );
          });
          break;
        }

        remaining = nextRound;
        safetyCounter += 1;
      }

      setImportSummary({
        created: createdCount,
        skipped: Array.from(skippedNames.values()),
        warnings,
        errors
      });
    } finally {
      setIsImportingCategories(false);
    }
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

      const category = await addCategory({
        name: draft.name,
        type: draft.type,
        parentId: draft.parentId || undefined,
        tags,
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
      tags: category.tags.join(', ')
    });
  };

  const handleCategoryUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCategoryId) return;
    const tags = editingCategoryState.tags
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag, index, array) => tag.length > 0 && array.indexOf(tag) === index);
    await updateCategory(editingCategoryId, {
      name: editingCategoryState.name,
      type: editingCategoryState.type,
      parentId: editingCategoryState.parentId || undefined,
      tags
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
      const parentLabel = node.category.parentId
        ? categoryLookup.get(node.category.parentId)?.name ?? 'Unknown parent'
        : 'No parent';
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
                {Math.abs(summary.rolloverTotal) > 0 && (
                  <p className="text-[11px] text-warning">
                    Rollover impact: {formatCurrency(summary.rolloverTotal)}
                  </p>
                )}
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-slate-300">{parentLabel}</td>
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
          <td colSpan={4} className="px-6 pb-5 pt-4">
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
                <div className="flex flex-wrap items-stretch gap-3 text-xs">
                  <div className="flex min-w-[150px] flex-1 items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-950/60 px-3 py-2">
                    <span className="text-slate-400" aria-hidden="true">
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
                        <path d="M9 12h6" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="sr-only">Parent category</p>
                      <p className="truncate font-semibold text-slate-200">{parentLabel}</p>
                    </div>
                  </div>
                  <div className="flex min-w-[140px] flex-1 items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-950/60 px-3 py-2">
                    <span className="text-slate-400" aria-hidden="true">
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 7h16M4 12h16M4 17h10" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="sr-only">Category type</p>
                      <p className="truncate font-semibold uppercase tracking-wide text-slate-200">
                        {node.category.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-[120px] flex-1 items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-950/60 px-3 py-2">
                    <span className="text-slate-400" aria-hidden="true">
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 7a4 4 0 1 1 8 0v3a4 4 0 1 1-8 0Z" />
                        <path d="M13 13.5a4 4 0 1 1 6 3.464" />
                        <path d="M5 21v-2a4 4 0 0 1 4-4h2" />
                        <path d="M17 21v-2" />
                      </svg>
                    </span>
                    <div className="min-w-0">
                      <p className="sr-only">Direct children</p>
                      <p className="truncate font-semibold text-slate-200">{node.children.length}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
                  {node.category.tags.length > 0 ? (
                    node.category.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-800 px-2 py-1 uppercase tracking-wide text-slate-300"
                      >
                        #{tag}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">No tags assigned</span>
                  )}
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
            Capture month-specific income variations, maintain category hierarchies, and enrich every node with tags for
            future-scale analytics.
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
              Navigate directly to manage hierarchies and tags that steer disciplined spending.
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
              Model hierarchies, tag bill categories for reminders, and keep category metadata tidy for downstream
              analytics.
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

        <div className="mt-6 space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-200">Bootstrap categories from JSON</h4>
              <p className="text-xs text-slate-500">
                Paste a nested JSON structure to seed default categories. Invalid or incomplete entries are
                automatically skipped.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportCategories}
                className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isImportingCategories}
              >
                {isImportingCategories ? 'Importing…' : 'Import categories'}
              </button>
              <button
                type="button"
                onClick={resetImportState}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500"
                disabled={isImportingCategories || (!importJson.trim() && !importSummary)}
              >
                Reset
              </button>
            </div>
          </div>
          <textarea
            className="h-48 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300"
            value={importJson}
            onChange={(event) => setImportJson(event.target.value)}
            placeholder="{\n  \"Household Essentials\": {\n    \"category\": \"Groceries & Daily Supplies\",\n    \"subcategories\": [\n      \"Grocery\",\n      \"Meat\"\n    ]\n  }\n}"
          />
          {importSummary && (
            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-200">
                Created {importSummary.created} categor{importSummary.created === 1 ? 'y' : 'ies'}.
              </p>
              {importSummary.skipped.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-200">Skipped</p>
                  <ul className="ml-4 list-disc space-y-1 text-[11px] text-slate-400">
                    {importSummary.skipped.map((name) => (
                      <li key={`skipped-${name}`}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importSummary.warnings.length > 0 && (
                <div>
                  <p className="font-semibold text-warning">Warnings</p>
                  <ul className="ml-4 list-disc space-y-1 text-[11px] text-warning/90">
                    {importSummary.warnings.map((warning, index) => (
                      <li key={`warning-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              {importSummary.errors.length > 0 && (
                <div>
                  <p className="font-semibold text-danger">Errors</p>
                  <ul className="ml-4 list-disc space-y-1 text-[11px] text-danger/90">
                    {importSummary.errors.map((error, index) => (
                      <li key={`error-${index}`}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
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
                        <th className="px-4 py-3 text-left">Parent</th>
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
