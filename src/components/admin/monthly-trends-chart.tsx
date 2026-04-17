"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatPercent } from "@/lib/utils"

export interface MonthlyTrend {
  month: string
  revenue: number
  deals: number
  closeRate: number
  showRate: number
}

interface MonthlyTrendsChartProps {
  data: MonthlyTrend[]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (active && payload && payload.length > 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <p className="mb-2 font-display font-semibold text-white">{label}</p>
        {payload.map((entry) => (
          <p key={entry.name} className="text-sm" style={{ color: entry.color }}>
            {entry.name}:{" "}
            <span className="font-medium metric-number text-white">
              {entry.name === "Revenue"
                ? formatCurrency(entry.value)
                : entry.name === "Deals"
                ? entry.value
                : formatPercent(entry.value)}
            </span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function MonthlyTrendsChart({ data }: MonthlyTrendsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Trends (6 Months)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <filter id="glow-line">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "rgba(255,255,255,0.55)" }} stroke="rgba(255,255,255,0.1)" />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: "rgba(255,255,255,0.55)" }}
              stroke="rgba(255,255,255,0.1)"
              tickFormatter={(v: number) =>
                v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
              }
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: "rgba(255,255,255,0.55)" }}
              stroke="rgba(255,255,255,0.1)"
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
              domain={[0, 1]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(255,255,255,0.15)" }} />
            <Legend wrapperStyle={{ color: "rgba(255,255,255,0.7)" }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="#10B981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#10B981" }}
              activeDot={{ r: 6 }}
              style={{ filter: "url(#glow-line)" }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="deals"
              name="Deals"
              stroke="#3B82F6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#3B82F6" }}
              activeDot={{ r: 6 }}
              style={{ filter: "url(#glow-line)" }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="closeRate"
              name="Close Rate"
              stroke="#A78BFA"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#A78BFA" }}
              activeDot={{ r: 6 }}
              style={{ filter: "url(#glow-line)" }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="showRate"
              name="Show Rate"
              stroke="#F59E0B"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#F59E0B" }}
              activeDot={{ r: 6 }}
              style={{ filter: "url(#glow-line)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
