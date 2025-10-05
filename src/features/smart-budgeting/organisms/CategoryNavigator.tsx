import { useEffect, useRef } from 'react';
import { PlannedExpenseItemCard } from '../molecules/PlannedExpenseItemCard';
import type {
  PlannedExpenseDetail,
  SmartBudgetingColumnKey,
  SmartBudgetingController
} from '../hooks/useSmartBudgetingController';

const CalendarIcon = ({ className = 'h-4 w-4' }: { className?: string }): JSX.Element => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden>
    <rect x="3" y="5" width="14" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M3 8.5h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M7 3v2.5m6-2.5V5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

interface CategoryNavigatorProps {
  categories: SmartBudgetingController['categories'];
  editing: SmartBudgetingController['editing'];
  table: SmartBudgetingController['table'];
  utils: SmartBudgetingController['utils'];
}

export function CategoryNavigator({ categories, editing, table, utils }: CategoryNavigatorProps) {
  const {
    lookup: categoryLookup,
    visibleCategoryDetails,
    visibleUncategorisedDetails,
    navigatorView,
    priorityGroups,
    hasNavigatorResults
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

  const uncategorisedSection = visibleUncategorisedDetails.length > 0 && (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/40">
      <div className="border-b border-slate-800/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        Uncategorised items
      </div>
      <div>
        {visibleUncategorisedDetails.map((detail) => (
          <PlannedExpenseItemCard
            key={detail.item.id}
            detail={detail}
            depth={0}
            categories={categories}
            editing={editing}
            table={table}
            utils={utils}
          />
        ))}
      </div>
    </div>
  );

  const renderRemainderDescriptor = (detail: PlannedExpenseDetail) => {
    if (detail.actual === 0 && detail.remainder >= 0) {
      return 'Awaiting spend';
    }
    return detail.remainder >= 0 ? 'Remaining' : 'Overspent';
  };

  const renderDueDisplay = (detail: PlannedExpenseDetail) => {
    if (!detail.item.dueDate) {
      return { label: 'No due dates', muted: true };
    }
    const label = new Date(detail.item.dueDate).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric'
    });
    return { label, muted: false };
  };

  if (!hasNavigatorResults) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-6 text-center text-sm text-slate-500">
        No planned expenses found for the selected filters. Adjust the navigator filters or add new planned expenses.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {navigatorView === 'category' ? (
        <Fragment>
          {visibleCategoryDetails.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/40 shadow-inner">
              <div className="overflow-x-auto">
                <div className="min-w-[980px] text-xs">
                  <div
                    className="grid items-center gap-4 border-b border-slate-800/80 bg-slate-950 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                    style={{ gridTemplateColumns }}
                  >
                    {visibleColumns.map((column) => (
                      <span key={`header-${column}`} className={headerAlignment[column] ?? 'text-left'}>
                        {columnLabels[column]}
                      </span>
                    ))}
                  </div>
                  <div>
                    {visibleCategoryDetails.map((detail) => {
                      const category = categoryLookup.get(detail.item.categoryId);
                      const categoryLabel = category?.name ?? 'Uncategorised';
                      const remainderDescriptor = renderRemainderDescriptor(detail);
                      const remainderClass = detail.remainder >= 0 ? 'text-success' : 'text-danger';
                      const dueDisplay = renderDueDisplay(detail);
                      const statusToken = utils.SPENDING_BADGE_STYLES[detail.status];
                      const priorityToken = utils.PRIORITY_TOKEN_STYLES[detail.priority];

                      return (
                        <div
                          key={detail.item.id}
                          className="grid items-center gap-4 border-t border-slate-800/70 px-4 py-3 text-[11px] sm:text-xs"
                          style={{ gridTemplateColumns }}
                        >
                          {visibleColumns.map((column) => {
                            switch (column) {
                              case 'category':
                                return (
                                  <div key={`${detail.item.id}-${column}`} className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-100">{categoryLabel}</p>
                                  </div>
                                );
                              case 'item':
                                return (
                                  <div key={`${detail.item.id}-${column}`} className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-200">{detail.item.name}</p>
                                    <p className="truncate text-[10px] text-slate-500">{remainderDescriptor}</p>
                                  </div>
                                );
                              case 'planned':
                                return (
                                  <div
                                    key={`${detail.item.id}-${column}`}
                                    className="whitespace-nowrap text-right text-sm font-semibold text-warning"
                                  >
                                    {utils.formatCurrency(detail.item.plannedAmount)}
                                  </div>
                                );
                              case 'actual':
                                return (
                                  <div
                                    key={`${detail.item.id}-${column}`}
                                    className="whitespace-nowrap text-right text-sm font-semibold text-slate-200"
                                  >
                                    {utils.formatCurrency(detail.actual)}
                                  </div>
                                );
                              case 'variance':
                                return (
                                  <div
                                    key={`${detail.item.id}-${column}`}
                                    className="flex flex-nowrap items-center justify-end gap-2 text-right"
                                  >
                                    <span className={`whitespace-nowrap text-sm font-semibold ${remainderClass}`}>
                                      {utils.formatCurrency(detail.variance)}
                                    </span>
                                    <span className="whitespace-nowrap rounded-full bg-slate-900/40 px-2 py-0.5 text-[10px] text-slate-400">
                                      {remainderDescriptor}
                                    </span>
                                  </div>
                                );
                              case 'due':
                                return (
                                  <div
                                    key={`${detail.item.id}-${column}`}
                                    className="flex items-center gap-2 text-xs text-slate-300"
                                  >
                                    <CalendarIcon className={`h-4 w-4 ${dueDisplay.muted ? 'text-slate-700' : 'text-slate-400'}`} />
                                    <span
                                      className={`whitespace-nowrap text-sm font-semibold ${
                                        dueDisplay.muted ? 'text-slate-500' : 'text-slate-100'
                                      }`}
                                    >
                                      {dueDisplay.label}
                                    </span>
                                  </div>
                                );
                              case 'status':
                                return (
                                  <div
                                    key={`${detail.item.id}-${column}`}
                                    className="flex flex-wrap items-center gap-2 text-[10px]"
                                  >
                                    <span className={`rounded-full px-2 py-0.5 font-semibold ${statusToken.badgeClass}`}>
                                      {statusToken.label}
                                    </span>
                                    <span className="text-slate-400">{remainderDescriptor}</span>
                                  </div>
                                );
                              case 'priority':
                                return (
                                  <div
                                    key={`${detail.item.id}-${column}`}
                                    className="flex items-center gap-2 text-[10px] text-slate-200"
                                  >
                                    <span className={`rounded-full px-2 py-0.5 font-semibold ${priorityToken.badgeClass}`}>
                                      {priorityToken.label}
                                    </span>
                                  </div>
                                );
                              default:
                                return null;
                            }
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          {uncategorisedSection}
        </Fragment>
      ) : (
        prioritySection
      )}
    </section>
  );
}
