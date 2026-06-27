'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface DataPoint {
  label: string;
  value: number;
  value2?: number;
}

interface BetmanChartProps {
  data: DataPoint[];
  type?: 'area' | 'bar' | 'line';
  color?: string;
  color2?: string;
  valueLabel?: string;
  value2Label?: string;
  formatValue?: (v: number) => string;
  height?: number;
}

const DEFAULT_COLOR = '#10b981';
const DEFAULT_COLOR2 = '#3b82f6';

function formatDefault(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(Math.round(v));
}

export default function BetmanChart({
  data,
  type = 'area',
  color = DEFAULT_COLOR,
  color2 = DEFAULT_COLOR2,
  valueLabel = 'Value',
  value2Label,
  formatValue = formatDefault,
  height = 220,
}: BetmanChartProps) {
  const tooltipStyle = {
    backgroundColor: '#111827',
    border: '1px solid #1f2d3d',
    borderRadius: '8px',
    color: '#e2e8f0',
    fontSize: '12px',
  };

  const axisProps = {
    tick: { fill: '#64748b', fontSize: 11 },
    axisLine: { stroke: '#1f2d3d' },
    tickLine: false as const,
  };

  // Cast to any to work around recharts' overly-strict Formatter generic
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formatter: any = (value: any, name: string) => [
    formatValue(Number(value ?? 0)),
    name,
  ];

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2d3d" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis tickFormatter={formatValue} {...axisProps} width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={formatter}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="value" name={valueLabel} fill={color} radius={[3, 3, 0, 0]} />
          {value2Label && (
            <Bar dataKey="value2" name={value2Label} fill={color2} radius={[3, 3, 0, 0]} />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2d3d" />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis tickFormatter={formatValue} {...axisProps} width={48} />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={formatter}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={valueLabel}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
          {value2Label && (
            <Line
              type="monotone"
              dataKey="value2"
              name={value2Label}
              stroke={color2}
              strokeWidth={2}
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Default: area
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          {value2Label && (
            <linearGradient id={`grad2-${color2.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color2} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color2} stopOpacity={0} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2d3d" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis tickFormatter={formatValue} {...axisProps} width={48} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={formatter}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name={valueLabel}
          stroke={color}
          strokeWidth={2}
          fill={`url(#grad-${color.replace('#', '')})`}
        />
        {value2Label && (
          <Area
            type="monotone"
            dataKey="value2"
            name={value2Label}
            stroke={color2}
            strokeWidth={2}
            fill={`url(#grad2-${color2.replace('#', '')})`}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
