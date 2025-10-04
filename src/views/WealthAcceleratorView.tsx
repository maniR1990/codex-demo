import { useFinancialStore } from '../store/FinancialStoreProvider';

export function WealthAcceleratorView() {
  const { wealthMetrics } = useFinancialStore();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Wealth Accelerator (Premium)</h2>
        <p className="text-sm text-slate-400">
          Discover optimisation levers: capital efficiency, opportunity costs, and insurance coverage gaps.
        </p>
      </header>

      <section className="rounded-2xl border border-accent/40 bg-slate-900/60 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Capital efficiency score</p>
            <p className="text-4xl font-semibold text-accent">{wealthMetrics.capitalEfficiencyScore}</p>
            <p className="text-xs text-slate-500">Higher score indicates optimal deployment of capital between growth and safety.</p>
          </div>
          <div className="flex h-32 w-32 items-center justify-center rounded-full border-8 border-accent/60 bg-slate-950 text-xl font-bold text-accent">
            {wealthMetrics.capitalEfficiencyScore}
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-100">Opportunity Cost Alerts</h3>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {wealthMetrics.opportunityCostAlerts.map((alert, index) => (
              <li key={index} className="rounded-lg border border-accent/30 bg-slate-950/80 px-3 py-2">
                {alert}
              </li>
            ))}
            {wealthMetrics.opportunityCostAlerts.length === 0 && (
              <p className="text-sm text-slate-500">No opportunity costs detected at the moment.</p>
            )}
          </ul>
        </article>
        <article className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-100">Insurance Gap Analysis</h3>
          <p className="mt-3 text-sm text-slate-300 whitespace-pre-line">{wealthMetrics.insuranceGapAnalysis}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6">
        <h3 className="text-lg font-semibold">Premium roadmap</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Set automation rules to rebalance between debt repayment and investments.</li>
          <li>Leverage insurer integrations (LIC, HDFC Life, ICICI Lombard) for coverage validation.</li>
          <li>Unlock benchmarking dashboards against similar Indian households.</li>
        </ul>
      </section>
    </div>
  );
}
