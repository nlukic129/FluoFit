"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS = { fontSize: 11, fill: "#64748b" } as const;
const GRID = "#E2E8F0";
const TOOLTIP = {
  borderRadius: 8,
  border: "1px solid #E2E8F0",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(15,23,42,0.08)",
  padding: "6px 10px",
} as const;

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function AreaTrend({
  data,
  gradientId,
  color = "#1E40AF",
  height = 220,
  prefix = "",
  suffix = "",
}: {
  data: { d: string; v: number }[];
  gradientId: string;
  color?: string;
  height?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ left: -6, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="d" tick={AXIS} tickLine={false} axisLine={false} minTickGap={28} tickFormatter={shortDate} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={38} />
        <Tooltip
          contentStyle={TOOLTIP}
          labelFormatter={(l) => shortDate(String(l))}
          formatter={(v) => [`${prefix}${v}${suffix}`, ""]}
        />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CityBars({ data, height = 220 }: { data: { city: string; n: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: -6, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="city" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP} cursor={{ fill: "#eef2f7" }} />
        <Bar dataKey="n" fill="#1E40AF" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ data, height = 220 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="55%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="90%" paddingAngle={2} stroke="none">
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full" style={{ background: d.color }} />
              <span className="capitalize text-muted-foreground">{d.name}</span>
            </span>
            <span className="tabular font-medium">
              {d.value}
              {total > 0 && <span className="ml-1 text-xs text-muted-foreground">{Math.round((d.value / total) * 100)}%</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
