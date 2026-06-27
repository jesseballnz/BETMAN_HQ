interface ProgressBarProps {
  label: string;
  current: number;
  target: number;
  showNumbers?: boolean;
}

export default function MilestoneProgressBar({ label, current, target, showNumbers = true }: ProgressBarProps) {
  const pct = Math.min(100, (current / target) * 100);
  const reached = current >= target;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-semibold ${reached ? 'text-emerald-400' : 'text-slate-300'}`}>
          {reached ? '✓ ' : ''}{label}
        </span>
        {showNumbers && (
          <span className="text-slate-500 tabular-nums">
            {current.toLocaleString()} / {target.toLocaleString()}
          </span>
        )}
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            reached ? 'bg-emerald-400' : 'bg-emerald-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-end">
        <span className={`text-xs tabular-nums ${reached ? 'text-emerald-400' : 'text-slate-500'}`}>
          {pct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
