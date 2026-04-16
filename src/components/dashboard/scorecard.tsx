"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { cn, formatCurrency, formatPercent } from "@/lib/utils"
import type { RepGoal } from "@/types/database"

export interface AggregatedMetrics {
  dials_made: number
  conversations: number
  qualified_bookings: number
  follow_ups_completed: number
  show_confirmations_sent: number
  intros_completed: number
  demos_booked_from_intros: number
  demos_scheduled: number
  demos_completed: number
  offers_made: number
  deals_closed: number
  cash_collected: number
  pif_deals: number
  payment_plan_deals: number
}

export interface Benchmarks {
  setter_weekly_dials: number
  setter_weekly_conversations: number
  setter_weekly_bookings: number
  setter_contact_rate: number
  setter_book_rate: number
  setter_intro_demo_rate: number
  closer_weekly_demos: number
  closer_weekly_cash: number
  closer_close_rate: number
  closer_offer_rate: number
  closer_avg_deal_size: number
  monthly_revenue_target: number
}

interface ScorecardProps {
  role: "setter" | "closer"
  weekData: AggregatedMetrics
  monthData: AggregatedMetrics
  benchmarks: Benchmarks
  goals?: RepGoal[]
}

interface MetricRow {
  label: string
  value: number
  displayValue: string
  benchmark: number
  displayBenchmark: string
  goalValue?: number
  isPercent?: boolean
  isCurrency?: boolean
}

function getColorClass(value: number, benchmark: number): string {
  if (benchmark === 0) return "bg-gray-400"
  const ratio = value / benchmark
  if (ratio >= 1) return "bg-green-500"
  if (ratio >= 0.85) return "bg-yellow-500"
  return "bg-red-500"
}

function getTextColorClass(value: number, benchmark: number): string {
  if (benchmark === 0) return "text-gray-600"
  const ratio = value / benchmark
  if (ratio >= 1) return "text-green-600"
  if (ratio >= 0.85) return "text-yellow-600"
  return "text-red-600"
}

function buildSetterMetrics(
  data: AggregatedMetrics,
  benchmarks: Benchmarks,
  goals?: RepGoal[]
): MetricRow[] {
  const contactRate = data.dials_made > 0 ? data.conversations / data.dials_made : 0
  const bookRate = data.conversations > 0 ? data.qualified_bookings / data.conversations : 0
  const introDemoRate =
    data.intros_completed > 0
      ? data.demos_booked_from_intros / data.intros_completed
      : 0

  const findGoal = (metric: string) =>
    goals?.find((g) => g.goal_metric === metric)?.goal_value

  return [
    {
      label: "Dials",
      value: data.dials_made,
      displayValue: data.dials_made.toString(),
      benchmark: benchmarks.setter_weekly_dials,
      displayBenchmark: benchmarks.setter_weekly_dials.toString(),
      goalValue: findGoal("dials"),
    },
    {
      label: "Conversations",
      value: data.conversations,
      displayValue: data.conversations.toString(),
      benchmark: benchmarks.setter_weekly_conversations,
      displayBenchmark: benchmarks.setter_weekly_conversations.toString(),
      goalValue: findGoal("conversations"),
    },
    {
      label: "Bookings",
      value: data.qualified_bookings,
      displayValue: data.qualified_bookings.toString(),
      benchmark: benchmarks.setter_weekly_bookings,
      displayBenchmark: benchmarks.setter_weekly_bookings.toString(),
      goalValue: findGoal("bookings"),
    },
    {
      label: "Contact Rate %",
      value: contactRate,
      displayValue: formatPercent(contactRate),
      benchmark: benchmarks.setter_contact_rate,
      displayBenchmark: formatPercent(benchmarks.setter_contact_rate),
      isPercent: true,
    },
    {
      label: "Book Rate %",
      value: bookRate,
      displayValue: formatPercent(bookRate),
      benchmark: benchmarks.setter_book_rate,
      displayBenchmark: formatPercent(benchmarks.setter_book_rate),
      isPercent: true,
    },
    {
      label: "Intro > Demo Rate %",
      value: introDemoRate,
      displayValue: formatPercent(introDemoRate),
      benchmark: benchmarks.setter_intro_demo_rate,
      displayBenchmark: formatPercent(benchmarks.setter_intro_demo_rate),
      isPercent: true,
    },
  ]
}

