"use client"

import {
  DollarSign,
  Handshake,
  Target,
  Megaphone,
  TrendingUp,
  Users,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn, formatCurrency, formatPercent } from "@/lib/utils"

interface OverviewData {
  totalRevenue: number
  totalRevenueLastMonth: number
  totalDealsClosed: number
  totalDealsLastMonth: number
  avgCloseRate: number
  avgCloseRateLastMonth: number
  totalAdSpend: number
  totalAdSpendLastMonth: number
  roas: number
  roasLastMonth: number
  activeReps: number
  activeRepsLastMonth: number
}

interface OverviewCardsProps {
  data: OverviewData
}

function getChangeText(current: number, previous: number, isCurrency = false, isPercent = false): { text: string; positive: boolean } {
  if (previous === 0) return { text: "No prior data", positive: true }
  const diff = current - previous
  const pctChange = ((diff / previous) * 100).toFixed(1)
  const sign = diff >= 0 ? "+" : ""
  let label = ""
  if (isCurrency) {
    label = `${sign}${formatCurrency(diff)} (${sign}${pctChange}%) vs last month`
  } else if (isPercent) {
    label = `${sign}${(diff * 100).toFixed(1)}pp vs last month`
  } else {
    label = `${sign}${diff} (${sign}${pctChange}%) vs last month`
  }
  return { text: label, positive: diff >= 0 }
}

export function OverviewCards({ data }: OverviewCardsProps) {
  const cards = [
    {
      title: "Total Revenue",
      value: formatCurrency(data.totalRevenue),
      icon: DollarSign,
      valueClass: "text-green-600",
      change: getChangeText(data.totalRevenue, data.totalRevenueLastMonth, true),
    },
    {
      title: "Deals Closed",
      value: data.totalDealsClosed.toString(),
      icon: Handshake,
      valueClass: "text-[#1B2A4A]",
      change: getChangeText(data.totalDealsClosed, data.totalDealsLastMonth),
    },
    {
      title: "Avg Close Rate",
      value: formatPercent(data.avgCloseRate),
      icon: Target,
      valueClass: data.avgCloseRate >= 0.3 ? "text-green-600" : "text-red-600",
      change: getChangeText(data.avgCloseRate, data.avgCloseRateLastMonth, false, true),
    },
    {
      title: "Total Ad Spend",
      value: formatCurrency(data.totalAdSpend),
      icon: Megaphone,
      valueClass: "text-[#1B2A4A]",
      change: getChangeText(data.totalAdSpend, data.totalAdSpendLastMonth, true),
    },
    {
      title: "ROAS",
      value: `${data.roas.toFixed(1)}x`,
      icon: TrendingUp,
      valueClass: data.roas >= 3 ? "text-green-600" : "text-red-600",
      change: getChangeText(data.roas, data.roasLastMonth),
    },
    {
      title: "Active Reps",
      value: data.activeReps.toString(),
      icon: Users,
      valueClass: "text-[#1B2A4A]",
      change: getChangeText(data.activeReps, data.activeRepsLastMonth),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={cn("text-2xl font-bold", card.valueClass)}>
                {card.value}
              </div>
              <p
                className={cn(
                  "mt-1 text-xs",
                  card.change.positive
                    ? "text-green-600"
                    : "text-red-600"
                )}
              >
                {card.change.text}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
