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
  "#93C5FD", // light blue
  "#60A5FA",
  "#3B82F6",
  "#2563EB",
  "#1D4ED8",
  "#1E40AF",
  "#1E3A8A",
  "#172554", // navy
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
      <div className="rounded-lg border bg-background p-3 shadow-md">
        <p className="font-semibold">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          Count: <span className="font-medium text-foreground">{data.count.toLocaleString()}</span>
        </p>
        {data.conversionRate >= 0 && (
          <p className="text-sm text-muted-foreground">
            Conversion to next:{" "}
            <span className="font-medium text-foreground">
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
      fill="#6B7280"
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
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis
              dataKey="name"
              type="category"
              width={140}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={36}>
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
