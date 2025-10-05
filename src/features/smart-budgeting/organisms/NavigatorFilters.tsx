import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface NavigatorFiltersProps {
  categories: SmartBudgetingController['categories'];
}

export function NavigatorFilters({ categories }: NavigatorFiltersProps) {
  const {
    navigatorFilter,
    setNavigatorFilter,
    navigatorFilterOptions,
    navigatorView,
    setNavigatorView,
    navigatorViewOptions,
    categorySearchTerm,
    setCategorySearchTerm,
    handleResetFilters
  } = categories;

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Navigator filter</span>
        <div className="flex flex-wrap gap-2">
          {navigatorFilterOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setNavigatorFilter(option.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                navigatorFilter === option.key ? 'bg-accent text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Navigator view</span>
        <div className="flex flex-wrap gap-2">
          {navigatorViewOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setNavigatorView(option.key)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                navigatorView === option.key ? 'bg-accent text-slate-900' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="budgeting-search">
          Search
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="budgeting-search"
            type="search"
            placeholder="Search categories or items"
            value={categorySearchTerm}
            onChange={(event) => setCategorySearchTerm(event.target.value)}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
          />
          <button
            type="button"
            onClick={handleResetFilters}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
          >
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}
