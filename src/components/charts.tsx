'use client';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { shortDate, number } from '@/lib/metrics';
export function MuscleChart({
  rows,
}: {
  rows: { name: string; direct: number; secondary: number }[];
}) {
  return (
    <div
      role="img"
      aria-label="Graphique des séries directes et indirectes de la séance"
      style={{
        height: Math.max(240, rows.length * 62 + 55),
        width: '100%',
        minWidth: 0,
        marginTop: 20,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} strokeDasharray="3 5" />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={100}
            tick={{ fill: 'var(--muted)', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--fg)',
            }}
            cursor={{ fill: 'var(--panel2)' }}
          />
          <Legend />
          <Bar dataKey="direct" name="Directes" fill="#f18b54" isAnimationActive={false} />
          <Bar dataKey="secondary" name="Indirectes" fill="#94bca4" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ProgressChart({
  rows,
  unit = 'kg',
}: {
  rows: { date: string; value: number | null }[];
  unit?: string;
}) {
  return (
    <div
      className="chart-box"
      role="img"
      aria-label={`Graphique de progression, ${rows.length} points en ${unit}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 15, left: 0, bottom: 5 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 5" />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            minTickGap={30}
          />
          <YAxis
            tick={{ fill: 'var(--muted)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={['auto', 'auto']}
          />
          <Tooltip
            labelFormatter={(v) => shortDate(String(v))}
            formatter={(v) => [`${number(Number(v), 2)} ${unit}`, 'Performance']}
            contentStyle={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              fontSize: 12,
              color: 'var(--fg)',
            }}
          />
          <Line
            name="Performance"
            type="monotone"
            dataKey="value"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: 'var(--panel)', strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
