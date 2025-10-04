import { useMemo, useState } from 'react';
import { useFinancialStore } from '../store/FinancialStoreProvider';

interface FormState {
  description: string;
  amount: string;
  accountId: string;
  categoryId: string;
  subcategoryId: string;
  date: string;
  notes: string;
}

const todayInputValue = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function QuickExpenseCapture() {
  const { accounts, categories, profile, addManualTransaction } = useFinancialStore();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    description: '',
    amount: '',
    accountId: '',
    categoryId: '',
    subcategoryId: '',
    date: todayInputValue(),
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense'),
    [categories]
  );

  const parentCategories = useMemo(
    () => expenseCategories.filter((category) => !category.parentId),
    [expenseCategories]
  );

  const childCategoriesByParent = useMemo(() => {
    return expenseCategories.reduce<Record<string, typeof expenseCategories>>((acc, category) => {
      if (!category.parentId) return acc;
      if (!acc[category.parentId]) {
        acc[category.parentId] = [];
      }
      acc[category.parentId].push(category);
      return acc;
    }, {});
  }, [expenseCategories]);

  const resetForm = () => {
    setForm({
      description: '',
      amount: '',
      accountId: '',
      categoryId: '',
      subcategoryId: '',
      date: todayInputValue(),
      notes: ''
    });
    setError(null);
  };

  const selectedAccountCurrency = useMemo(() => {
    const selectedAccount = accounts.find((account) => account.id === form.accountId);
    return selectedAccount?.currency ?? profile?.currency ?? 'INR';
  }, [accounts, form.accountId, profile?.currency]);

  const activeSubcategories = form.categoryId ? childCategoriesByParent[form.categoryId] ?? [] : [];

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);

    if (!form.description.trim()) {
      setError('Please enter what you spent on.');
      return;
    }

    const amountValue = Number.parseFloat(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    if (!form.accountId) {
      setError('Choose the account that funded this purchase.');
      return;
    }

    if (!form.categoryId && !form.subcategoryId) {
      setError('Pick a category so the expense can be tracked.');
      return;
    }

    const expenseCategoryId = form.subcategoryId || form.categoryId;

    const isoDate = new Date(`${form.date}T00:00:00`).toISOString();

    setIsSaving(true);
    try {
      await addManualTransaction({
        accountId: form.accountId,
        amount: -Math.abs(amountValue),
        currency: selectedAccountCurrency,
        date: isoDate,
        description: form.description.trim(),
        categoryId: expenseCategoryId,
        notes: form.notes.trim() ? form.notes.trim() : undefined
      });
      setShowSaved(true);
      resetForm();
      setIsOpen(false);
      window.setTimeout(() => setShowSaved(false), 2800);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Something went wrong while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const disabled = accounts.length === 0 || parentCategories.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (disabled) {
            setShowSaved(false);
            setError('Add an account and expense categories first to start tracking spends.');
            setIsOpen(true);
            return;
          }
          setError(null);
          setIsOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span className="text-lg leading-none">＋</span>
        Log spend
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-accent">Log a new spend</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Capture purchases instantly so your dashboards stay current.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setError(null);
                }}
                className="rounded-full border border-transparent p-1 text-slate-400 transition hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {disabled ? (
              <div className="mt-6 rounded-lg border border-dashed border-slate-700 bg-slate-900/70 p-4 text-sm text-slate-400">
                You need at least one account and an expense category before recording spends. Add them from the Income &amp;
                Categories view first.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-200" htmlFor="description">
                    What did you spend on?
                  </label>
                  <input
                    id="description"
                    type="text"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                    placeholder="e.g. iPhone 15 Pro"
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-200" htmlFor="amount">
                      Amount ({selectedAccountCurrency})
                    </label>
                    <input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-200" htmlFor="date">
                      Date
                    </label>
                    <input
                      id="date"
                      type="date"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                      value={form.date}
                      max={todayInputValue()}
                      onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200" htmlFor="account">
                    Paid from account
                  </label>
                  <select
                    id="account"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                    value={form.accountId}
                    onChange={(event) => setForm((prev) => ({ ...prev, accountId: event.target.value }))}
                    required
                  >
                    <option value="">Select an account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} · {account.currency} · Balance {account.balance.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-200" htmlFor="category">
                      Category
                    </label>
                    <select
                      id="category"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                      value={form.categoryId}
                      onChange={(event) => setForm((prev) => ({ ...prev, categoryId: event.target.value, subcategoryId: '' }))}
                      required
                    >
                      <option value="">Select category</option>
                      {parentCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-200" htmlFor="subcategory">
                      Sub-category (optional)
                    </label>
                    <select
                      id="subcategory"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50"
                      value={form.subcategoryId}
                      onChange={(event) => setForm((prev) => ({ ...prev, subcategoryId: event.target.value }))}
                      disabled={activeSubcategories.length === 0}
                    >
                      <option value="">No sub-category</option>
                      {activeSubcategories.map((subcategory) => (
                        <option key={subcategory.id} value={subcategory.id}>
                          {subcategory.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200" htmlFor="notes">
                    Notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                    placeholder="Add context such as warranty or payment terms"
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </div>

                {error ? <p className="text-sm text-rose-400">{error}</p> : null}

                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      setError(null);
                    }}
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 shadow transition hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSaving ? 'Saving…' : 'Save expense'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {showSaved ? (
        <div className="fixed bottom-6 right-6 z-30 rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300 shadow-lg backdrop-blur">
          Spend saved. Dashboards will refresh automatically.
        </div>
      ) : null}
    </>
  );
}
