import type { BudgetMonth } from '../../../types';
import type { SmartBudgetingController } from '../hooks/useSmartBudgetingController';
import { LedgerList } from '../molecules/LedgerList';

interface LedgerSnapshotProps {
  budgetMonth: BudgetMonth;
  utils: SmartBudgetingController['utils'];
  periodLabel: string;
}

export function LedgerSnapshot({ budgetMonth, utils, periodLabel }: LedgerSnapshotProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{`Ledger snapshot · ${periodLabel}`}</h3>
          <p className="text-xs text-slate-500">
            A quick glance at planned allocations, recorded actuals, and manual adjustments for the selected month.
          </p>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <LedgerList
          title="Planned items"
          emptyMessage="No planned allocations recorded."
          items={budgetMonth.plannedItems}
          getKey={(item) => item.id}
          renderItem={(item) => (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <span>{item.name}</span>
              <span className="font-semibold text-warning">{utils.formatCurrency(item.plannedAmount)}</span>
            </div>
          )}
        />
        <LedgerList
          title="Recorded actuals"
          emptyMessage="No matched actuals logged yet."
          items={budgetMonth.actuals}
          getKey={(item) => item.id}
          renderItem={(item) => (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <span>{item.description ?? 'Unnamed actual'}</span>
              <span className="font-semibold text-success">{utils.formatCurrency(item.amount)}</span>
            </div>
          )}
        />
        <LedgerList
          title="Unassigned spend"
          emptyMessage="All spend has been categorised."
          items={budgetMonth.unassignedActuals}
          getKey={(item) => item.id}
          renderItem={(item) => (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <span>{item.description ?? 'Unassigned transaction'}</span>
              <span className="font-semibold text-warning">{utils.formatCurrency(item.amount)}</span>
            </div>
          )}
        />
        <LedgerList
          title="Adjustments & rollovers"
          emptyMessage="No manual adjustments captured."
          items={budgetMonth.adjustments}
          getKey={(item) => item.id}
          renderItem={(adjustment) => (
            <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span>{adjustment.reason ?? 'Adjustment'}</span>
                <span className="font-semibold text-accent">{utils.formatCurrency(adjustment.amount)}</span>
              </div>
              {(adjustment.rolloverSourceMonth || adjustment.rolloverTargetMonth) && (
                <p className="text-[11px] text-slate-500">
                  {adjustment.rolloverSourceMonth ? `From ${adjustment.rolloverSourceMonth}` : ''}
                  {adjustment.rolloverSourceMonth && adjustment.rolloverTargetMonth ? ' → ' : ''}
                  {adjustment.rolloverTargetMonth ? `To ${adjustment.rolloverTargetMonth}` : ''}
                </p>
              )}
            </div>
          )}
        />
      </div>
    </section>
  );
}
