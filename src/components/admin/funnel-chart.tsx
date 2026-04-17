"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface FunnelStage {
  name: string
  count: number
  conversionRate: number
}

interface FunnelChartProps {
  data: FunnelStage[]
}

const FUNNEL_COLORS = [
  "#A5B4FC",
  "#818CF8",
  "#6366F1",
  "#4F46E5",
  "#7C3AED",
  "#8B5CF6",
  "#A78BFA",
  "#C4B5FD",
]

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: FunnelStage }>
}) {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/90 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
        <p className="font-display font-semibold text-white">{data.name}</p>
        <p className="text-sm text-white/60">
          Count: <span className="font-medium text-white metric-number">{data.count.toLocaleString()}</span>
        </p>
        {data.conversionRate >= 0 && (
          <p className="text-sm text-white/60">
            Conversion to next:{" "}
            <span className="font-medium text-white metric-number">
              {data.conversionRate.toFixed(1)}%
            </span>
          </p>
        )}
      </div>
    )
  }
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ConversionLabel(props: any) {
  const x = typeof props.x === "number" ? props.x : 0
  const y = typeof props.y === "number" ? props.y : 0
  const width = typeof props.width === "number" ? props.width : 0
  const value = typeof props.value === "number" ? props.value : undefined
  if (value === undefined || value < 0) return null
  return (
    <text
      x={x + width + 8}
      y={y + 16}
      fill="rgba(255,255,255,0.55)"
      fontSize={11}
    >
      {value.toFixed(1)}% &rarr;
    </text>
  )
}

export function FunnelChart({ data }: FunnelChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Funnel</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 100, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12, fill: "rgba(255,255,255,0.55)" }} stroke="rgba(255,255,255,0.1)" />
            <YAxis
              dataKey="name"
              type="category"
              width={140}
              tick={{ fontSize: 12, fill: "rgba(255,255,255,0.7)" }}
              stroke="rgba(255,255,255,0.1)"
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
            <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={36}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]}
                />
              ))}
              <LabelList
                dataKey="count"
                position="insideRight"
                fill="#fff"
                fontSize={12}
                fontWeight={600}
                formatter={(v) => typeof v === "number" ? v.toLocaleString() : String(v ?? "")}
              />
              <LabelList
                dataKey="conversionRate"
                content={ConversionLabel}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
