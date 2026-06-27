import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: 'green' | 'red' | 'gold' | 'blue' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'hero';
  badge?: string;
}

const accentMap = {
  green: 'text-emerald-400',
  red: 'text-red-400',
  gold: 'text-amber-400',
  blue: 'text-blue-400',
  default: 'text-slate-100',
};

const sizeMap = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
  hero: 'text-6xl lg:text-7xl',
};

export default function MetricCard({
  title,
  value,
  subtitle,
  accent = 'default',
  size = 'md',
  badge,
}: MetricCardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{title}</p>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
            {badge}
          </span>
        )}
      </div>
      <p className={`font-black tabular-nums leading-none ${sizeMap[size]} ${accentMap[accent]}`}>
        {value}
      </p>
      {subtitle && <p className="text-slate-500 text-xs">{subtitle}</p>}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-slate-200 text-lg font-bold mb-4">{children}</h2>
  );
}

// ─── Page title ───────────────────────────────────────────────────────────────

export function PageTitle({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl lg:text-3xl font-black text-slate-100">{children}</h1>
      {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
    </div>
  );
}
