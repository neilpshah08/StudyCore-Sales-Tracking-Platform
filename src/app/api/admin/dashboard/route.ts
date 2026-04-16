import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getWeekStart, getMonthStart, getMonthEnd } from "@/lib/utils"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date()
    const monthStart = getMonthStart(now)
    const monthEnd = getMonthEnd(now)
    const weekStart = getWeekStart(now)

    // Previous month dates
    const prevMonth = new Date(now)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const prevMonthStart = getMonthStart(prevMonth)
    const prevMonthEnd = getMonthEnd(prevMonth)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const prevWeekStartStr = prevWeekStart.toISOString().split("T")[0]

    // ------------------------------------------------------------------
    // Parallel queries
    // ------------------------------------------------------------------
    const [
      dealsThisMonth,
      dealsLastMonth,
      activityThisMonth,
      activityLastMonth,
      adSpendThisMonth,
      adSpendLastMonth,
      weeklyAdSpend,
      activeRepsResult,
      activeRepsLastMonthResult,
      allReps,
      activityThisWeek,
      activityLastWeek,
      monthlyTrendsDeals,
      monthlyTrendsActivity,
      monthlyTrendsAdSpend,
      todayActivity,
    ] = await Promise.all([
      // 1. Deals this month
      supabase
        .from("deals")
        .select("cash_collected, deal_value, status")
        .gte("date_closed", monthStart)
        .lte("date_closed", monthEnd)
        .eq("status", "active"),

      // 2. Deals last month
      supabase
        .from("deals")
        .select("cash_collected, deal_value, status")
        .gte("date_closed", prevMonthStart)
        .lte("date_closed", prevMonthEnd)
        .eq("status", "active"),

      // 3. Activity this month (all reps)
      supabase
        .from("daily_activities")
        .select("user_id, dials_made, conversations, qualified_bookings, intros_completed, demos_booked_from_intros, demos_scheduled, demos_completed, offers_made, deals_closed, cash_collected")
        .gte("date", monthStart)
        .lte("date", monthEnd),

      // 4. Activity last month (all reps)
      supabase
        .from("daily_activities")
        .select("user_id, demos_completed, deals_closed, cash_collected")
        .gte("date", prevMonthStart)
        .lte("date", prevMonthEnd),

      // 5. Ad spend this month
      supabase
        .from("weekly_ad_spend")
        .select("spend_amount")
        .gte("week_start", monthStart)
        .lte("week_start", monthEnd),

      // 6. Ad spend last month
      supabase
        .from("weekly_ad_spend")
        .select("spend_amount")
        .gte("week_start", prevMonthStart)
        .lte("week_start", prevMonthEnd),

      // 7. Weekly ad spend for current week
      supabase
        .from("weekly_ad_spend")
        .select("*")
        .eq("week_start", weekStart),

      // 8. Active reps count
      supabase
        .from("users")
        .select("id", { count: "exact" })
        .eq("status", "active")
        .neq("role", "admin"),

      // 9. Active reps last month (approximate - use current data)
      supabase
        .from("users")
        .select("id", { count: "exact" })
        .neq("role", "admin"),

      // 10. All reps for team performance
      supabase
        .from("users")
        .select("id, full_name, role, status")
        .neq("role", "admin"),

      // 11. Activity this week (for team performance)
      supabase
        .from("daily_activities")
        .select("user_id, qualified_bookings, cash_collected, demos_completed, deals_closed")
        .gte("date", weekStart),

      // 12. Activity last week (for trend comparison)
      supabase
        .from("daily_activities")
        .select("user_id, qualified_bookings, cash_collected, demos_completed, deals_closed")
        .gte("date", prevWeekStartStr)
        .lt("date", weekStart),

      // 13. Monthly deals for trend (past 6 months)
      supabase
        .from("deals")
        .select("date_closed, cash_collected, status")
        .gte("date_closed", (() => {
          const d = new Date(now)
          d.setMonth(d.getMonth() - 5)
          d.setDate(1)
          return d.toISOString().split("T")[0]
        })())
        .eq("status", "active"),

      // 14. Monthly activity for trend
      supabase
        .from("daily_activities")
        .select("date, demos_scheduled, demos_completed, offers_made, deals_closed")
        .gte("date", (() => {
          const d = new Date(now)
          d.setMonth(d.getMonth() - 5)
          d.setDate(1)
          return d.toISOString().split("T")[0]
        })()),

      // 15. Monthly ad spend for trend
      supabase
        .from("weekly_ad_spend")
        .select("week_start, spend_amount")
        .gte("week_start", (() => {
          const d = new Date(now)
          d.setMonth(d.getMonth() - 5)
          d.setDate(1)
          return d.toISOString().split("T")[0]
        })()),

      // 16. Today's activity for speed-to-lead
      supabase
        .from("daily_activities")
        .select("user_id, speed_to_lead_avg_min")
        .eq("date", now.toISOString().split("T")[0]),
    ])

    // ------------------------------------------------------------------
    // Process overview data
    // ------------------------------------------------------------------
    const totalRevenue = (dealsThisMonth.data || []).reduce(
      (sum, d) => sum + (d.cash_collected || 0),
      0
    )
    const totalRevenueLastMonth = (dealsLastMonth.data || []).reduce(
      (sum, d) => sum + (d.cash_collected || 0),
      0
    )
    const totalDealsClosed = (dealsThisMonth.data || []).length
    const totalDealsLastMonth = (dealsLastMonth.data || []).length

    // Close rate: deals_closed / demos_completed for closers this month
    const actMonth = activityThisMonth.data || []
    const closerIds = new Set(
      (allReps.data || []).filter((r) => r.role === "closer").map((r) => r.id)
    )
    const closerActivity = actMonth.filter((a) => closerIds.has(a.user_id))
    const totalDemosCompleted = closerActivity.reduce(
      (s, a) => s + (a.demos_completed || 0),
      0
    )
    const totalDealsFromActivity = closerActivity.reduce(
      (s, a) => s + (a.deals_closed || 0),
      0
    )
    const avgCloseRate =
      totalDemosCompleted > 0 ? totalDealsFromActivity / totalDemosCompleted : 0

    const actLastMonth = activityLastMonth.data || []
    const closerActivityLast = actLastMonth.filter((a) => closerIds.has(a.user_id))
    const lastDemos = closerActivityLast.reduce(
      (s, a) => s + (a.demos_completed || 0),
      0
    )
    const lastDeals = closerActivityLast.reduce(
      (s, a) => s + (a.deals_closed || 0),
      0
    )
    const avgCloseRateLastMonth = lastDemos > 0 ? lastDeals / lastDemos : 0

    const totalAdSpend = (adSpendThisMonth.data || []).reduce(
      (s, a) => s + (a.spend_amount || 0),
      0
    )
    const totalAdSpendLastMonth = (adSpendLastMonth.data || []).reduce(
      (s, a) => s + (a.spend_amount || 0),
      0
    )
    const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0
    const roasLastMonth =
      totalAdSpendLastMonth > 0
        ? totalRevenueLastMonth / totalAdSpendLastMonth
        : 0

    const activeReps = activeRepsResult.count || 0
    const activeRepsLastMonth = activeRepsLastMonthResult.count || 0

    // ------------------------------------------------------------------
    // Funnel data
    // ------------------------------------------------------------------
    const funnelAgg = actMonth.reduce(
      (acc, a) => {
        acc.dials += a.dials_made || 0
        acc.conversations += a.conversations || 0
        acc.qualifiedBookings += a.qualified_bookings || 0
        acc.introsCompleted += a.intros_completed || 0
        acc.demosBooked += a.demos_booked_from_intros || 0
        acc.demosScheduled += a.demos_scheduled || 0
        acc.demosCompleted += a.demos_completed || 0
        acc.offersMade += a.offers_made || 0
        acc.dealsClosed += a.deals_closed || 0
        return acc
      },
      {
        dials: 0,
        conversations: 0,
        qualifiedBookings: 0,
        introsCompleted: 0,
        demosBooked: 0,
        demosScheduled: 0,
        demosCompleted: 0,
        offersMade: 0,
        dealsClosed: 0,
      }
    )

    const funnelStages = [
      funnelAgg.dials,
      funnelAgg.conversations,
      funnelAgg.qualifiedBookings,
      funnelAgg.introsCompleted,
      funnelAgg.demosBooked,
      funnelAgg.demosCompleted,
      funnelAgg.offersMade,
      funnelAgg.dealsClosed,
    ]
    const funnelNames = [
      "New Leads (Dials)",
      "Conversations",
      "Qualified Bookings",
      "Intros Completed",
      "Demos Booked",
      "Demos Completed",
      "Offers Made",
      "Closed Won",
    ]
    const funnelData = funnelNames.map((name, i) => ({
      name,
      count: funnelStages[i],
      conversionRate:
        i < funnelStages.length - 1 && funnelStages[i] > 0
          ? (funnelStages[i + 1] / funnelStages[i]) * 100
          : -1,
    }))

    // ------------------------------------------------------------------
    // Team performance
    // ------------------------------------------------------------------
    const weekActivity = activityThisWeek.data || []
    const lastWeekActivity = activityLastWeek.data || []

    const teamPerformance = (allReps.data || []).map((rep) => {
      const weekAct = weekActivity.filter((a) => a.user_id === rep.id)
      const lastAct = lastWeekActivity.filter((a) => a.user_id === rep.id)
      const monthAct = actMonth.filter((a) => a.user_id === rep.id)

      let weekKPI = 0
      let monthKPI = 0
      let closeOrBookRate = 0

      if (rep.role === "closer") {
        weekKPI = weekAct.reduce((s, a) => s + (a.cash_collected || 0), 0)
        monthKPI = monthAct.reduce((s, a) => s + (a.cash_collected || 0), 0)
        const md = monthAct.reduce((s, a) => s + (a.demos_completed || 0), 0)
        const mdc = monthAct.reduce((s, a) => s + (a.deals_closed || 0), 0)
        closeOrBookRate = md > 0 ? mdc / md : 0
      } else {
        weekKPI = weekAct.reduce((s, a) => s + (a.qualified_bookings || 0), 0)
        monthKPI = monthAct.reduce((s, a) => s + (a.qualified_bookings || 0), 0)
        const mc = monthAct.reduce((s, a) => s + (a.demos_completed || 0), 0)
        const mb = monthAct.reduce((s, a) => s + (a.qualified_bookings || 0), 0)
        closeOrBookRate = mc > 0 ? mb / mc : 0
      }

      // Trend: compare this week KPI to last week
      let lastWeekKPI = 0
      if (rep.role === "closer") {
        lastWeekKPI = lastAct.reduce((s, a) => s + (a.cash_collected || 0), 0)
      } else {
        lastWeekKPI = lastAct.reduce((s, a) => s + (a.qualified_bookings || 0), 0)
      }

      let trend: "up" | "down" | "flat" = "flat"
      if (weekKPI > lastWeekKPI) trend = "up"
      else if (weekKPI < lastWeekKPI) trend = "down"

      return {
        id: rep.id,
        name: rep.full_name,
        role: rep.role as "setter" | "closer",
        status: rep.status as "active" | "inactive" | "terminated",
        weekKPI,
        monthKPI,
        closeOrBookRate,
        trend,
      }
    })

    // ------------------------------------------------------------------
    // Monthly trends (past 6 months)
    // ------------------------------------------------------------------
    const monthlyMap: Record<
      string,
      {
        revenue: number
        deals: number
        demosScheduled: number
        demosCompleted: number
        dealsClosed: number
      }
    > = {}

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const key = d.toLocaleString("en-US", { month: "short", year: "2-digit" })
      const mStart = getMonthStart(d)
      const mEnd = getMonthEnd(d)
      monthlyMap[key] = {
        revenue: 0,
        deals: 0,
        demosScheduled: 0,
        demosCompleted: 0,
        dealsClosed: 0,
      }

      // Deals
      for (const deal of monthlyTrendsDeals.data || []) {
        if (deal.date_closed >= mStart && deal.date_closed <= mEnd) {
          monthlyMap[key].revenue += deal.cash_collected || 0
          monthlyMap[key].deals += 1
        }
      }

      // Activity
      for (const act of monthlyTrendsActivity.data || []) {
        if (act.date >= mStart && act.date <= mEnd) {
          monthlyMap[key].demosScheduled += act.demos_scheduled || 0
          monthlyMap[key].demosCompleted += act.demos_completed || 0
          monthlyMap[key].dealsClosed += act.deals_closed || 0
        }
      }
    }

    const monthlyTrends = Object.entries(monthlyMap).map(([month, d]) => ({
      month,
      revenue: d.revenue,
      deals: d.deals,
      closeRate: d.demosCompleted > 0 ? d.dealsClosed / d.demosCompleted : 0,
      showRate:
        d.demosScheduled > 0 ? d.demosCompleted / d.demosScheduled : 0,
    }))

    // ------------------------------------------------------------------
    // Speed to lead
    // ------------------------------------------------------------------
    const setterIds = new Set(
      (allReps.data || [])
        .filter((r) => r.role === "setter" && r.status === "active")
        .map((r) => r.id)
    )
    const setterMap = new Map(
      (allReps.data || [])
        .filter((r) => r.role === "setter" && r.status === "active")
        .map((r) => [r.id, r.full_name])
    )

    const speedToLead = Array.from(setterMap.entries()).map(([id, name]) => {
      const todayAct = (todayActivity.data || []).find(
        (a) => a.user_id === id
      )
      return {
        id,
        name,
        avgMinutes: todayAct?.speed_to_lead_avg_min ?? null,
      }
    })

    // ------------------------------------------------------------------
    // Response
    // ------------------------------------------------------------------
    return NextResponse.json({
      overview: {
        totalRevenue,
        totalRevenueLastMonth,
        totalDealsClosed,
        totalDealsLastMonth,
        avgCloseRate,
        avgCloseRateLastMonth,
        totalAdSpend,
        totalAdSpendLastMonth,
        roas,
        roasLastMonth,
        activeReps,
        activeRepsLastMonth,
      },
      funnelData,
      teamPerformance,
      monthlyTrends,
      speedToLead,
      weeklyAdSpend: weeklyAdSpend.data || [],
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
