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
      valueClass: "text-[#10B981]",
      glow: "shadow-[0_0_28px_rgba(16,185,129,0.12)]",
      iconClass: "text-[#10B981]",
      change: getChangeText(data.totalRevenue, data.totalRevenueLastMonth, true),
    },
    {
      title: "Deals Closed",
      value: data.totalDealsClosed.toString(),
      icon: Handshake,
      valueClass: "text-white",
      glow: "",
      iconClass: "text-[#60A5FA]",
      change: getChangeText(data.totalDealsClosed, data.totalDealsLastMonth),
    },
    {
      title: "Avg Close Rate",
      value: formatPercent(data.avgCloseRate),
      icon: Target,
      valueClass: data.avgCloseRate >= 0.3 ? "text-[#10B981]" : "text-[#EF4444]",
      glow: "",
      iconClass: "text-[#A78BFA]",
      change: getChangeText(data.avgCloseRate, data.avgCloseRateLastMonth, false, true),
    },
    {
      title: "Total Ad Spend",
      value: formatCurrency(data.totalAdSpend),
      icon: Megaphone,
      valueClass: "text-white",
      glow: "",
      iconClass: "text-[#F59E0B]",
      change: getChangeText(data.totalAdSpend, data.totalAdSpendLastMonth, true),
    },
    {
      title: "ROAS",
      value: `${data.roas.toFixed(1)}x`,
      icon: TrendingUp,
      valueClass: data.roas >= 3 ? "text-[#10B981]" : "text-[#EF4444]",
      glow: data.roas >= 3 ? "shadow-[0_0_28px_rgba(16,185,129,0.12)]" : "",
      iconClass: "text-[#10B981]",
      change: getChangeText(data.roas, data.roasLastMonth),
    },
    {
      title: "Active Reps",
      value: data.activeReps.toString(),
      icon: Users,
      valueClass: "text-white",
      glow: "",
      iconClass: "text-[#60A5FA]",
      change: getChangeText(data.activeReps, data.activeRepsLastMonth),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.title} className={cn("glass-card p-5", card.glow)}>
            <div className="flex items-center justify-between pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
                {card.title}
              </p>
              <div className="rounded-lg bg-white/5 p-2 border border-white/8">
                <Icon className={cn("h-4 w-4", card.iconClass)} />
              </div>
            </div>
            <div className={cn("metric-number text-3xl font-bold tracking-tight", card.valueClass)}>
              {card.value}
            </div>
            <p
              className={cn(
                "mt-1.5 text-xs",
                card.change.positive ? "text-[#6EE7B7]" : "text-[#FCA5A5]"
              )}
            >
              {card.change.text}
            </p>
          </div>
        )
      })}
    </div>
  )
}
