import { useEffect, useMemo, useState } from 'react';
import type { FormEventHandler } from 'react';
import type { Account, Currency, Transaction } from '../../../types';

type ManualTransactionInput = Omit<
  Transaction,
  'id' | 'createdAt' | 'updatedAt' | 'isRecurringMatch' | 'isPlannedMatch'
>;

interface UseSavingsCaptureOptions {
  assetAccounts: Account[];
  profileCurrency: Currency;
  onRecordSavings: (payload: ManualTransactionInput) => Promise<Transaction>;
}

const initialFormState = (defaultAccountId: string) => ({
  label: '',
  amount: '',
  accountId: defaultAccountId,
  date: todayInputValue(),
  notes: ''
});

export function useSavingsCapture({
  assetAccounts,
  profileCurrency,
  onRecordSavings
}: UseSavingsCaptureOptions) {
  const defaultAccountId = useMemo(() => assetAccounts[0]?.id ?? '', [assetAccounts]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [form, setForm] = useState(initialFormState(defaultAccountId));

  useEffect(() => {
    setForm((prev) => ({ ...prev, accountId: defaultAccountId }));
  }, [defaultAccountId]);

  useEffect(() => {
    if (!showSaved) {
      return;
    }
    const timeout = window.setTimeout(() => setShowSaved(false), 2800);
    return () => window.clearTimeout(timeout);
  }, [showSaved]);

  const resetForm = () => {
    setForm(initialFormState(defaultAccountId));
    setError(null);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const openDialog = (message?: string) => {
    setError(message ?? null);
    setIsDialogOpen(true);
  };

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    setError(null);

    const amountValue = Number.parseFloat(form.amount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError('Enter a valid amount greater than zero.');
      return;
    }

    if (!form.accountId) {
      setError('Choose an account to park the savings.');
      return;
    }

    const selectedAccount = assetAccounts.find((account) => account.id === form.accountId);
    const currency = selectedAccount?.currency ?? profileCurrency;
    const isoDate = new Date(`${form.date}T00:00:00`).toISOString();

    setIsSaving(true);
    try {
      await onRecordSavings({
        accountId: form.accountId,
        amount: Math.abs(amountValue),
        currency,
        date: isoDate,
        description: form.label.trim() ? form.label.trim() : 'Savings deposit',
        notes: form.notes.trim() ? form.notes.trim() : undefined
      });
      setShowSaved(true);
      closeDialog();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to record savings right now.');
    } finally {
      setIsSaving(false);
    }
  };

  const savingsDisabled = assetAccounts.length === 0;

  const requireAssetAccount = () =>
    openDialog('Add a bank, cash, or investment account first to start tracking savings.');

  return {
    form,
    setForm,
    isDialogOpen,
    isSaving,
    error,
    showSaved,
    openDialog,
    closeDialog,
    handleSubmit,
    resetForm,
    savingsDisabled,
    requireAssetAccount
  };
}

export function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
