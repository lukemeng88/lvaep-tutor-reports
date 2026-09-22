"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MONTH_SHORT_NAMES } from "@/lib/fiscal-year";
import { formatHours } from "@/lib/hours";

type Point = { label: string; hours: number; running: number };

export function HoursChart({
  months,
  perMonth,
  running,
}: {
  months: { month: number; year: number }[];
  perMonth: number[];
  running: number[];
}) {
  const data: Point[] = months.map((m, i) => ({
    label: MONTH_SHORT_NAMES[m.month - 1],
    hours: perMonth[i],
    running: running[i],
  }));

  return (
    <figure aria-label="Hours tutored per month" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--color-gray-200)" strokeDasharray="0" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--color-gray-500)" }} />
          <YAxis
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tick={{ fontSize: 12, fill: "var(--color-gray-500)" }}
            width={48}
          />
          <Tooltip
            cursor={{ fill: "var(--color-gray-100)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as Point;
              return (
                <div className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-medium text-gray-900">{p.label}</p>
                  <p className="text-gray-700">{formatHours(p.hours)} hours</p>
                  <p className="text-gray-500">Running total: {formatHours(p.running)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
