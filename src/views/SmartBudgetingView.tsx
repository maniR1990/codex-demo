import { FormEvent, useMemo, useState } from 'react';
import { addMonths, formatISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import type { PlannedExpenseItem } from '../types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
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
  const [formState, setFormState] = useState({ name: '', amount: 0, dueDate: formatISO(addMonths(new Date(), 1), { representation: 'date' }), categoryId: categories[0]?.id ?? '' });
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const categorySuggestions = useMemo(() => {
    const spendByCategory = new Map<string, number>();
    transactions
      .filter((txn) => txn.amount < 0)
      .forEach((txn) => {
        if (txn.categoryId) {
          spendByCategory.set(txn.categoryId, (spendByCategory.get(txn.categoryId) ?? 0) + Math.abs(txn.amount));
        }
      });
    return [...categories]
      .filter((category) => category.type === 'expense')
      .sort((a, b) => (spendByCategory.get(b.id) ?? 0) - (spendByCategory.get(a.id) ?? 0))
      .slice(0, 5);
  }, [categories, transactions]);

  const monthlyBudget = useMemo(() => {
    const planned = plannedExpenses
      .filter((item) => item.status === 'pending')
      .reduce((sum, item) => sum + item.plannedAmount, 0);
    const actual = transactions
      .filter((txn) => txn.amount < 0)
      .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
    return { planned, actual, variance: planned - actual };
  }, [plannedExpenses, transactions]);

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
            <p className="text-xs text-slate-500">Including all planned variable expenses</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm">
            Planned: <span className="font-semibold text-warning">{formatCurrency(monthlyBudget.planned)}</span>{' '}
            Actual: <span className="font-semibold text-danger">{formatCurrency(monthlyBudget.actual)}</span>{' '}
            Variance: <span className="font-semibold text-success">{formatCurrency(monthlyBudget.variance)}</span>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
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
                  {categories
                    .filter((category) => category.type === 'expense')
                    .map((category) => (
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
