import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    const now = new Date()
    const defaultStart = new Date(now)
    defaultStart.setDate(defaultStart.getDate() - 90)
    const filterStart = startDate || defaultStart.toISOString().split("T")[0]
    const filterEnd = endDate || now.toISOString().split("T")[0]

    // Fetch lost deals: status refunded/chargedback OR lost_reason not null
    const [lostDealsResult, allDealsResult, closersResult] = await Promise.all([
      supabase
        .from("deals")
        .select(
          "id, date_closed, student_name, closer_id, deal_value, lost_reason, notes, status"
        )
        .gte("date_closed", filterStart)
        .lte("date_closed", filterEnd)
        .or("status.eq.refunded,status.eq.chargedback,lost_reason.not.is.null"),

      supabase
        .from("deals")
        .select("id, status, offers_made:deal_value")
        .gte("date_closed", filterStart)
        .lte("date_closed", filterEnd),

      supabase
        .from("users")
        .select("id, full_name")
        .in("role", ["closer"]),
    ])

    const lostDeals = lostDealsResult.data || []
    const allDeals = allDealsResult.data || []
    const closers = closersResult.data || []

    const closerMap = new Map(closers.map((c) => [c.id, c.full_name]))

    // Enrich lost deals with closer name
    const enrichedDeals = lostDeals.map((d) => ({
      ...d,
      closer_name: d.closer_id ? closerMap.get(d.closer_id) || "Unknown" : "Unknown",
    }))

    // Reason distribution
    const reasonCounts: Record<string, number> = {}
    for (const deal of lostDeals) {
      const reason = deal.lost_reason || deal.status || "Unknown"
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
    }

    // Per-closer breakdown
    const closerBreakdown: Record<
      string,
      { name: string; reasons: Record<string, number>; totalLost: number; totalRevenueLost: number }
    > = {}

    for (const deal of lostDeals) {
      const closerId = deal.closer_id || "unassigned"
      const closerName = deal.closer_id
        ? closerMap.get(deal.closer_id) || "Unknown"
        : "Unassigned"
      const reason = deal.lost_reason || deal.status || "Unknown"

      if (!closerBreakdown[closerId]) {
        closerBreakdown[closerId] = {
          name: closerName,
          reasons: {},
          totalLost: 0,
          totalRevenueLost: 0,
        }
      }
      closerBreakdown[closerId].reasons[reason] =
        (closerBreakdown[closerId].reasons[reason] || 0) + 1
      closerBreakdown[closerId].totalLost += 1
      closerBreakdown[closerId].totalRevenueLost += deal.deal_value || 0
    }

    // Weekly trend (last 12 weeks)
    const weeklyTrend: { weekStart: string; count: number; revenue: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 - i * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      const ws = weekStart.toISOString().split("T")[0]
      const we = weekEnd.toISOString().split("T")[0]

      const weekDeals = lostDeals.filter(
        (d) => d.date_closed >= ws && d.date_closed <= we
      )
      weeklyTrend.push({
        weekStart: ws,
        count: weekDeals.length,
        revenue: weekDeals.reduce((s, d) => s + (d.deal_value || 0), 0),
      })
    }

    // Summary stats
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0]
    const thisMonthLost = lostDeals.filter(
      (d) => d.date_closed >= monthStart
    )
    const totalLostRevenue = lostDeals.reduce(
      (s, d) => s + (d.deal_value || 0),
      0
    )
    const totalOffers = allDeals.length
    const lostRate = totalOffers > 0 ? lostDeals.length / totalOffers : 0

    // Most common reason
    let mostCommonReason = "N/A"
    let maxCount = 0
    for (const [reason, count] of Object.entries(reasonCounts)) {
      if (count > maxCount) {
        maxCount = count
        mostCommonReason = reason
      }
    }

    return NextResponse.json({
      deals: enrichedDeals,
      summary: {
        totalLostThisMonth: thisMonthLost.length,
        totalLostRevenue,
        mostCommonReason,
        lostRate,
      },
      reasonDistribution: Object.entries(reasonCounts).map(
        ([reason, count]) => ({ reason, count })
      ),
      closerBreakdown: Object.values(closerBreakdown),
      weeklyTrend,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
