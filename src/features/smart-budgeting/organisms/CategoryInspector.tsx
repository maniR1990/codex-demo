import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';

interface CategoryInspectorProps {
  inspector: SmartBudgetingController['inspector'];
  utils: SmartBudgetingController['utils'];
}

export function CategoryInspector({ inspector, utils }: CategoryInspectorProps) {
  const {
    focusedCategory,
    inspectorOverspendingItems,
    inspectorUpcomingItems,
    inspectorInProgressItems,
    inspectorCompletedItems,
    handleFocusDetail
  } = inspector;

  return (
    <aside className="flex h-full flex-col rounded-2xl border border-slate-800/60 bg-slate-950/60 p-4 text-xs text-slate-300">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category insights</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-100">
          {focusedCategory ? focusedCategory.name : 'Select a category'}
        </h2>
      </header>

      {focusedCategory ? (
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Overspending risks</h5>
            {inspectorOverspendingItems.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {inspectorOverspendingItems.map((detail) => (
                  <li key={detail.item.id} className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-xs text-danger">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-danger/90">{detail.item.name}</span>
                      <span>{utils.formatCurrency(detail.variance)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFocusDetail(detail)}
                      className="mt-1 text-[10px] font-semibold text-danger hover:underline"
                    >
                      Investigate
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No overspending yet. Keep tracking!</p>
            )}
          </section>

          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Upcoming items</h5>
            {inspectorUpcomingItems.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {inspectorUpcomingItems.map((detail) => (
                  <li key={detail.item.id} className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">{detail.item.name}</span>
                      <span>
                        {detail.item.dueDate
                          ? new Date(detail.item.dueDate).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric'
                            })
                          : 'No due date'}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span>{utils.formatCurrency(detail.item.plannedAmount)}</span>
                      <button
                        type="button"
                        onClick={() => handleFocusDetail(detail)}
                        className="font-semibold text-accent hover:underline"
                      >
                        Edit plan
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No upcoming items in this category.</p>
            )}
          </section>

          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">In-progress items</h5>
            {inspectorInProgressItems.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {inspectorInProgressItems.map((detail) => (
                  <li key={detail.item.id} className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">{detail.item.name}</span>
                      {utils.statusBadge(detail.item.status)}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        Due{' '}
                        {detail.item.dueDate
                          ? new Date(detail.item.dueDate).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric'
                            })
                          : '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleFocusDetail(detail)}
                        className="font-semibold text-accent hover:underline"
                      >
                        Update
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No items currently in progress.</p>
            )}
          </section>

          <section>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Completed items</h5>
            {inspectorCompletedItems.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {inspectorCompletedItems.map((detail) => (
                  <li key={detail.item.id} className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-100">{detail.item.name}</span>
                      <span className="font-semibold text-success">{utils.formatCurrency(detail.actual)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>Planned {utils.formatCurrency(detail.item.plannedAmount)}</span>
                      <button
                        type="button"
                        onClick={() => handleFocusDetail(detail)}
                        className="font-semibold text-accent hover:underline"
                      >
                        Review
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No completed items recorded yet.</p>
            )}
          </section>
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          Choose a category on the left to review overspending, upcoming work, and progress.
        </p>
      )}
    </aside>
  );
}
