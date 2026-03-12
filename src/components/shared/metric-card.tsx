import { clsx } from 'clsx';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
}

export default function MetricCard({ label, value, trend, icon }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-400">{label}</p>
        {icon && <div className="text-zinc-500">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
      {trend && (
        <div className="mt-2 flex items-center gap-1">
          <span
            className={clsx(
              'text-sm font-medium',
              trend.isPositive ? 'text-emerald-400' : 'text-red-400'
            )}
          >
            {trend.isPositive ? '+' : ''}
            {trend.value}%
          </span>
          <span className="text-xs text-zinc-500">vs last month</span>
        </div>
      )}
    </div>
  );
}
