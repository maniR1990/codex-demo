import { useId } from 'react';
import type { JSX } from 'react';
import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface NavigatorFiltersProps {
  categories: SmartBudgetingController['categories'];
  table: SmartBudgetingController['table'];
  onOpenDialog: () => void;
}

const statusIcons: Record<'all' | 'over' | 'under' | 'not-spent', JSX.Element> = {
  all: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <circle cx="5" cy="7" r="2" className="fill-current opacity-90" />
      <circle cx="10" cy="13" r="2" className="fill-current opacity-60" />
      <circle cx="15" cy="7" r="2" className="fill-current opacity-40" />
    </svg>
  ),
  over: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path
        d="M4 12.5 9 7.5l3 3 4-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.5 6.5 2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  under: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <path
        d="M4 7.5 9 12.5l3-3 4 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m14.5 13.5 2 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  'not-spent': (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 5v5l3 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
};

const searchIcon = (
  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
    <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="m13.5 13.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const resetIcon = (
  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
    <path
      d="M5.5 6A5.5 5.5 0 1 1 4 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M6 2.5 5 6l3.5-.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export function NavigatorFilters({ categories, table, onOpenDialog }: NavigatorFiltersProps) {
  const {
    navigatorFilter,
    setNavigatorFilter,
    navigatorFilterOptions,
    categorySearchTerm,
    setCategorySearchTerm,
    handleResetFilters
  } = categories;
  const columnMenuId = useId();
  const columnLabels: Record<SmartBudgetingController['table']['columnPreferences']['order'][number], string> = {
    category: 'Category',
    item: 'Item',
    planned: 'Planned amount',
    actual: 'Actual amount',
    variance: 'Variance / remaining',
    due: 'Due date',
    status: 'Status',
    priority: 'Priority'
  } as const;

  return (
    <section className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-[220px] flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Navigator filter</span>
        <div className="flex flex-wrap gap-2">
          {navigatorFilterOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setNavigatorFilter(option.key)}
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                navigatorFilter === option.key ? 'bg-accent text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <span className="text-current [&>svg]:h-4 [&>svg]:w-4">{statusIcons[option.key]}</span>
              <span className="whitespace-nowrap">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-w-[260px] flex-1 flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="budgeting-search">
          Search
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{searchIcon}</span>
            <input
              id="budgeting-search"
              type="search"
              placeholder="Search categories or items"
              value={categorySearchTerm}
              onChange={(event) => setCategorySearchTerm(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 py-2 pl-9 pr-3 text-sm text-slate-100 transition focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
          >
            <span className="text-current [&>svg]:h-4 [&>svg]:w-4">{resetIcon}</span>
            <span className="whitespace-nowrap">Reset</span>
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenDialog}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-accent/90"
          >
            + Plan expenses
          </button>
          <details className="relative">
            <summary
              className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
              aria-haspopup="menu"
              aria-controls={columnMenuId}
            >
              Columns
              <span aria-hidden className="text-[10px] text-slate-500">({table.visibleColumns.length})</span>
            </summary>
            <div
              id={columnMenuId}
              className="absolute right-0 z-10 mt-2 w-64 space-y-3 rounded-lg border border-slate-800 bg-slate-950/90 p-3 text-xs text-slate-200 shadow-xl shadow-slate-950/40"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visible columns</p>
              <div className="space-y-2">
                {table.columnPreferences.order.map((column) => (
                  <label key={column} className="flex items-center justify-between gap-3 text-xs text-slate-200">
                    <span>{columnLabels[column]}</span>
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-accent focus:ring-accent"
                      checked={table.columnPreferences.visible[column]}
                      onChange={() => table.toggleColumnVisibility(column)}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={table.resetColumnPreferences}
                className="w-full rounded-md border border-slate-700 px-3 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-accent hover:text-accent"
              >
                Reset to default
              </button>
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
