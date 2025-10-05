import type { ReactNode } from 'react';

interface LedgerListProps<TItem> {
  title: string;
  emptyMessage: string;
  items: TItem[];
  renderItem: (item: TItem) => ReactNode;
  getKey?: (item: TItem, index: number) => string | number;
}

export function LedgerList<TItem>({ title, emptyMessage, items, renderItem, getKey }: LedgerListProps<TItem>) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
      <ul className="mt-2 space-y-2 text-sm text-slate-300">
        {items.length === 0 ? (
          <li className="text-slate-500">{emptyMessage}</li>
        ) : (
          items.map((item, index) => {
            const key = getKey ? getKey(item, index) : index;
            return <li key={key}>{renderItem(item)}</li>;
          })
        )}
      </ul>
    </div>
  );
}
