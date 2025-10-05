type ProgressBarProps = {
  value: number;
  colorClass?: string;
};

export function ProgressBar({ value, colorClass = 'bg-accent' }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${clampedValue}%` }} />
    </div>
  );
}
