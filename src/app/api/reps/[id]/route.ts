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

    const [repResult, activitiesResult, callReviewsResult, dealsResult, notesResult] =
      await Promise.all([
        supabase.from("users").select("*").eq("id", id).single(),
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
        supabase
          .from("call_reviews")
          .select("*")
          .eq("rep_id", id)
          .order("date", { ascending: false }),
        supabase
          .from("deals")
          .select("*")
          .or(`setter_id.eq.${id},closer_id.eq.${id}`)
          .order("date_closed", { ascending: false }),
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

    const reviewerIds = [...new Set(callReviews.map((r) => r.reviewed_by))]
    let reviewerMap: Record<string, string> = {}
    if (reviewerIds.length > 0) {
      const { data: reviewers } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", reviewerIds)
      if (reviewers) {
        reviewerMap = Object.fromEntries(reviewers.map((r) => [r.id, r.full_name]))
      }
    }

    const authorIds = [...new Set(notes.map((n) => n.author_id))]
    let authorMap: Record<string, string> = {}
    if (authorIds.length > 0) {
      const { data: authors } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", authorIds)
      if (authors) {
        authorMap = Object.fromEntries(authors.map((a) => [a.id, a.full_name]))
      }
    }

    const weeklyMap = new Map<string, Record<string, number | string>>()

    for (const a of activities) {
      const d = new Date(a.date)
      const dayOfWeek = d.getDay()
      const diffToMonday = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(diffToMonday)
      const weekKey = monday.toISOString().split("T")[0]

      const existing = weeklyMap.get(weekKey) ?? {
        weekStart: weekKey,
        dials_made: 0, conversations: 0, qualified_bookings: 0,
        follow_ups_completed: 0, demos_scheduled: 0, demos_completed: 0,
        offers_made: 0, deals_closed: 0, cash_collected: 0,
        pif_deals: 0, payment_plan_deals: 0, intros_completed: 0,
        demos_booked_from_intros: 0, show_confirmations_sent: 0,
      }

      const fields = [
        "dials_made", "conversations", "qualified_bookings", "follow_ups_completed",
        "demos_scheduled", "demos_completed", "offers_made", "deals_closed",
        "cash_collected", "pif_deals", "payment_plan_deals", "intros_completed",
        "demos_booked_from_intros", "show_confirmations_sent",
      ]
      for (const f of fields) {
        (existing as Record<string, number>)[f] =
          ((existing as Record<string, number>)[f] || 0) +
          ((a as Record<string, number>)[f] || 0)
      }

      weeklyMap.set(weekKey, existing)
    }

    const weeklyData = Array.from(weeklyMap.values()).sort(
      (a, b) => new Date(b.weekStart as string).getTime() - new Date(a.weekStart as string).getTime()
    )

    const performance = Array.from(weeklyMap.values())
      .sort((a, b) => new Date(a.weekStart as string).getTime() - new Date(b.weekStart as string).getTime())
      .map((w) => ({
        weekStart: w.weekStart,
        primaryKpi: rep.role === "setter" ? w.qualified_bookings : w.cash_collected,
      }))

    const enrichedReviews = callReviews.map((cr) => ({
      ...cr,
      reviewer_name: reviewerMap[cr.reviewed_by] ?? "Unknown",
    }))

    const enrichedNotes = notes.map((n) => ({
      ...n,
      author_name: authorMap[n.author_id] ?? "Unknown",
    }))

    return NextResponse.json({
      rep, performance, callReviews: enrichedReviews,
      deals, notes: enrichedNotes, weeklyData,
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

    // Fetch current rep data for change tracking
    const { data: currentRep } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single()

    if (!currentRep) {
      return NextResponse.json({ error: "Rep not found" }, { status: 404 })
    }

    const body = await request.json()

    const allowedFields: Record<string, unknown> = {}
    const updatableKeys = [
      "full_name", "email", "role", "commission_rate",
      "base_pay_weekly", "status", "termination_date", "hire_date",
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

    // Normalize commission_rate — handle whole numbers > 1
    if (allowedFields.commission_rate != null) {
      const rate = Number(allowedFields.commission_rate)
      allowedFields.commission_rate = rate > 1 ? rate / 100 : rate
    }

    // Status → termination_date logic
    if (allowedFields.status === "terminated" && !allowedFields.termination_date) {
      allowedFields.termination_date = new Date().toISOString().split("T")[0]
    }
    if (allowedFields.status && (allowedFields.status as UserStatus) === "active") {
      allowedFields.termination_date = null
    }

    // Track changes for audit log
    const changes: Record<string, { old: unknown; new: unknown }> = {}
    for (const [key, newVal] of Object.entries(allowedFields)) {
      const oldVal = (currentRep as Record<string, unknown>)[key]
      if (oldVal !== newVal) {
        changes[key] = { old: oldVal, new: newVal }
      }
    }

    // Detect role change
    const roleChanged = allowedFields.role && allowedFields.role !== currentRep.role

    // Update the user
    const { data, error } = await supabase
      .from("users")
      .update({ ...allowedFields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If role changed, create an automatic rep note
    if (roleChanged) {
      await supabase.from("rep_notes").insert({
        rep_id: id,
        author_id: user.id,
        note_type: "general",
        content: `Role changed from ${currentRep.role} to ${allowedFields.role}. Historical ${currentRep.role} data preserved. Rep starts fresh on ${allowedFields.role} metrics.`,
      })
    }

    // Audit log
    if (Object.keys(changes).length > 0) {
      const changedFields = Object.keys(changes).join(", ")
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: roleChanged ? "rep_role_changed" : "rep_updated",
        entity_type: "user",
        entity_id: id,
        changes,
        description: `Updated ${currentRep.full_name}: ${changedFields}`,
      })
    }

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
