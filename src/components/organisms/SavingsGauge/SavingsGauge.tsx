import type { Account, Currency, Transaction } from '../../../types';
import { Button } from '../../atoms/Button';
import { Card } from '../../atoms/Card';
import { SectionHeading } from '../../atoms/SectionHeading';
import { SavingsCaptureDialog } from './SavingsCaptureDialog';
import { SavingsGaugeDial } from './SavingsGaugeDial';
import { useSavingsCapture } from './useSavingsCapture';

function formatCurrency(value: number, currency: Currency) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

type ManualTransactionInput = Omit<
  Transaction,
  'id' | 'createdAt' | 'updatedAt' | 'isRecurringMatch' | 'isPlannedMatch'
>;

interface SavingsGaugeProps {
  savingsRate: number;
  income: number;
  expenses: number;
  assetAccounts: Account[];
  profileCurrency: Currency;
  onRecordSavings: (payload: ManualTransactionInput) => Promise<Transaction>;
}

export function SavingsGauge({
  savingsRate,
  income,
  expenses,
  assetAccounts,
  profileCurrency,
  onRecordSavings
}: SavingsGaugeProps) {
  const {
    form,
    setForm,
    isDialogOpen,
    isSaving,
    error,
    showSaved,
    openDialog,
    closeDialog,
    handleSubmit,
    savingsDisabled,
    requireAssetAccount
  } = useSavingsCapture({ assetAccounts, profileCurrency, onRecordSavings });

  return (
    <Card className="relative p-6">
      <SectionHeading>Savings &amp; Investment Rate</SectionHeading>
      <p className="mt-1 text-sm text-slate-400">How efficiently is capital being deployed?</p>
      <div className="mt-6 flex flex-col items-center gap-6 text-center sm:flex-row sm:text-left">
        <SavingsGaugeDial savingsRate={savingsRate} />
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-slate-400">Income:</span> {formatCurrency(income, profileCurrency)}
          </p>
          <p>
            <span className="text-slate-400">Expenses:</span> {formatCurrency(expenses, profileCurrency)}
          </p>
          <p>
            <span className="text-slate-400">Savings:</span> {formatCurrency(income - expenses, profileCurrency)}
          </p>
          <p className="text-xs text-slate-500">Target ≥ 40% for aggressive wealth creation.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="button"
          onClick={() => {
            if (savingsDisabled) {
              requireAssetAccount();
              return;
            }
            openDialog();
          }}
          variant="secondary"
          disabled={savingsDisabled}
        >
          Record savings entry
        </Button>
        {showSaved ? (
          <span className="text-xs font-medium text-emerald-300">Savings recorded and balances updated.</span>
        ) : null}
        {error && !isDialogOpen ? <span className="text-xs text-danger">{error}</span> : null}
        {savingsDisabled ? (
          <span className="text-xs text-slate-500">
            Add an asset-linked account to include savings in your net worth.
          </span>
        ) : null}
      </div>

      <SavingsCaptureDialog
        isOpen={isDialogOpen}
        form={form}
        isSaving={isSaving}
        error={error}
        assetAccounts={assetAccounts}
        onClose={() => {
          closeDialog();
        }}
        onSubmit={handleSubmit}
        onFormChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
      />
    </Card>
  );
}
