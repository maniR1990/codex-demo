import { useFinancialStore } from '../store/FinancialStoreProvider';

export function InsightsView() {
  const { insights } = useFinancialStore();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Actionable Insights</h2>
        <p className="text-sm text-slate-400">AI-powered nudges derived from your financial trends and custom categories.</p>
      </header>

      <section className="space-y-3">
        {insights.map((insight) => (
          <article
            key={insight.id}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm shadow sm:p-5"
          >
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-semibold text-slate-100">{insight.title}</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(insight.severity)}`}>
                {insight.severity.toUpperCase()}
              </span>
            </header>
            <p className="mt-3 text-slate-300">{insight.description}</p>
          </article>
        ))}
        {insights.length === 0 && (
          <p className="text-sm text-slate-500">Insights will appear after analysing your transactions.</p>
        )}
      </section>
    </div>
  );
}

function badgeClasses(severity: 'info' | 'warning' | 'critical') {
  switch (severity) {
    case 'warning':
      return 'bg-warning/20 text-warning';
    case 'critical':
      return 'bg-danger/20 text-danger';
    default:
      return 'bg-accent/20 text-accent';
  }
}
