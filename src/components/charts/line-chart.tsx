'use client';

import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface LineSeries {
  dataKey: string;
  name: string;
  color: string;
  dashed?: boolean;
}

interface LineChartProps {
  data: Record<string, string | number>[];
  series: LineSeries[];
  height?: number;
  xAxisKey?: string;
}

export default function LineChartComponent({
  data,
  series,
  height = 300,
  xAxisKey = 'name',
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          <Line
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 5' : undefined}
            dot={{ fill: s.color, r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}
