import { ReactNode } from 'react';

interface SummaryStatProps {
  label: string;
  value: ReactNode;
  description?: string;
}

export function SummaryStat({ label, value, description }: SummaryStatProps) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-[11px] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-100">{value}</dd>
      {description && <p className="mt-1 text-[10px] text-slate-500">{description}</p>}
    </div>
  );
}
