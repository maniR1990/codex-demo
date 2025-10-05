import type { Currency } from '../../types';
import { Card } from '../atoms/Card';
import { SectionHeading } from '../atoms/SectionHeading';

type TopSpendingCategory = {
  category: string;
  total: number;
};

interface TopSpendingCategoriesProps {
  items: TopSpendingCategory[];
  currency?: Currency;
}

export function TopSpendingCategories({ items, currency = 'INR' }: TopSpendingCategoriesProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0
    }).format(value);

  return (
    <Card className="p-5">
      <SectionHeading className="mb-4">Top Spending Categories</SectionHeading>
      <ol className="space-y-3 text-sm">
        {items.map((item) => (
          <li key={item.category} className="flex items-center justify-between">
            <span className="text-slate-300">{item.category}</span>
            <span className="font-semibold text-slate-100">{formatCurrency(item.total)}</span>
          </li>
        ))}
        {items.length === 0 ? <p className="text-sm text-slate-500">No spending recorded yet.</p> : null}
      </ol>
    </Card>
  );
}
