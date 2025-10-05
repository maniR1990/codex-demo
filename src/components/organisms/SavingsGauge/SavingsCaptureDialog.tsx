import type { Account } from '../../../types';
import { Button } from '../../atoms/Button';
import { todayInputValue } from './useSavingsCapture';

interface SavingsCaptureDialogProps {
  isOpen: boolean;
  form: {
    label: string;
    amount: string;
    accountId: string;
    date: string;
    notes: string;
  };
  isSaving: boolean;
  error: string | null;
  assetAccounts: Account[];
  onClose: () => void;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onFormChange: (field: string, value: string) => void;
}

export function SavingsCaptureDialog({
  isOpen,
  form,
  isSaving,
  error,
  assetAccounts,
  onClose,
  onSubmit,
  onFormChange
}: SavingsCaptureDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-emerald-300">Record a savings transfer</h3>
            <p className="mt-1 text-sm text-slate-400">
              Move surplus income into your asset accounts so the balance reflects in Total Net Worth.
            </p>
          </div>
          <Button type="button" variant="ghost" className="p-1" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="savings-label">
              Savings label
            </label>
            <input
              id="savings-label"
              type="text"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              placeholder="e.g. Emergency fund top-up"
              value={form.label}
              onChange={(event) => onFormChange('label', event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="savings-amount">
                Amount
              </label>
              <input
                id="savings-amount"
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                placeholder="50000"
                value={form.amount}
                onChange={(event) => onFormChange('amount', event.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-200" htmlFor="savings-date">
                Transfer date
              </label>
              <input
                id="savings-date"
                type="date"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                value={form.date}
                max={todayInputValue()}
                onChange={(event) => onFormChange('date', event.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="savings-account">
              Destination account
            </label>
            <select
              id="savings-account"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              value={form.accountId}
              onChange={(event) => onFormChange('accountId', event.target.value)}
              required
            >
              <option value="" disabled>
                Select an account
              </option>
              {assetAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="savings-notes">
              Notes (optional)
            </label>
            <textarea
              id="savings-notes"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
              rows={3}
              placeholder="Any context for this transfer"
              value={form.notes}
              onChange={(event) => onFormChange('notes', event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSaving} disabled={isSaving}>
              {isSaving ? 'Recording…' : 'Record savings'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
