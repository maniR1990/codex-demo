import { useMemo } from 'react';
import { useFinancialStore } from '../store/FinancialStoreProvider';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function BalanceSheetView() {
  const { accounts, categories } = useFinancialStore();

  const assets = useMemo(
    () =>
      accounts.filter((acct) => acct.type === 'bank' || acct.type === 'investment' || acct.type === 'cash' || acct.type === 'real-estate'),
    [accounts]
  );
  const liabilities = useMemo(
    () => accounts.filter((acct) => acct.type === 'loan' || acct.type === 'credit-card'),
    [accounts]
  );

  const totalAssets = assets.reduce((sum, acct) => sum + acct.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, acct) => sum + acct.balance, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Unified Balance Sheet</h2>
          <p className="text-sm text-slate-400">Assets and liabilities with drill-down into connected and manual accounts.</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm">
          <span className="text-slate-400">Net Worth:</span>{' '}
          <span className="font-semibold text-accent">{formatCurrency(totalAssets - totalLiabilities)}</span>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Column title="Assets" total={totalAssets} items={assets.map((acct) => ({
          id: acct.id,
          name: acct.name,
          balance: acct.balance,
          category: categories.find((cat) => cat.id === acct.type)?.name ?? acct.type,
          type: acct.type,
          isManual: acct.isManual
        }))} />
        <Column title="Liabilities" total={totalLiabilities} items={liabilities.map((acct) => ({
          id: acct.id,
          name: acct.name,
          balance: acct.balance,
          category: categories.find((cat) => cat.id === acct.type)?.name ?? acct.type,
          type: acct.type,
          isManual: acct.isManual
        }))} />
      </div>
    </div>
  );
}

interface ColumnProps {
  title: string;
  total: number;
  items: {
    id: string;
    name: string;
    balance: number;
    category: string;
    type: string;
    isManual: boolean;
  }[];
}

function Column({ title, total, items }: ColumnProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-sm text-slate-400">Total: {formatCurrency(total)}</span>
      </div>
      <ul className="mt-4 space-y-3 text-sm">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-800/60 bg-slate-900/80 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-medium text-slate-100">{item.name}</p>
                <p className="text-xs text-slate-500">{item.type.toUpperCase()} • {item.isManual ? 'Manual' : 'Synced'}</p>
              </div>
              <p className="text-base font-semibold">{formatCurrency(item.balance)}</p>
            </div>
          </li>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">No records yet.</p>}
      </ul>
    </div>
  );
}
