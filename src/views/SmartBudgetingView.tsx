import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addMonths, format, formatISO, parseISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import type { PlannedExpenseItem } from '../types';

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

  const reconciliations = useMemo(
    () =>
      plannedExpenses.map((item) => ({
        item,
        match: transactions.find(
          (txn) =>
            txn.categoryId === item.categoryId &&
            txn.amount < 0 &&
            Math.abs(Math.abs(txn.amount) - item.plannedAmount) <=
              Math.max(500, item.plannedAmount * 0.1)
        )
      })),
    [plannedExpenses, transactions]
  );

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
        <h3 className="text-lg font-semibold">Planned Expenses List</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reconciliations.map(({ item, match }) => (
            <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
              <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-slate-100">{item.name}</h4>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {new Date(item.dueDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    {statusBadge(item.status)}
                  </p>
                </div>
                <span className="text-sm font-semibold text-warning">{formatCurrency(item.plannedAmount)}</span>
              </header>
              <p className="mt-2 text-xs text-slate-400">
                Category: {categories.find((cat) => cat.id === item.categoryId)?.name ?? 'Uncategorised'}
              </p>
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-300">
                {match
                  ? `Matched with ${match.description} on ${new Date(match.date).toLocaleDateString('en-IN')}`
                  : 'No matching transaction yet — keep an eye on the variance chart.'}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-success/20 px-3 py-1 text-xs font-semibold text-success"
                  onClick={() => updatePlannedExpense(item.id, { status: 'purchased' })}
                >
                  Mark purchased
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs text-slate-300"
                  onClick={() => updatePlannedExpense(item.id, { status: 'cancelled' })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-300"
                  onClick={() => updatePlannedExpense(item.id, { status: 'reconciled' })}
                  disabled={item.status === 'reconciled'}
                >
                  Reconcile
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-danger/20 px-3 py-1 text-xs font-semibold text-danger"
                  onClick={() => deletePlannedExpense(item.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
          {plannedExpenses.length === 0 && (
            <p className="text-sm text-slate-500 md:col-span-2 xl:col-span-3">No planned expenses yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
