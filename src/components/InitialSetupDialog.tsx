import { FormEvent, useState } from 'react';
import { useFinancialStore } from '../store/FinancialStoreProvider';
import type { Account, Currency } from '../types';

const accountTypes: Account['type'][] = ['bank', 'cash', 'investment', 'loan', 'real-estate', 'other'];

interface AccountDraft {
  name: string;
  type: Account['type'];
  balance: string;
  notes?: string;
}

export function InitialSetupDialog() {
  const { isReady, isInitialised, hasDismissedInitialSetup, completeInitialSetup, dismissInitialSetup } =
    useFinancialStore();
  const [currency, setCurrency] = useState<Currency>('INR');
  const [financialStartDate, setFinancialStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [openingBalanceNote, setOpeningBalanceNote] = useState('');
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { name: '', type: 'bank', balance: '' },
    { name: '', type: 'cash', balance: '' }
  ]);

  if (!isReady || isInitialised || hasDismissedInitialSetup) {
    return null;
  }

  const updateAccount = (index: number, updater: Partial<AccountDraft>) => {
    setAccounts((prev) => prev.map((account, idx) => (idx === index ? { ...account, ...updater } : account)));
  };

  const addAccountRow = () => {
    setAccounts((prev) => [...prev, { name: '', type: 'bank', balance: '' }]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const preparedAccounts = accounts
      .filter((account) => account.name.trim())
      .map((account) => ({
        name: account.name,
        type: account.type,
        balance: Number.parseFloat(account.balance || '0') || 0,
        currency,
        notes: account.notes
      }));

    await completeInitialSetup({
      currency,
      financialStartDate,
      openingBalanceNote: openingBalanceNote || undefined,
      accounts: preparedAccounts
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl space-y-4 rounded-2xl border border-slate-800 bg-slate-900/95 p-6 text-sm shadow-2xl"
      >
        <header className="space-y-2 text-center">
          <h2 className="text-xl font-semibold text-slate-100">Let’s initialise your ledger</h2>
          <p className="text-xs text-slate-400">
            Provide your baseline currency, start date, and opening balances. No synthetic data will ever be injected.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase text-slate-500">Base currency</span>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value as Currency)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
            >
              <option value="INR">Indian Rupee (₹)</option>
              <option value="USD">US Dollar ($)</option>
              <option value="EUR">Euro (€)</option>
              <option value="GBP">British Pound (£)</option>
              <option value="SGD">Singapore Dollar (S$)</option>
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs uppercase text-slate-500">Financial tracking starts on</span>
            <input
              type="date"
              value={financialStartDate}
              onChange={(event) => setFinancialStartDate(event.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase text-slate-500">Opening balance context (optional)</span>
          <textarea
            rows={2}
            value={openingBalanceNote}
            onChange={(event) => setOpeningBalanceNote(event.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
            placeholder="e.g. Carry-forward balances from FY24 closing accounts"
          />
        </label>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200">Opening balances</h3>
            <button
              type="button"
              onClick={addAccountRow}
              className="rounded-lg border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
            >
              Add account
            </button>
          </div>
          <div className="space-y-2">
            {accounts.map((account, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="text-xs uppercase text-slate-500">Account name</label>
                  <input
                    required={index === 0}
                    value={account.name}
                    onChange={(event) => updateAccount(index, { name: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                    placeholder={index === 0 ? 'e.g. HDFC Savings' : 'Optional'}
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-500">Type</label>
                  <select
                    value={account.type}
                    onChange={(event) => updateAccount(index, { type: event.target.value as Account['type'] })}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                  >
                    {accountTypes.map((type) => (
                      <option key={type} value={type}>
                        {type.replace('-', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-500">Opening balance ({currency})</label>
                  <input
                    type="number"
                    min={0}
                    value={account.balance}
                    onChange={(event) => updateAccount(index, { balance: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                    placeholder="0"
                  />
                </div>
                <div className="sm:col-span-4">
                  <label className="text-xs uppercase text-slate-500">Notes</label>
                  <input
                    value={account.notes ?? ''}
                    onChange={(event) => updateAccount(index, { notes: event.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                    placeholder="Optional context for this balance"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={dismissInitialSetup}
            className="text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-300"
          >
            Skip for now
          </button>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-sky-300"
          >
            Launch my offline ledger
          </button>
        </div>
      </form>
    </div>
  );
}
