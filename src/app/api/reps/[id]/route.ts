import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { UserStatus } from "@/types/database"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      )
    }

    // Fetch all data in parallel
    const [repResult, activitiesResult, callReviewsResult, dealsResult, notesResult] =
      await Promise.all([
        // Rep profile
        supabase.from("users").select("*").eq("id", id).single(),

        // Last 12 weeks of daily activities
        (() => {
          const twelveWeeksAgo = new Date()
          twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
          return supabase
            .from("daily_activity")
            .select("*")
            .eq("user_id", id)
            .gte("date", twelveWeeksAgo.toISOString().split("T")[0])
            .order("date", { ascending: true })
        })(),

        // Call reviews
        supabase
          .from("call_reviews")
          .select("*")
          .eq("rep_id", id)
          .order("date", { ascending: false }),

        // Deals where rep is setter or closer
        supabase
          .from("deals")
          .select("*")
          .or(`setter_id.eq.${id},closer_id.eq.${id}`)
          .order("date_closed", { ascending: false }),

        // Rep notes
        supabase
          .from("rep_notes")
          .select("*")
          .eq("rep_id", id)
          .order("created_at", { ascending: false }),
      ])

    if (repResult.error) {
      return NextResponse.json({ error: repResult.error.message }, { status: 404 })
    }

    const rep = repResult.data
    const activities = activitiesResult.data ?? []
    const callReviews = callReviewsResult.data ?? []
    const deals = dealsResult.data ?? []
    const notes = notesResult.data ?? []

    // Fetch reviewer names for call reviews
    const reviewerIds = [...new Set(callReviews.map((r) => r.reviewed_by))]
    let reviewerMap: Record<string, string> = {}
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", reviewerIds)

      if (reviewers) {
        reviewerMap = Object.fromEntries(
          reviewers.map((r) => [r.id, r.full_name])
        )
      }
    }

    // Fetch note author names
    const authorIds = [...new Set(notes.map((n) => n.author_id))]
    let authorMap: Record<string, string> = {}
    if (authorIds.length > 0) {
      const { data: authors } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", authorIds)

      if (authors) {
        authorMap = Object.fromEntries(
          authors.map((a) => [a.id, a.full_name])
        )
      }
    }

    // Aggregate activities into weekly data
    const weeklyMap = new Map<
      string,
      {
        weekStart: string
        dials_made: number
        conversations: number
        qualified_bookings: number
        follow_ups_completed: number
        demos_scheduled: number
        demos_completed: number
        offers_made: number
        deals_closed: number
        cash_collected: number
        pif_deals: number
        payment_plan_deals: number
        intros_completed: number
        demos_booked_from_intros: number
        show_confirmations_sent: number
      }
    >()

    for (const a of activities) {
      const d = new Date(a.date)
      const dayOfWeek = d.getDay()
      const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(diffToMonday)
      const weekKey = monday.toISOString().split("T")[0]

      const existing = weeklyMap.get(weekKey) ?? {
        weekStart: weekKey,
        dials_made: 0,
        conversations: 0,
        qualified_bookings: 0,
        follow_ups_completed: 0,
        demos_scheduled: 0,
        demos_completed: 0,
        offers_made: 0,
        deals_closed: 0,
        cash_collected: 0,
        pif_deals: 0,
        payment_plan_deals: 0,
        intros_completed: 0,
        demos_booked_from_intros: 0,
        show_confirmations_sent: 0,
      }

      existing.dials_made += a.dials_made ?? 0
      existing.conversations += a.conversations ?? 0
      existing.qualified_bookings += a.qualified_bookings ?? 0
      existing.follow_ups_completed += a.follow_ups_completed ?? 0
      existing.demos_scheduled += a.demos_scheduled ?? 0
      existing.demos_completed += a.demos_completed ?? 0
      existing.offers_made += a.offers_made ?? 0
      existing.deals_closed += a.deals_closed ?? 0
      existing.cash_collected += a.cash_collected ?? 0
      existing.pif_deals += a.pif_deals ?? 0
      existing.payment_plan_deals += a.payment_plan_deals ?? 0
      existing.intros_completed += a.intros_completed ?? 0
      existing.demos_booked_from_intros += a.demos_booked_from_intros ?? 0
      existing.show_confirmations_sent += a.show_confirmations_sent ?? 0

      weeklyMap.set(weekKey, existing)
    }

    const weeklyData = Array.from(weeklyMap.values()).sort(
      (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
    )

    // Build performance array for chart (primary KPI per week)
    const performance = weeklyData.map((w) => ({
      weekStart: w.weekStart,
      primaryKpi:
        rep.role === "setter" ? w.qualified_bookings : w.cash_collected,
    }))

    // Enrich call reviews with reviewer names
    const enrichedReviews = callReviews.map((cr) => ({
      ...cr,
      reviewer_name: reviewerMap[cr.reviewed_by] ?? "Unknown",
    }))

    // Enrich notes with author names
    const enrichedNotes = notes.map((n) => ({
      ...n,
      author_name: authorMap[n.author_id] ?? "Unknown",
    }))

    return NextResponse.json({
      rep,
      performance: performance.reverse(),
      callReviews: enrichedReviews,
      deals,
      notes: enrichedNotes,
      weeklyData,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Only allow specific fields to be updated
    const allowedFields: Record<string, unknown> = {}
    const updatableKeys = [
      "full_name",
      "commission_rate",
      "base_pay_weekly",
      "status",
      "termination_date",
    ] as const

    for (const key of updatableKeys) {
      if (body[key] !== undefined) {
        allowedFields[key] = body[key]
      }
    }

    if (Object.keys(allowedFields).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 }
      )
    }

    // If status is being changed to terminated, require termination_date
    if (
      allowedFields.status === "terminated" &&
      !allowedFields.termination_date
    ) {
      allowedFields.termination_date = new Date().toISOString().split("T")[0]
    }

    // If status is changed away from terminated, clear termination_date
    if (
      allowedFields.status &&
      (allowedFields.status as UserStatus) !== "terminated"
    ) {
      allowedFields.termination_date = null
    }

    const { data, error } = await supabase
      .from("users")
      .update(allowedFields)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
