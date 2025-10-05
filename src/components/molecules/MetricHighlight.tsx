import type { ReactNode } from 'react';
import { Card } from '../atoms/Card';

interface MetricHighlightProps {
  title: string;
  value: ReactNode;
  subtitle?: ReactNode;
}

export function MetricHighlight({ title, value, subtitle }: MetricHighlightProps) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-100">{value}</p>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </Card>
  );
}
