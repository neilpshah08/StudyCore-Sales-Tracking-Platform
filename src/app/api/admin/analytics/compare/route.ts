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
    const rep1Id = searchParams.get("rep1_id")
    const rep2Id = searchParams.get("rep2_id")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    if (!rep1Id || !rep2Id || !startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required parameters: rep1_id, rep2_id, startDate, endDate" },
        { status: 400 }
      )
    }

    // Fetch both reps' profiles and their activity + deals in parallel
    const [
      rep1Profile,
      rep2Profile,
      rep1Activity,
      rep2Activity,
      rep1Deals,
      rep2Deals,
      rep1QA,
      rep2QA,
    ] = await Promise.all([
      supabase
        .from("users")
        .select("id, full_name, role")
        .eq("id", rep1Id)
        .single(),
      supabase
        .from("users")
        .select("id, full_name, role")
        .eq("id", rep2Id)
        .single(),
      supabase
        .from("daily_activity")
        .select("*")
        .eq("user_id", rep1Id)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("daily_activity")
        .select("*")
        .eq("user_id", rep2Id)
        .gte("date", startDate)
        .lte("date", endDate),
      supabase
        .from("deals")
        .select("deal_value, cash_collected, status, date_closed")
        .or(`setter_id.eq.${rep1Id},closer_id.eq.${rep1Id}`)
        .gte("date_closed", startDate)
        .lte("date_closed", endDate)
        .eq("status", "active"),
      supabase
        .from("deals")
        .select("deal_value, cash_collected, status, date_closed")
        .or(`setter_id.eq.${rep2Id},closer_id.eq.${rep2Id}`)
        .gte("date_closed", startDate)
        .lte("date_closed", endDate)
        .eq("status", "active"),
      supabase
        .from("call_reviews")
        .select("weighted_score, date")
        .eq("rep_id", rep1Id)
        .gte("date", startDate)
        .lte("date", endDate)
        .not("weighted_score", "is", null),
      supabase
        .from("call_reviews")
        .select("weighted_score, date")
        .eq("rep_id", rep2Id)
        .gte("date", startDate)
        .lte("date", endDate)
        .not("weighted_score", "is", null),
    ])

    if (!rep1Profile.data || !rep2Profile.data) {
      return NextResponse.json({ error: "One or both reps not found" }, { status: 404 })
    }

    const role = rep1Profile.data.role

    function aggregateActivity(activities: typeof rep1Activity.data) {
      const acts = activities || []
      return {
        dials: acts.reduce((s, a) => s + (a.dials_made || 0), 0),
        conversations: acts.reduce((s, a) => s + (a.conversations || 0), 0),
        qualifiedBookings: acts.reduce((s, a) => s + (a.qualified_bookings || 0), 0),
        introsCompleted: acts.reduce((s, a) => s + (a.intros_completed || 0), 0),
        demosBookedFromIntros: acts.reduce(
          (s, a) => s + (a.demos_booked_from_intros || 0),
          0
        ),
        demosScheduled: acts.reduce((s, a) => s + (a.demos_scheduled || 0), 0),
        demosCompleted: acts.reduce((s, a) => s + (a.demos_completed || 0), 0),
        offersMade: acts.reduce((s, a) => s + (a.offers_made || 0), 0),
        dealsClosed: acts.reduce((s, a) => s + (a.deals_closed || 0), 0),
        cashCollected: acts.reduce((s, a) => s + (a.cash_collected || 0), 0),
        pifDeals: acts.reduce((s, a) => s + (a.pif_deals || 0), 0),
        followUpsCompleted: acts.reduce(
          (s, a) => s + (a.follow_ups_completed || 0),
          0
        ),
      }
    }

    const rep1Agg = aggregateActivity(rep1Activity.data)
    const rep2Agg = aggregateActivity(rep2Activity.data)

    function buildKPIs(
      agg: ReturnType<typeof aggregateActivity>,
      deals: typeof rep1Deals.data
    ) {
      const dealData = deals || []
      const totalDealValue = dealData.reduce((s, d) => s + (d.deal_value || 0), 0)

      if (role === "setter") {
        const contactRate =
          agg.dials > 0 ? agg.conversations / agg.dials : 0
        const bookRate =
          agg.conversations > 0 ? agg.qualifiedBookings / agg.conversations : 0
        const introDemoRate =
          agg.introsCompleted > 0
            ? agg.demosBookedFromIntros / agg.introsCompleted
            : 0
        return {
          dials: agg.dials,
          conversations: agg.conversations,
          bookings: agg.qualifiedBookings,
          contactRate,
          bookRate,
          introDemoRate,
        }
      } else {
        const closeRate =
          agg.demosCompleted > 0 ? agg.dealsClosed / agg.demosCompleted : 0
        const avgDealSize =
          agg.dealsClosed > 0 ? totalDealValue / agg.dealsClosed : 0
        return {
          demosCompleted: agg.demosCompleted,
          offersMade: agg.offersMade,
          dealsClosed: agg.dealsClosed,
          closeRate,
          cashCollected: agg.cashCollected,
          avgDealSize,
        }
      }
    }

    const rep1KPIs = buildKPIs(rep1Agg, rep1Deals.data)
    const rep2KPIs = buildKPIs(rep2Agg, rep2Deals.data)

    // QA scores
    const rep1Scores = rep1QA.data || []
    const rep2Scores = rep2QA.data || []
    const rep1AvgQA =
      rep1Scores.length > 0
        ? rep1Scores.reduce((s, r) => s + (r.weighted_score || 0), 0) /
          rep1Scores.length
        : null
    const rep2AvgQA =
      rep2Scores.length > 0
        ? rep2Scores.reduce((s, r) => s + (r.weighted_score || 0), 0) /
          rep2Scores.length
        : null

    // Daily trend data for line chart
    const allDates = new Set<string>()
    for (const a of rep1Activity.data || []) allDates.add(a.date)
    for (const a of rep2Activity.data || []) allDates.add(a.date)
    const sortedDates = Array.from(allDates).sort()

    const rep1DailyMap = new Map(
      (rep1Activity.data || []).map((a) => [a.date, a])
    )
    const rep2DailyMap = new Map(
      (rep2Activity.data || []).map((a) => [a.date, a])
    )

    const trend = sortedDates.map((date) => {
      const r1 = rep1DailyMap.get(date)
      const r2 = rep2DailyMap.get(date)
      if (role === "setter") {
        return {
          date,
          rep1: r1?.qualified_bookings || 0,
          rep2: r2?.qualified_bookings || 0,
        }
      } else {
        return {
          date,
          rep1: r1?.cash_collected || 0,
          rep2: r2?.cash_collected || 0,
        }
      }
    })

    return NextResponse.json({
      role,
      rep1: {
        id: rep1Profile.data.id,
        name: rep1Profile.data.full_name,
        kpis: rep1KPIs,
        avgQAScore: rep1AvgQA,
      },
      rep2: {
        id: rep2Profile.data.id,
        name: rep2Profile.data.full_name,
        kpis: rep2KPIs,
        avgQAScore: rep2AvgQA,
      },
      trend,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
