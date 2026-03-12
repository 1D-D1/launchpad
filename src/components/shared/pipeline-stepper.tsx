import { clsx } from 'clsx';
import type { PipelineStatus } from '@/types/pipeline';

export interface PipelineStep {
  label: string;
  status: PipelineStatus;
  description?: string;
}

interface PipelineStepperProps {
  steps: PipelineStep[];
}

const statusColors: Record<PipelineStatus, { circle: string; line: string; text: string }> = {
  PENDING: {
    circle: 'border-zinc-600 bg-zinc-800 text-zinc-500',
    line: 'bg-zinc-700',
    text: 'text-zinc-500',
  },
  RUNNING: {
    circle: 'border-blue-500 bg-blue-500/20 text-blue-400 ring-4 ring-blue-500/20',
    line: 'bg-blue-500/40',
    text: 'text-blue-400',
  },
  COMPLETED: {
    circle: 'border-emerald-500 bg-emerald-500/20 text-emerald-400',
    line: 'bg-emerald-500',
    text: 'text-emerald-400',
  },
  FAILED: {
    circle: 'border-red-500 bg-red-500/20 text-red-400',
    line: 'bg-red-500/40',
    text: 'text-red-400',
  },
  SKIPPED: {
    circle: 'border-zinc-600 bg-zinc-800 text-zinc-600',
    line: 'bg-zinc-700',
    text: 'text-zinc-600',
  },
};

function StatusIcon({ status }: { status: PipelineStatus }) {
  if (status === 'COMPLETED') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === 'FAILED') {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  if (status === 'RUNNING') {
    return (
      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    );
  }
  return <span className="h-2 w-2 rounded-full bg-current" />;
}

export default function PipelineStepper({ steps }: PipelineStepperProps) {
  return (
    <div className="w-full overflow-x-auto">
      <div className="flex items-start gap-0 min-w-max px-4 py-6">
        {steps.map((step, index) => {
          const colors = statusColors[step.status];
          const isLast = index === steps.length - 1;

          return (
            <div key={step.label} className="flex items-start">
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                    colors.circle
                  )}
                >
                  <StatusIcon status={step.status} />
                </div>
                <p
                  className={clsx(
                    'mt-2 max-w-[100px] text-center text-xs font-medium leading-tight',
                    colors.text
                  )}
                >
                  {step.label}
                </p>
              </div>
              {!isLast && (
                <div
                  className={clsx(
                    'mt-3.5 h-0.5 w-16 flex-shrink-0',
                    colors.line
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
