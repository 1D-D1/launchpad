import { clsx } from 'clsx';

type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'running';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/30',
  warning: 'bg-amber-500/15 text-amber-400 ring-amber-500/30',
  error: 'bg-red-500/15 text-red-400 ring-red-500/30',
  info: 'bg-blue-500/15 text-blue-400 ring-blue-500/30',
  neutral: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',
  running: 'bg-indigo-500/15 text-indigo-400 ring-indigo-500/30',
};

export default function StatusBadge({
  label,
  variant = 'neutral',
  size = 'sm',
}: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium ring-1 ring-inset',
        variantStyles[variant],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      )}
    >
      {label}
    </span>
  );
}

/** Map a project status string to a badge variant */
export function statusToVariant(status: string): BadgeVariant {
  switch (status) {
    case 'ACTIVE':
    case 'COMPLETED':
      return 'success';
    case 'DRAFT':
      return 'neutral';
    case 'PAUSED':
      return 'warning';
    case 'ANALYZING':
    case 'STRATEGIZING':
    case 'GENERATING_CONTENT':
    case 'PUBLISHING':
    case 'RUNNING_ADS':
    case 'EMAILING':
      return 'running';
    case 'SUBMITTED':
      return 'info';
    default:
      return 'neutral';
  }
}
