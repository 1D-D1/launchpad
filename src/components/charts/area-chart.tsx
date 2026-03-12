'use client';

import {
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface AreaChartProps {
  data: { name: string; value: number; value2?: number }[];
  color?: string;
  color2?: string;
  label?: string;
  label2?: string;
  height?: number;
}

export default function AreaChartComponent({
  data,
  color = '#3b82f6',
  color2 = '#10b981',
  label = 'Value',
  label2,
  height = 300,
}: AreaChartProps) {
  const hasSecondSeries = data.some((d) => d.value2 !== undefined);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsAreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          {hasSecondSeries && (
            <linearGradient id={`gradient-${color2.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color2} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color2} stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="name" tick={{ fill: '#999', fontSize: 12 }} axisLine={{ stroke: '#444' }} />
        <YAxis tick={{ fill: '#999', fontSize: 12 }} axisLine={{ stroke: '#444' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#e4e4e7',
          }}
        />
        {hasSecondSeries && <Legend wrapperStyle={{ color: '#999' }} />}
        <Area
          type="monotone"
          dataKey="value"
          name={label}
          stroke={color}
          fill={`url(#gradient-${color.replace('#', '')})`}
          strokeWidth={2}
        />
        {hasSecondSeries && (
          <Area
            type="monotone"
            dataKey="value2"
            name={label2 || 'Value 2'}
            stroke={color2}
            fill={`url(#gradient-${color2.replace('#', '')})`}
            strokeWidth={2}
          />
        )}
      </RechartsAreaChart>
    </ResponsiveContainer>
  );
}
