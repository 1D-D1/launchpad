'use client';

interface FunnelStage {
  name: string;
  count: number;
  color?: string;
}

interface FunnelChartProps {
  data: FunnelStage[];
  height?: number;
}

const DEFAULT_FUNNEL_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c084fc'];

export default function FunnelChartComponent({ data, height = 300 }: FunnelChartProps) {
  if (data.length === 0) return null;

  const maxCount = data[0].count;

  return (
    <div style={{ height }} className="flex flex-col items-center justify-center gap-1.5 w-full px-4">
      {data.map((stage, index) => {
        const widthPercent = maxCount > 0 ? Math.max((stage.count / maxCount) * 100, 15) : 15;
        const percent = maxCount > 0 ? ((stage.count / maxCount) * 100).toFixed(1) : '0.0';
        const color = stage.color || DEFAULT_FUNNEL_COLORS[index % DEFAULT_FUNNEL_COLORS.length];

        return (
          <div
            key={stage.name}
            className="relative flex items-center justify-center rounded-lg py-3 px-4 transition-all duration-300"
            style={{
              width: `${widthPercent}%`,
              backgroundColor: `${color}20`,
              borderLeft: `3px solid ${color}`,
            }}
          >
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-white">{stage.count.toLocaleString()}</span>
              <span className="text-zinc-400">{stage.name}</span>
              <span className="text-xs text-zinc-500">({percent}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
