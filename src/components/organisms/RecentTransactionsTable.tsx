import { format } from 'date-fns';
import type { Transaction } from '../../types';
import { Card } from '../atoms/Card';
import { SectionHeading } from '../atoms/SectionHeading';

interface RecentTransactionsTableProps {
  transactions: Transaction[];
  resolveCategoryName: (categoryId: string | undefined) => string;
  formatCurrency: (value: number) => string;
}

export function RecentTransactionsTable({
  transactions,
  resolveCategoryName,
  formatCurrency
}: RecentTransactionsTableProps) {
  return (
    <section>
      <SectionHeading className="mb-3">Recent Transactions</SectionHeading>
      <Card className="border border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {transactions.map((txn) => (
                <tr key={txn.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3">{format(new Date(txn.date), 'd MMM')}</td>
                  <td className="px-4 py-3">{txn.description}</td>
                  <td className="px-4 py-3">{resolveCategoryName(txn.categoryId)}</td>
                  <td className={`px-4 py-3 text-right ${txn.amount < 0 ? 'text-danger' : 'text-success'}`}>
                    {formatCurrency(txn.amount)}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">
                    No transactions recorded yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}