function buildCloserMetrics(
  data: AggregatedMetrics,
  benchmarks: Benchmarks,
  goals?: RepGoal[]
): MetricRow[] {
  const closeRate =
    data.demos_completed > 0 ? data.deals_closed / data.demos_completed : 0
  const avgDealSize =
    data.deals_closed > 0 ? data.cash_collected / data.deals_closed : 0
  const revenuePerCall =
    data.demos_completed > 0 ? data.cash_collected / data.demos_completed : 0

  const findGoal = (metric: string) =>
    goals?.find((g) => g.goal_metric === metric)?.goal_value

  return [
    {
      label: "Demos Completed",
      value: data.demos_completed,
      displayValue: data.demos_completed.toString(),
      benchmark: benchmarks.closer_weekly_demos,
      displayBenchmark: benchmarks.closer_weekly_demos.toString(),
    },
    {
      label: "Offers Made",
      value: data.offers_made,
      displayValue: data.offers_made.toString(),
      benchmark: Math.round(benchmarks.closer_weekly_demos * benchmarks.closer_offer_rate),
      displayBenchmark: Math.round(
        benchmarks.closer_weekly_demos * benchmarks.closer_offer_rate
      ).toString(),
    },
    {
      label: "Deals Closed",
      value: data.deals_closed,
      displayValue: data.deals_closed.toString(),
      benchmark: Math.round(benchmarks.closer_weekly_demos * benchmarks.closer_close_rate),
      displayBenchmark: Math.round(
        benchmarks.closer_weekly_demos * benchmarks.closer_close_rate
      ).toString(),
      goalValue: findGoal("deals_closed"),
    },
    {
      label: "Close Rate %",
      value: closeRate,
      displayValue: formatPercent(closeRate),
      benchmark: benchmarks.closer_close_rate,
      displayBenchmark: formatPercent(benchmarks.closer_close_rate),
      isPercent: true,
    },
    {
      label: "Cash Collected",
      value: data.cash_collected,
      displayValue: formatCurrency(data.cash_collected),
      benchmark: benchmarks.closer_weekly_cash,
      displayBenchmark: formatCurrency(benchmarks.closer_weekly_cash),
      goalValue: findGoal("cash_collected"),
      isCurrency: true,
    },
    {
      label: "Avg Deal Size",
      value: avgDealSize,
      displayValue: formatCurrency(avgDealSize),
      benchmark: benchmarks.closer_avg_deal_size,
      displayBenchmark: formatCurrency(benchmarks.closer_avg_deal_size),
      isCurrency: true,
    },
    {
      label: "Revenue Per Call",
      value: revenuePerCall,
      displayValue: formatCurrency(revenuePerCall),
      benchmark: 0,
      displayBenchmark: "-",
      isCurrency: true,
    },
  ]
}

function MetricItem({ metric }: { metric: MetricRow }) {
  const progressValue =
    metric.benchmark > 0
      ? Math.min((metric.value / metric.benchmark) * 100, 100)
      : 0

  const goalProgress =
    metric.goalValue && metric.goalValue > 0
      ? Math.min((metric.value / metric.goalValue) * 100, 100)
      : null

  return (
    <div className="space-y-2 py-3 border-b last:border-b-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{metric.label}</span>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-semibold",
              metric.benchmark > 0
                ? getTextColorClass(metric.value, metric.benchmark)
                : "text-foreground"
            )}
          >
            {metric.displayValue}
          </span>
          {metric.benchmark > 0 && (
            <span className="text-xs text-muted-foreground">
              / {metric.displayBenchmark}
            </span>
          )}
        </div>
      </div>

      {metric.benchmark > 0 && (
        <Progress
          value={progressValue}
          className="h-2"
          indicatorClassName={getColorClass(metric.value, metric.benchmark)}
        />
      )}

      {goalProgress !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Personal goal: {metric.isCurrency ? formatCurrency(metric.goalValue!) : metric.goalValue}
            </span>
            <span className="text-xs text-blue-600 font-medium">
              {Math.round(goalProgress)}%
            </span>
          </div>
          <Progress
            value={goalProgress}
            className="h-1.5"
            indicatorClassName="bg-blue-500"
          />
        </div>
      )}
    </div>
  )
}

function MetricsList({
  metrics,
}: {
  metrics: MetricRow[]
}) {
  return (
    <div className="divide-y-0">
      {metrics.map((metric) => (
        <MetricItem key={metric.label} metric={metric} />
      ))}
    </div>
  )
}

export function Scorecard({
  role,
  weekData,
  monthData,
  benchmarks,
  goals,
}: ScorecardProps) {
  const weekMetrics =
    role === "setter"
      ? buildSetterMetrics(weekData, benchmarks, goals)
      : buildCloserMetrics(weekData, benchmarks, goals)

  // For month metrics, scale benchmarks by ~4.33 weeks
  const monthBenchmarks: Benchmarks = {
    ...benchmarks,
    setter_weekly_dials: Math.round(benchmarks.setter_weekly_dials * 4.33),
    setter_weekly_conversations: Math.round(benchmarks.setter_weekly_conversations * 4.33),
    setter_weekly_bookings: Math.round(benchmarks.setter_weekly_bookings * 4.33),
    closer_weekly_demos: Math.round(benchmarks.closer_weekly_demos * 4.33),
    closer_weekly_cash: Math.round(benchmarks.closer_weekly_cash * 4.33),
  }

  const monthMetrics =
    role === "setter"
      ? buildSetterMetrics(monthData, monthBenchmarks, goals)
      : buildCloserMetrics(monthData, monthBenchmarks, goals)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">My Scorecard</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="week">
          <TabsList className="w-full">
            <TabsTrigger value="week" className="flex-1">
              This Week
            </TabsTrigger>
            <TabsTrigger value="month" className="flex-1">
              This Month
            </TabsTrigger>
          </TabsList>
          <TabsContent value="week">
            <MetricsList metrics={weekMetrics} />
          </TabsContent>
          <TabsContent value="month">
            <MetricsList metrics={monthMetrics} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
