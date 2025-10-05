import { Fragment } from 'react';
import type { JSX } from 'react';
import { PlannedExpenseItemCard } from '../molecules/PlannedExpenseItemCard';
import type {
  CategoryNode,
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

const ChevronRightIcon = ({ className = 'h-3.5 w-3.5' }: { className?: string }): JSX.Element => (
  <svg viewBox="0 0 20 20" className={className} aria-hidden>
    <path d="m7 5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
    tree,
    expanded,
    toggleCategory,
    categorySummaries,
    itemsByCategory,
    expenseDescendantsMap,
    normalisedSearchTerm,
    navigatorFilter,
    focusCategory,
    visibleUncategorisedDetails,
    navigatorView,
    priorityGroups,
    hasNavigatorResults,
    renderedCategories
  } = categories;
  const { visibleColumns, gridTemplateColumns } = table;
  const columnLabels: Record<SmartBudgetingColumnKey, string> = {
    category: 'Category / Planned items',
    earliestDue: 'Earliest due',
    planned: 'Planned',
    actual: 'Actual',
    variance: 'Variance',
    actions: 'Actions'
  } as const;

  const renderCategorySection = (category: CategoryNode, depth = 0): JSX.Element | null => {
    const summary = categorySummaries.get(category.id) ?? {
      planned: 0,
      actual: 0,
      variance: 0,
      itemCount: 0,
      remainder: 0
    };
    const directItems = itemsByCategory.get(category.id) ?? [];
    const categoryStatus = summary.actual === 0 ? 'not-spent' : summary.variance >= 0 ? 'under' : 'over';
    const statusToken = utils.SPENDING_BADGE_STYLES[categoryStatus];
    const descendantIds = expenseDescendantsMap.get(category.id) ?? new Set<string>([category.id]);
    const remainderValue = summary.remainder;
    const remainderClass = remainderValue >= 0 ? 'text-success' : 'text-danger';
    const remainderLabel = remainderValue >= 0 ? 'Remaining' : 'Overspent';
    const remainderDescriptor = summary.actual === 0 && remainderValue >= 0 ? 'Awaiting spend' : remainderLabel;
    const nextDueDetail = categories.visibleCategoryDetails.reduce<PlannedExpenseDetail | null>((closest, detail) => {
      if (!descendantIds.has(detail.item.categoryId) || !detail.item.dueDate) {
        return closest;
      }
      if (!closest || !closest.item.dueDate) return detail;
      const currentTime = new Date(detail.item.dueDate).getTime();
      const closestTime = new Date(closest.item.dueDate).getTime();
      return currentTime < closestTime ? detail : closest;
    }, null);
    const nextDueLabel =
      nextDueDetail && nextDueDetail.item.dueDate
        ? new Date(nextDueDetail.item.dueDate).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric'
          })
        : null;
    const dueDisplayLabel = nextDueLabel ?? 'No due dates';
    const dueTextClass = nextDueLabel ? 'text-slate-100' : 'text-slate-500';
    const dueIconClass = nextDueLabel ? 'text-slate-400' : 'text-slate-700';
    const matchesCategorySearch =
      normalisedSearchTerm !== '' && category.name.toLowerCase().includes(normalisedSearchTerm);
    const visibleDirectItems = directItems.filter((detail) => {
      const matchesStatus = navigatorFilter === 'all' || detail.status === navigatorFilter;
      const matchesName =
        normalisedSearchTerm === '' ||
        detail.item.name.toLowerCase().includes(normalisedSearchTerm) ||
        matchesCategorySearch;
      return matchesStatus && matchesName;
    });
    const childSections = category.children
      .map((child) => renderCategorySection(child, depth + 1))
      .filter((child): child is JSX.Element => child !== null);
    const hasVisibleItems = visibleDirectItems.length > 0;
    const hasVisibleChildren = childSections.length > 0;
    const canExpand = hasVisibleItems || hasVisibleChildren;
    const matchesStatusForCategory = navigatorFilter === 'all' || categoryStatus === navigatorFilter;

    if (!matchesStatusForCategory && !hasVisibleItems && !hasVisibleChildren && !matchesCategorySearch) {
      return null;
    }

    const isFocused = categories.focusedCategoryId === category.id;
    const shouldAutoExpand =
      normalisedSearchTerm !== '' && (matchesCategorySearch || hasVisibleItems || hasVisibleChildren);
    const isExpanded = canExpand && (shouldAutoExpand || Boolean(expanded[category.id]));
    const focusClass = isFocused ? 'bg-slate-900/60 ring-1 ring-inset ring-accent/40' : 'bg-slate-950/30 hover:bg-slate-900/50';
    const dimClass =
      normalisedSearchTerm !== '' && !matchesCategorySearch && !hasVisibleItems && !hasVisibleChildren
        ? 'opacity-70'
        : '';
    const handleToggle = () => {
      focusCategory(category.id);
      if (canExpand) {
        toggleCategory(category.id);
      }
    };
    const indentation = depth * 20;

    return (
      <div key={category.id} className={dimClass}>
        <div
          onClick={() => focusCategory(category.id, true)}
          className={`grid cursor-pointer items-center gap-4 border-t border-slate-800/70 px-4 py-3 text-[11px] sm:text-xs transition ${focusClass}`}
          style={{ gridTemplateColumns }}
        >
          {visibleColumns.map((column) => {
            if (column === 'category') {
              return (
                <div
                  key={`${category.id}-${column}`}
                  className="flex min-w-0 items-center gap-3"
                  style={{ paddingLeft: indentation }}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggle();
                    }}
                    aria-expanded={Boolean(isExpanded)}
                    aria-disabled={!canExpand}
                    className={`flex h-6 w-6 items-center justify-center rounded-md border border-slate-700 bg-slate-950/60 text-slate-400 transition ${
                      canExpand ? 'hover:border-accent hover:text-accent' : 'cursor-default opacity-40'
                    }`}
                  >
                    {canExpand ? (
                      <span
                        aria-hidden
                        className={`flex items-center justify-center transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      >
                        <ChevronRightIcon />
                      </span>
                    ) : (
                      <span aria-hidden className="block h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                    <span className="sr-only">
                      {canExpand ? (isExpanded ? 'Collapse category' : 'Expand category') : 'No nested items'}
                    </span>
                  </button>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-100">{category.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusToken.badgeClass}`}>
                        {statusToken.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span>{summary.itemCount} planned item{summary.itemCount === 1 ? '' : 's'}</span>
                      {nextDueLabel && <span>Next due {nextDueLabel}</span>}
                    </div>
                  </div>
                </div>
              );
            }
            if (column === 'earliestDue') {
              return (
                <div key={`${category.id}-${column}`} className="flex items-center justify-end gap-2 text-xs text-slate-300">
                  <CalendarIcon className={`h-4 w-4 ${dueIconClass}`} />
                  <span className={`whitespace-nowrap text-sm font-semibold ${dueTextClass}`}>{dueDisplayLabel}</span>
                </div>
              );
            }
            if (column === 'planned') {
              return (
                <div
                  key={`${category.id}-${column}`}
                  className="whitespace-nowrap text-right text-sm font-semibold text-warning"
                >
                  {utils.formatCurrency(summary.planned)}
                </div>
              );
            }
            if (column === 'actual') {
              return (
                <div
                  key={`${category.id}-${column}`}
                  className="whitespace-nowrap text-right text-sm font-semibold text-slate-200"
                >
                  {utils.formatCurrency(summary.actual)}
                </div>
              );
            }
            if (column === 'variance') {
              return (
                <div
                  key={`${category.id}-${column}`}
                  className="flex flex-nowrap items-center justify-end gap-2 text-right"
                >
                  <span className={`whitespace-nowrap text-sm font-semibold ${remainderClass}`}>
                    {utils.formatCurrency(summary.variance)}
                  </span>
                  <span className="whitespace-nowrap rounded-full bg-slate-900/40 px-2 py-0.5 text-[10px] text-slate-400">
                    {remainderDescriptor}
                  </span>
                </div>
              );
            }
            return <div key={`${category.id}-${column}`} className="flex items-center justify-end" />;
          })}
        </div>
        {isExpanded && (
          <div className="bg-slate-950/15">
            {visibleDirectItems.length > 0 &&
              visibleDirectItems.map((item) => (
                <PlannedExpenseItemCard
                  key={item.item.id}
                  detail={item}
                  depth={depth + 1}
                  categories={categories}
                  editing={editing}
                  table={table}
                  utils={utils}
                />
              ))}
            {childSections}
          </div>
        )}
      </div>
    );
  };

  const categorySections = renderedCategories
    .map((category) => renderCategorySection(category))
    .filter((section): section is JSX.Element => section !== null);

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
          {categorySections.length > 0 && (
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
                  <div>{categorySections}</div>
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
