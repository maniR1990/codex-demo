import { useEffect, useRef } from 'react';
import { PlannedExpenseItemCard } from '../molecules/PlannedExpenseItemCard';
import type {
  PlannedExpenseDetail,
  SmartBudgetingColumnKey,
  SmartBudgetingController
} from '../hooks/useSmartBudgetingController';

interface CategoryNavigatorProps {
  categories: SmartBudgetingController['categories'];
  editing: SmartBudgetingController['editing'];
  table: SmartBudgetingController['table'];
  utils: SmartBudgetingController['utils'];
}

export function CategoryNavigator({ categories, editing, table, utils }: CategoryNavigatorProps) {
  const {
    visibleNavigatorDetails,
    navigatorView,
    priorityGroups,
    hasNavigatorResults,
    focusedDetailId
  } = categories;
  const { visibleColumns, gridTemplateColumns } = table;

  const columnLabels: Record<SmartBudgetingColumnKey, string> = {
    category: 'Category',
    item: 'Item',
    planned: 'Planned',
    actual: 'Actual',
    variance: 'Variance',
    due: 'Due',
    status: 'Status',
    priority: 'Priority'
  } as const;
  const headerAlignment: Record<SmartBudgetingColumnKey, string> = {
    category: 'text-left',
    item: 'text-left',
    planned: 'text-right',
    actual: 'text-right',
    variance: 'text-right',
    due: 'text-left',
    status: 'text-left',
    priority: 'text-left'
  };

  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (navigatorView !== 'category' || !focusedDetailId) {
      return;
    }
    const element = itemRefs.current.get(focusedDetailId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusedDetailId, navigatorView, visibleNavigatorDetails]);

  const captureRowRef = (detailId: string) => (element: HTMLDivElement | null) => {
    if (element) {
      itemRefs.current.set(detailId, element);
    } else {
      itemRefs.current.delete(detailId);
    }
  };

  const renderDetailRow = (detail: PlannedExpenseDetail) => (
    <PlannedExpenseItemCard
      key={detail.item.id}
      detail={detail}
      depth={0}
      categories={categories}
      editing={editing}
      table={table}
      utils={utils}
      isFocused={focusedDetailId === detail.item.id}
      rowRef={captureRowRef(detail.item.id)}
    />
  );

  const categoryView = (
    <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/40 shadow-inner">
      <div className="overflow-x-auto">
        <div className="min-w-[980px] text-xs">
          <div
            className="grid items-center gap-4 border-b border-slate-800/80 bg-slate-950 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
            style={{ gridTemplateColumns }}
          >
            {visibleColumns.map((column) => (
              <span key={`header-${column}`} className={column === 'category' ? '' : 'text-right'}>
                {columnLabels[column]}
              </span>
            ))}
          </div>
          <div>
            {visibleNavigatorDetails.length > 0 ? (
              visibleNavigatorDetails.map((detail) => renderDetailRow(detail))
            ) : (
              <div className="px-4 py-6 text-center text-xs text-slate-500">
                No planned expenses match the current filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const prioritySection = (
    <div className="space-y-4">
      {(['high', 'medium', 'low'] as const).map((priority) => {
        const list = priorityGroups[priority];
        return (
          <div key={priority} className="rounded-lg border border-slate-800 bg-slate-950/50">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs text-slate-300">
              <span className="font-semibold uppercase tracking-wide">{utils.PRIORITY_TOKEN_STYLES[priority].label}</span>
              <span className="rounded-full bg-slate-800/60 px-2 py-0.5 text-[10px] text-slate-400">{list.length} items</span>
            </div>
            {list.length > 0 ? (
              <div className="divide-y divide-slate-800">
                {list.map((detail) => (
                  <PlannedExpenseItemCard
                    key={detail.item.id}
                    detail={detail}
                    depth={0}
                    categories={categories}
                    editing={editing}
                    table={table}
                    utils={utils}
                    isFocused={focusedDetailId === detail.item.id}
                  />
                ))}
              </div>
            ) : (
              <p className="px-4 py-3 text-xs text-slate-500">No items captured for this priority.</p>
            )}
          </div>
        );
      })}
    </div>
  );

  if (!hasNavigatorResults) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-6 text-center text-sm text-slate-500">
        No planned expenses found for the selected filters. Adjust the navigator filters or add new planned expenses.
      </div>
    );
  }

  return <section className="space-y-4">{navigatorView === 'category' ? categoryView : prioritySection}</section>;
}
