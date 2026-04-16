"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn, formatCurrency, formatPercent } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts"

interface Props {
  reps: { id: string; full_name: string; role: string }[]
}

interface RepMetrics {
  dials_made: number; conversations: number; qualified_bookings: number;
  intros_completed: number; demos_booked_from_intros: number;
  demos_scheduled: number; demos_completed: number; offers_made: number;
  deals_closed: number; cash_collected: number;
}

const EMPTY_METRICS: RepMetrics = {
  dials_made: 0, conversations: 0, qualified_bookings: 0,
  intros_completed: 0, demos_booked_from_intros: 0,
  demos_scheduled: 0, demos_completed: 0, offers_made: 0,
  deals_closed: 0, cash_collected: 0,
}

export function RepComparison({ reps }: Props) {
  const [rep1Id, setRep1Id] = useState("")
  const [rep2Id, setRep2Id] = useState("")
  const [period, setPeriod] = useState("30")
  const [loading, setLoading] = useState(false)
  const [rep1Data, setRep1Data] = useState<RepMetrics>(EMPTY_METRICS)
  const [rep2Data, setRep2Data] = useState<RepMetrics>(EMPTY_METRICS)
  const [rep1Weekly, setRep1Weekly] = useState<{ week: string; value: number }[]>([])
  const [rep2Weekly, setRep2Weekly] = useState<{ week: string; value: number }[]>([])

  const rep1 = reps.find((r) => r.id === rep1Id)
  const rep2 = reps.find((r) => r.id === rep2Id)
  const filteredReps = rep1 ? reps.filter((r) => r.role === rep1.role) : reps

  useEffect(() => {
    if (!rep1Id || !rep2Id) return
    fetchComparison()
  }, [rep1Id, rep2Id, period])

  async function fetchComparison() {
    setLoading(true)
    const supabase = createClient()
    const daysAgo = parseInt(period)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysAgo)
    const start = startDate.toISOString().split("T")[0]

    const [r1, r2] = await Promise.all([
      supabase.from("daily_activity").select("*").eq("user_id", rep1Id).gte("date", start).order("date"),
      supabase.from("daily_activity").select("*").eq("user_id", rep2Id).gte("date", start).order("date"),
    ])

    function aggregate(data: Record<string, unknown>[]): RepMetrics {
      const result = { ...EMPTY_METRICS }
      for (const d of data) {
        result.dials_made += (d.dials_made as number) || 0
        result.conversations += (d.conversations as number) || 0
        result.qualified_bookings += (d.qualified_bookings as number) || 0
        result.intros_completed += (d.intros_completed as number) || 0
        result.demos_booked_from_intros += (d.demos_booked_from_intros as number) || 0
        result.demos_scheduled += (d.demos_scheduled as number) || 0
        result.demos_completed += (d.demos_completed as number) || 0
        result.offers_made += (d.offers_made as number) || 0
        result.deals_closed += (d.deals_closed as number) || 0
        result.cash_collected += (d.cash_collected as number) || 0
      }
      return result
    }

    function weeklyAggregate(data: Record<string, unknown>[], role: string) {
      const weeks: Record<string, number> = {}
      for (const d of data) {
        const date = new Date(d.date as string)
        const day = date.getDay()
        const diff = date.getDate() - day + (day === 0 ? -6 : 1)
        const monday = new Date(date)
        monday.setDate(diff)
        const key = monday.toISOString().split("T")[0]
        const val = role === "setter" ? ((d.qualified_bookings as number) || 0) : ((d.cash_collected as number) || 0)
        weeks[key] = (weeks[key] || 0) + val
      }
      return Object.entries(weeks).sort().map(([week, value]) => ({
        week: new Date(week).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value,
      }))
    }

    const role = rep1?.role || "setter"
    setRep1Data(aggregate((r1.data || []) as Record<string, unknown>[]))
    setRep2Data(aggregate((r2.data || []) as Record<string, unknown>[]))
    setRep1Weekly(weeklyAggregate((r1.data || []) as Record<string, unknown>[], role))
    setRep2Weekly(weeklyAggregate((r2.data || []) as Record<string, unknown>[], role))
    setLoading(false)
  }

  const isSetter = rep1?.role === "setter"

  const metrics = isSetter ? [
    { label: "Dials", key: "dials_made", format: "number" },
    { label: "Conversations", key: "conversations", format: "number" },
    { label: "Bookings", key: "qualified_bookings", format: "number" },
    { label: "Contact Rate", key: "contact_rate", format: "percent" },
    { label: "Book Rate", key: "book_rate", format: "percent" },
    { label: "Intro→Demo Rate", key: "intro_demo_rate", format: "percent" },
  ] : [
    { label: "Demos Completed", key: "demos_completed", format: "number" },
    { label: "Offers Made", key: "offers_made", format: "number" },
    { label: "Deals Closed", key: "deals_closed", format: "number" },
    { label: "Close Rate", key: "close_rate", format: "percent" },
    { label: "Cash Collected", key: "cash_collected", format: "currency" },
    { label: "Avg Deal Size", key: "avg_deal_size", format: "currency" },
  ]

  function getMetricValue(data: RepMetrics, key: string): number {
    switch (key) {
      case "contact_rate": return data.dials_made > 0 ? data.conversations / data.dials_made : 0
      case "book_rate": return data.conversations > 0 ? data.qualified_bookings / data.conversations : 0
      case "intro_demo_rate": return data.intros_completed > 0 ? data.demos_booked_from_intros / data.intros_completed : 0
      case "close_rate": return data.demos_completed > 0 ? data.deals_closed / data.demos_completed : 0
      case "avg_deal_size": return data.deals_closed > 0 ? data.cash_collected / data.deals_closed : 0
      default: return (data as unknown as Record<string, number>)[key] || 0
    }
  }

  function formatValue(value: number, format: string): string {
    if (format === "currency") return formatCurrency(value)
    if (format === "percent") return formatPercent(value)
    return value.toString()
  }

  const radarData = metrics.map((m) => {
    const v1 = getMetricValue(rep1Data, m.key)
    const v2 = getMetricValue(rep2Data, m.key)
    const max = Math.max(v1, v2, 1)
    return { subject: m.label, rep1: (v1 / max) * 100, rep2: (v2 / max) * 100 }
  })

  const trendData = rep1Weekly.map((w, i) => ({
    week: w.week,
    [rep1?.full_name || "Rep 1"]: w.value,
    [rep2?.full_name || "Rep 2"]: rep2Weekly[i]?.value || 0,
  }))

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-56">
              <Select value={rep1Id} onValueChange={(v) => { setRep1Id(v); if (rep2Id) setRep2Id("") }}>
                <SelectTrigger><SelectValue placeholder="Select Rep 1" /></SelectTrigger>
                <SelectContent>
                  {reps.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name} ({r.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="self-center text-muted-foreground font-medium">vs</span>
            <div className="w-56">
              <Select value={rep2Id} onValueChange={setRep2Id}>
                <SelectTrigger><SelectValue placeholder="Select Rep 2" /></SelectTrigger>
                <SelectContent>
                  {filteredReps.filter((r) => r.id !== rep1Id).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-44">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">This Week</SelectItem>
                  <SelectItem value="30">Last 30 Days</SelectItem>
                  <SelectItem value="90">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {rep1Id && rep2Id && !loading && (
        <>
          {/* KPI Table */}
          <Card>
            <CardHeader><CardTitle>KPI Comparison</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-center">{rep1?.full_name}</TableHead>
                    <TableHead className="text-center">{rep2?.full_name}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((m) => {
                    const v1 = getMetricValue(rep1Data, m.key)
                    const v2 = getMetricValue(rep2Data, m.key)
                    const winner = v1 > v2 ? 1 : v2 > v1 ? 2 : 0
                    return (
                      <TableRow key={m.key}>
                        <TableCell className="font-medium">{m.label}</TableCell>
                        <TableCell className={cn("text-center font-medium", winner === 1 && "text-green-600 bg-green-50")}>
                          {formatValue(v1, m.format)}
                        </TableCell>
                        <TableCell className={cn("text-center font-medium", winner === 2 && "text-green-600 bg-green-50")}>
                          {formatValue(v2, m.format)}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Radar Comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" fontSize={11} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} />
                    <Radar name={rep1?.full_name} dataKey="rep1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                    <Radar name={rep2?.full_name} dataKey="rep2" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>{isSetter ? "Bookings" : "Cash Collected"} Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey={rep1?.full_name || "Rep 1"} stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey={rep2?.full_name || "Rep 2"} stroke="#EF4444" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {(!rep1Id || !rep2Id) && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Select two reps to compare their performance
          </CardContent>
        </Card>
      )}
    </div>
  )
}
