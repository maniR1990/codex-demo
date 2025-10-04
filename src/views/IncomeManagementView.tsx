import { FormEvent, useEffect, useMemo, useState } from 'react';
import { format, formatISO, parseISO } from 'date-fns';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import type { Category } from '../types';

const categoryTypes: Category['type'][] = ['income', 'expense', 'asset', 'liability'];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function IncomeManagementView() {
  const {
    monthlyIncomes,
    categories,
    addMonthlyIncome,
    updateMonthlyIncome,
    deleteMonthlyIncome,
    addCategory,
    updateCategory,
    deleteCategory
  } = useFinancialStore();

  const incomeCategories = useMemo(
    () => categories.filter((category) => category.type === 'income'),
    [categories]
  );

  const [incomeForm, setIncomeForm] = useState({
    source: '',
    amount: 0,
    receivedOn: formatISO(new Date(), { representation: 'date' }),
    categoryId: incomeCategories[0]?.id ?? '',
    notes: ''
  });

  useEffect(() => {
    if (!incomeForm.categoryId && incomeCategories[0]) {
      setIncomeForm((prev) => ({ ...prev, categoryId: incomeCategories[0].id }));
    }
  }, [incomeCategories, incomeForm.categoryId]);

  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [editingIncomeState, setEditingIncomeState] = useState({
    source: '',
    amount: 0,
    receivedOn: formatISO(new Date(), { representation: 'date' }),
    categoryId: '',
    notes: ''
  });

  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'income' as Category['type'] });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryState, setEditingCategoryState] = useState({ name: '', type: 'income' as Category['type'] });

  const totalIncome = useMemo(
    () => monthlyIncomes.reduce((sum, income) => sum + income.amount, 0),
    [monthlyIncomes]
  );

  const groupedCategories = useMemo(() => {
    return categoryTypes.map((type) => ({
      type,
      items: categories.filter((category) => category.type === type)
    }));
  }, [categories]);

  const handleIncomeSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!incomeForm.categoryId && incomeCategories[0]) {
      setIncomeForm((prev) => ({ ...prev, categoryId: incomeCategories[0].id }));
    }
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
    const category = await addCategory({
      name: categoryForm.name,
      type: categoryForm.type,
      isCustom: true
    });
    if (category.type === 'income') {
      setIncomeForm((prev) => ({ ...prev, categoryId: category.id }));
    }
    setCategoryForm({ name: '', type: 'income' });
  };

  const startEditingCategory = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;
    setEditingCategoryId(categoryId);
    setEditingCategoryState({ name: category.name, type: category.type });
  };

  const handleCategoryUpdate = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCategoryId) return;
    await updateCategory(editingCategoryId, {
      name: editingCategoryState.name,
      type: editingCategoryState.type
    });
    setEditingCategoryId(null);
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Income & Category Management</h2>
        <p className="text-sm text-slate-400">
          Capture monthly income inflows, refine budget categories, and keep every stream audit-ready.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Monthly income tracker</h3>
            <p className="text-xs text-slate-500">Maintain predictable inflows and assign them to strategic goals.</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-sm">
            Total committed income: <span className="font-semibold text-success">{formatCurrency(totalIncome)}</span>
          </div>
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

        <div className="mt-8 overflow-x-auto">
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
              {monthlyIncomes.map((income) => {
                const category = categories.find((item) => item.id === income.categoryId)?.name ?? 'Uncategorised';
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
                        category
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
              {monthlyIncomes.length === 0 && (
                <tr>
                  <td className="px-4 py-3 text-center text-sm text-slate-500" colSpan={6}>
                    No income entries yet. Add your first source above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <h3 className="text-lg font-semibold">Category governance</h3>
        <p className="text-xs text-slate-500">
          Create, rename, or retire categories to keep analytics and budgets consistent across the platform.
        </p>

        <form onSubmit={handleAddCategory} className="mt-6 grid gap-4 md:grid-cols-[1fr,180px,auto]">
          <input
            required
            placeholder="Category name"
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            value={categoryForm.name}
            onChange={(event) => setCategoryForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <select
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
            value={categoryForm.type}
            onChange={(event) =>
              setCategoryForm((prev) => ({ ...prev, type: event.target.value as Category['type'] }))
            }
          >
            {categoryTypes.map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-300"
          >
            Add category
          </button>
        </form>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {groupedCategories.map(({ type, items }) => (
            <article key={type} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
              <header className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    {type.toUpperCase()} CATEGORIES
                  </h4>
                  <p className="text-xs text-slate-500">{items.length} tracked</p>
                </div>
              </header>
              <ul className="mt-4 space-y-3 text-sm">
                {items.map((category) => {
                  const isEditing = editingCategoryId === category.id;
                  return (
                    <li key={category.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                      {isEditing ? (
                        <form onSubmit={handleCategoryUpdate} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            className="flex-1 rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm"
                            value={editingCategoryState.name}
                            onChange={(event) =>
                              setEditingCategoryState((prev) => ({ ...prev, name: event.target.value }))
                            }
                          />
                          <select
                            className="rounded-lg border border-slate-800 bg-slate-950 px-2 py-1 text-sm"
                            value={editingCategoryState.type}
                            onChange={(event) =>
                              setEditingCategoryState((prev) => ({
                                ...prev,
                                type: event.target.value as Category['type']
                              }))
                            }
                          >
                            {categoryTypes.map((typeOption) => (
                              <option key={typeOption} value={typeOption}>
                                {typeOption.charAt(0).toUpperCase() + typeOption.slice(1)}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="rounded-lg bg-success/20 px-3 py-1 text-xs font-semibold text-success"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold"
                              onClick={() => setEditingCategoryId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-semibold text-slate-100">{category.name}</p>
                            <p className="text-xs text-slate-500">
                              {category.isCustom ? 'Custom' : 'System'} • {category.type}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold"
                              onClick={() => startEditingCategory(category.id)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="rounded-lg bg-danger/20 px-3 py-1 text-xs font-semibold text-danger"
                              onClick={() => deleteCategory(category.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
                {items.length === 0 && (
                  <li className="text-xs text-slate-500">No categories defined in this group yet.</li>
                )}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
