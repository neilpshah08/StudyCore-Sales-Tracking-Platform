import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { RefundsDashboard } from "@/components/admin/refunds-dashboard"

export interface RefundSummary {
  total_refunds_this_month: number
  total_refund_amount: number
  refund_rate: number
  total_clawbacks: number
}

export interface RefundWithDetails {
  id: string
  deal_id: string
  refund_date: string
  refund_amount: number
  reason: string
  setter_clawback: number
  closer_clawback: number
  processed_by: string | null
  notes: string | null
  created_at: string
  student_name: string
  deal_value: number
  date_closed: string
  setter_name: string | null
  closer_name: string | null
}

export interface RefundTrend {
  month: string
  refundRate: number
  refundCount: number
}

export interface DealForRefund {
  id: string
  student_name: string
  date_closed: string
  deal_value: number
  setter_commission: number | null
  closer_commission: number | null
}

export default async function AdminRefundsPage() {
  await requireAdmin()
  const supabase = await createClient()

  // -------------------------------------------------------------------
  // Date ranges
  // -------------------------------------------------------------------
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]

  // -------------------------------------------------------------------
  // Parallel data fetches
  // -------------------------------------------------------------------
  const [refundsResult, activeDealsResult, recentDealsResult] =
    await Promise.all([
      supabase
        .from("refunds")
        .select(
          `
          *,
          deal:deals!refunds_deal_id_fkey(
            id,
            student_name,
            deal_value,
            date_closed,
            setter_id,
            closer_id,
            setter_commission,
            closer_commission,
            setter:users!deals_setter_id_fkey(id, full_name),
            closer:users!deals_closer_id_fkey(id, full_name)
          )
        `
        )
        .order("refund_date", { ascending: false }),

      supabase
        .from("deals")
        .select(
          "id, student_name, date_closed, deal_value, setter_commission, closer_commission"
        )
        .eq("status", "active")
        .order("date_closed", { ascending: false }),

      // Get trailing 30-day deals for refund rate
      (() => {
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        return supabase
          .from("deals")
          .select("id, status")
          .gte("date_closed", thirtyDaysAgo.toISOString().split("T")[0])
      })(),
    ])

  const rawRefunds = refundsResult.data || []
  const activeDeals: DealForRefund[] = (activeDealsResult.data || []).map(
    (d) => ({
      id: d.id,
      student_name: d.student_name,
      date_closed: d.date_closed,
      deal_value: d.deal_value,
      setter_commission: d.setter_commission,
      closer_commission: d.closer_commission,
    })
  )

  // Flatten refund data
  const refunds: RefundWithDetails[] = rawRefunds.map((refund) => {
    const deal = refund.deal as Record<string, unknown> | null
    return {
      id: refund.id,
      deal_id: refund.deal_id,
      refund_date: refund.refund_date,
      refund_amount: refund.refund_amount,
      reason: refund.reason,
      setter_clawback: refund.setter_clawback,
      closer_clawback: refund.closer_clawback,
      processed_by: refund.processed_by,
      notes: refund.notes,
      created_at: refund.created_at,
      student_name: (deal?.student_name as string) ?? "Unknown",
      deal_value: (deal?.deal_value as number) ?? 0,
      date_closed: (deal?.date_closed as string) ?? "",
      setter_name:
        deal?.setter &&
        typeof deal.setter === "object" &&
        "full_name" in (deal.setter as Record<string, unknown>)
          ? (deal.setter as { full_name: string }).full_name
          : null,
      closer_name:
        deal?.closer &&
        typeof deal.closer === "object" &&
        "full_name" in (deal.closer as Record<string, unknown>)
          ? (deal.closer as { full_name: string }).full_name
          : null,
    }
  })

  // Summary stats
  const refundsThisMonth = refunds.filter(
    (r) => r.refund_date >= monthStart && r.refund_date <= monthEnd
  )

  const totalRefundsThisMonth = refundsThisMonth.length
  const totalRefundAmount = refundsThisMonth.reduce(
    (sum, r) => sum + r.refund_amount,
    0
  )

  const recentDeals = recentDealsResult.data || []
  const totalRecentDeals = recentDeals.length
  const refundedRecentDeals = recentDeals.filter(
    (d) => d.status === "refunded"
  ).length
  const refundRate =
    totalRecentDeals > 0 ? refundedRecentDeals / totalRecentDeals : 0

  const totalClawbacks = refunds.reduce(
    (sum, r) => sum + r.setter_clawback + r.closer_clawback,
    0
  )

  const summary: RefundSummary = {
    total_refunds_this_month: totalRefundsThisMonth,
    total_refund_amount: Math.round(totalRefundAmount * 100) / 100,
    refund_rate: Math.round(refundRate * 10000) / 10000,
    total_clawbacks: Math.round(totalClawbacks * 100) / 100,
  }

  // Refund rate trend (6 months)
  const trendData: RefundTrend[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
      .toISOString()
      .split("T")[0]
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0]
    const monthLabel = d.toLocaleString("en-US", {
      month: "short",
      year: "2-digit",
    })

    const monthRefunds = refunds.filter(
      (r) => r.refund_date >= mStart && r.refund_date <= mEnd
    )

    // Get deals for this month to calculate rate
    const { data: monthDeals } = await supabase
      .from("deals")
      .select("id")
      .gte("date_closed", mStart)
      .lte("date_closed", mEnd)

    const monthDealCount = (monthDeals || []).length
    const monthRefundCount = monthRefunds.length
    const monthRefundRate =
      monthDealCount > 0 ? monthRefundCount / monthDealCount : 0

    trendData.push({
      month: monthLabel,
      refundRate: Math.round(monthRefundRate * 10000) / 10000,
      refundCount: monthRefundCount,
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Refund Tracker</h1>
        <p className="text-muted-foreground">
          Process refunds, track clawbacks, and monitor refund trends.
        </p>
      </div>
      <RefundsDashboard
        summary={summary}
        refunds={refunds}
        trendData={trendData}
        deals={activeDeals}
      />
    </div>
  )
}
