import { format } from 'date-fns';
import type { Transaction } from '../../types';
import { cn } from '../../utils/cn';
import { Card } from '../atoms/Card';
import { SectionHeading } from '../atoms/SectionHeading';
import { DataTable, type DataTableColumn } from '../molecules/DataTable';

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
  const columns: Array<DataTableColumn<Transaction>> = [
    {
      id: 'date',
      header: 'Date',
      width: 'max-content',
      render: (txn) => format(new Date(txn.date), 'd MMM')
    },
    {
      id: 'description',
      header: 'Description',
      minWidth: '220px',
      width: '2fr',
      render: (txn) => txn.description,
      cellClassName: 'truncate'
    },
    {
      id: 'category',
      header: 'Category',
      minWidth: '180px',
      width: '1fr',
      render: (txn) => resolveCategoryName(txn.categoryId)
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      minWidth: '120px',
      width: 'max-content',
      render: (txn) => formatCurrency(txn.amount),
      cellClassName: (txn) => cn('font-medium', txn.amount < 0 ? 'text-danger' : 'text-success')
    }
  ];

  return (
    <section>
      <SectionHeading className="mb-3">Recent Transactions</SectionHeading>
      <Card className="border border-slate-800">
        <DataTable
          data={transactions}
          columns={columns}
          keyExtractor={(txn) => txn.id}
          emptyState="No transactions recorded yet."
        />
      </Card>
    </section>
  );
}
