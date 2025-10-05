interface SavingsGaugeDialProps {
  savingsRate: number;
}

export function SavingsGaugeDial({ savingsRate }: SavingsGaugeDialProps) {
  const clampedRate = Math.max(0, Math.min(150, savingsRate));
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (Math.min(100, Math.max(0, clampedRate)) / 100) * circumference;

  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 36 36" className="h-full w-full">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="#1e293b" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="3"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
        />
        <text x="18" y="20.35" className="fill-slate-100 text-base font-semibold" textAnchor="middle">
          {savingsRate.toFixed(1)}%
        </text>
      </svg>
    </div>
  );
}
