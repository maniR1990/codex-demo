import { FormEvent, useMemo, useState } from 'react';
import { addDays, addMonths, format, formatISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import type { Currency, Frequency } from '../types';
import { createDefaultBudgetMonth } from '../types';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

const frequencies: Frequency[] = ['Monthly', 'Quarterly', 'Annually'];

export function RecurringExpensesView() {
  const {
    recurringExpenses,
    categories,
    transactions,
    getBudgetMonth,
    addRecurringExpense,
    updateRecurringExpense,
    deleteRecurringExpense
  } = useFinancialStore();
  const [formState, setFormState] = useState({
    name: '',
    amount: 0,
    categoryId: categories.find((cat) => cat.type === 'expense')?.id ?? '',
    frequency: 'Monthly' as Frequency,
    dueDate: formatISO(new Date(), { representation: 'date' }),
    isEstimated: false
  });

  const monthlyForecast = useMemo(() => {
    const forecast = new Map<string, number>();
    recurringExpenses.forEach((expense) => {
      const monthsAhead = 3;
      for (let i = 0; i < monthsAhead; i += 1) {
        const monthKey = formatISO(addMonths(new Date(expense.dueDate), i), { representation: 'date' }).slice(0, 7);
        const current = forecast.get(monthKey) ?? 0;
        const amount = expense.frequency === 'Monthly' ? expense.amount : expense.amount / (expense.frequency === 'Quarterly' ? 3 : 12);
        forecast.set(monthKey, current + amount);
      }
    });
    return Array.from(forecast.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));
  }, [recurringExpenses]);

  const billTaggedCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.type === 'expense' && category.tags.some((tag) => tag.toLowerCase() === 'bill')
      ),
    [categories]
  );

  const billCategoryIds = useMemo(() => new Set(billTaggedCategories.map((category) => category.id)), [billTaggedCategories]);

  const billReminders = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const horizon = addDays(startOfToday, 14).getTime();
    const reminders: Array<{
      id: string;
      name: string;
      amount: number;
      dueDate: string;
      frequency?: Frequency;
      status: 'scheduled' | 'skipped' | 'adjusted';
    }> = [];

    const currency: Currency = recurringExpenses[0]?.currency ?? 'INR';
    const monthKeysInRange = new Set<string>();
    const cursor = new Date(startOfToday);
    while (cursor.getTime() <= horizon) {
      monthKeysInRange.add(formatISO(cursor, { representation: 'date' }).slice(0, 7));
      cursor.setMonth(cursor.getMonth() + 1, 1);
    }

    monthKeysInRange.forEach((monthKey) => {
      const budgetMonth = getBudgetMonth(monthKey) ?? createDefaultBudgetMonth(monthKey, currency);
      budgetMonth.recurringAllocations.forEach((allocation) => {
        const expense = recurringExpenses.find(
          (item) => item.id === allocation.recurringExpenseId || item.id === allocation.id
        );
        if (!expense || !billCategoryIds.has(expense.categoryId)) {
          return;
        }
        const dueDate = expense.nextDueDate ?? expense.dueDate ?? `${monthKey}-01`;
        const dueTime = new Date(dueDate).getTime();
        if (dueTime < startOfToday.getTime() || dueTime > horizon) {
          return;
        }
        const status: 'scheduled' | 'skipped' | 'adjusted' = allocation.amount === 0
          ? 'skipped'
          : Math.abs(allocation.amount - expense.amount) > 1
          ? 'adjusted'
          : 'scheduled';
        reminders.push({
          id: `${allocation.id}-${monthKey}`,
          name: expense.name,
          amount: allocation.amount,
          dueDate,
          frequency: expense.frequency,
          status
        });
      });
    });

    reminders.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    return reminders;
  }, [billCategoryIds, recurringExpenses, getBudgetMonth]);

  const reconciliation = useMemo(() => {
    return recurringExpenses.map((expense) => {
      const match = transactions.find((txn) =>
        txn.description.toLowerCase().includes(expense.name.toLowerCase()) &&
        Math.abs(txn.amount + expense.amount) < 1_000
      );
      return { expense, match };
    });
  }, [recurringExpenses, transactions]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await addRecurringExpense({
      name: formState.name,
      amount: Number(formState.amount),
      categoryId: formState.categoryId,
      frequency: formState.frequency,
      dueDate: formState.dueDate,
      currency: 'INR',
      isEstimated: formState.isEstimated,
      nextDueDate: addMonths(new Date(formState.dueDate), 1).toISOString()
    });
    setFormState((prev) => ({ ...prev, name: '', amount: 0 }));
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Recurring Expenses & Subscription Hub</h2>
        <p className="text-sm text-slate-400">
          Track fixed obligations, auto-forecast budgets, and reconcile imported transactions with scheduled payments.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <h3 className="text-lg font-semibold">Upcoming bill reminders</h3>
        <p className="text-xs text-slate-500">
          Only expense categories tagged with <code>#bill</code> appear here. We watch recurring debits and highlight
          any skipped or adjusted allocations within the next 14 days.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {billReminders.map((reminder) => (
            <article key={reminder.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-semibold text-slate-100">{reminder.name}</h4>
                  <p className="text-xs text-slate-500">
                    Due {format(new Date(reminder.dueDate), 'd MMM yyyy')} •
                    {reminder.status === 'scheduled'
                      ? ` Recurring · ${reminder.frequency ?? 'Monthly'}`
                      : reminder.status === 'skipped'
                      ? ' Skipped this cycle'
                      : ' Adjusted allocation'}
                  </p>
                </div>
                <span className="text-warning font-semibold">{formatCurrency(reminder.amount)}</span>
              </div>
              {reminder.status !== 'scheduled' && (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-warning">
                  {reminder.status === 'skipped' ? 'Skipped' : 'Adjusted'}
                </p>
              )}
            </article>
          ))}
          {billReminders.length === 0 && (
            <p className="text-sm text-slate-500 md:col-span-2 xl:col-span-3">
              No bill-tagged reminders due in the next two weeks.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs uppercase text-slate-500">Expense name</label>
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
            <label className="text-xs uppercase text-slate-500">Category</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={formState.categoryId}
              onChange={(event) => setFormState((prev) => ({ ...prev, categoryId: event.target.value }))}
            >
              {categories
                .filter((cat) => cat.type === 'expense')
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Frequency</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={formState.frequency}
              onChange={(event) => setFormState((prev) => ({ ...prev, frequency: event.target.value as Frequency }))}
            >
              {frequencies.map((freq) => (
                <option key={freq} value={freq}>
                  {freq}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase text-slate-500">Due Date</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
              value={formState.dueDate}
              onChange={(event) => setFormState((prev) => ({ ...prev, dueDate: event.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2 pt-6 md:col-span-2">
            <input
              id="estimated"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-700 bg-slate-900"
              checked={formState.isEstimated}
              onChange={(event) => setFormState((prev) => ({ ...prev, isEstimated: event.target.checked }))}
            />
            <label htmlFor="estimated" className="text-xs text-slate-400">
              Amount is estimated
            </label>
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-300 md:col-span-2 md:w-auto"
          >
            Add recurring expense
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <h3 className="text-lg font-semibold">Automated budget forecasting</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {monthlyForecast.map((item) => (
            <div key={item.month} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
              <p className="text-xs uppercase text-slate-500">{item.month}</p>
              <p className="mt-2 text-base font-semibold text-warning">{formatCurrency(item.amount)}</p>
              <p className="text-xs text-slate-500">Auto-populated into monthly budget plans.</p>
            </div>
          ))}
          {monthlyForecast.length === 0 && (
            <p className="text-sm text-slate-500 md:col-span-3">No recurring expenses yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <h3 className="text-lg font-semibold">Smart reconciliation & alerts</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {reconciliation.map(({ expense, match }) => (
            <article key={expense.id} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <h4 className="text-base font-semibold text-slate-100">{expense.name}</h4>
                  <p className="text-xs text-slate-500">Due {new Date(expense.dueDate).toLocaleDateString('en-IN')}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Category: {categories.find((cat) => cat.id === expense.categoryId)?.name ?? 'Uncategorised'}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold text-warning">{formatCurrency(expense.amount)}</p>
                  <p className="text-xs text-slate-500">{expense.frequency}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-success/20 px-3 py-1 text-xs font-semibold text-success"
                  onClick={() =>
                    updateRecurringExpense(expense.id, {
                      nextDueDate: addMonths(new Date(expense.dueDate), 1).toISOString()
                    })
                  }
                >
                  Mark paid
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-danger/20 px-3 py-1 text-xs font-semibold text-danger"
                  onClick={() => deleteRecurringExpense(expense.id)}
                >
                  Delete
                </button>
              </div>
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/80 p-3 text-xs text-slate-300">
                {match
                  ? `Matched with transaction "${match.description}" on ${new Date(match.date).toLocaleDateString('en-IN')}`
                  : 'No matching transaction yet. We will alert you before the due date.'}
              </div>
            </article>
          ))}
          {recurringExpenses.length === 0 && (
            <p className="text-sm text-slate-500 md:col-span-2">No recurring commitments captured yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
