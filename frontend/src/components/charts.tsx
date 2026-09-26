'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/** Palet kategorikal tervalidasi (urutan tetap, tidak di-cycle). */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const AXIS = { fontSize: 12, fill: '#64748b' };
const GRID = '#eef2f6';

const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.06)' };

export function TrendChart({ data, dataKey, xKey = 'label', height = 240, format, domain, name }: { data: Record<string, unknown>[]; dataKey: string; xKey?: string; height?: number; format?: (v: number) => string; domain?: [number, number]; name?: string }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.25} />
            <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS} axisLine={false} tickLine={false} width={44} domain={domain} tickFormatter={format} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [format ? format(v) : v, name || dataKey]} cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} />
        <Area type="monotone" dataKey={dataKey} stroke={SERIES[0]} strokeWidth={2} fill={`url(#g-${dataKey})`} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarsChart({ data, bars, xKey = 'label', height = 260, format, stacked, layout = 'horizontal' }: { data: Record<string, unknown>[]; bars: { key: string; name: string; color?: string }[]; xKey?: string; height?: number; format?: (v: number) => string; stacked?: boolean; layout?: 'horizontal' | 'vertical' }) {
  const vertical = layout === 'vertical';
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
        <CartesianGrid stroke={GRID} vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={AXIS} axisLine={false} tickLine={false} tickFormatter={format} />
            <YAxis type="category" dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} axisLine={false} tickLine={false} width={56} tickFormatter={format} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(148,163,184,.12)' }} formatter={(v: any, n: any) => [format ? format(v) : v, n]} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={b.color || SERIES[i]} stackId={stacked ? 's' : undefined} radius={stacked && i < bars.length - 1 ? 0 : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} stroke="#fff" strokeWidth={stacked ? 1 : 0} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, height = 220, format }: { data: { name: string; value: number; color?: string }[]; height?: number; format?: (v: number) => string }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={1} stroke="#fff" strokeWidth={2}>
              {data.map((d, i) => <Cell key={d.name} fill={d.color || SERIES[i]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [format ? format(v) : v, n]} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-2 text-sm sm:w-1/2">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color || SERIES[i] }} />
              {d.name}
            </span>
            <span className="font-semibold text-slate-800">
              {format ? format(d.value) : d.value}
              <span className="ml-1 text-xs font-normal text-slate-500">({total ? Math.round((d.value / total) * 100) : 0}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Warna status (disertai label teks, tidak hanya warna). */
export const STATUS_COLORS = { good: '#1baf7a', warning: '#eda100', serious: '#eb6834', critical: '#e34948', info: '#2a78d6', neutral: '#94a3b8' };
