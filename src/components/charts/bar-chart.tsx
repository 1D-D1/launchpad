'use client';

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface BarSeries {
  dataKey: string;
  name: string;
  color: string;
}

interface BarChartProps {
  data: Record<string, string | number>[];
  series: BarSeries[];
  height?: number;
  xAxisKey?: string;
  stacked?: boolean;
}

export default function BarChartComponent({
  data,
  series,
  height = 300,
  xAxisKey = 'name',
  stacked = false,
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey={xAxisKey} tick={{ fill: '#999', fontSize: 12 }} axisLine={{ stroke: '#444' }} />
        <YAxis tick={{ fill: '#999', fontSize: 12 }} axisLine={{ stroke: '#444' }} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#e4e4e7',
          }}
        />
        <Legend wrapperStyle={{ color: '#999' }} />
        {series.map((s) => (
          <Bar
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.name}
            fill={s.color}
            radius={[4, 4, 0, 0]}
            stackId={stacked ? 'stack' : undefined}
          />
        ))}
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
