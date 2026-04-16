import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { UserRole, UserStatus } from "@/types/database"

export async function GET(request: NextRequest) {
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
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get("role") as UserRole | null
    const statusFilter = searchParams.get("status") as UserStatus | null

    // Fetch reps
    let query = supabase
      .from("users")
      .select("*")
      .in("role", ["setter", "closer"])
      .order("full_name", { ascending: true })

    if (roleFilter && roleFilter !== ("all" as string)) {
      query = query.eq("role", roleFilter)
    }

    if (statusFilter && statusFilter !== ("all" as string)) {
      query = query.eq("status", statusFilter)
    }

    const { data: reps, error: repsError } = await query

    if (repsError) {
      return NextResponse.json({ error: repsError.message }, { status: 500 })
    }

    // Fetch recent rep_notes (last 30 days) for PIP/Warning badges
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

    const { data: recentNotes, error: notesError } = await supabase
      .from("rep_notes")
      .select("rep_id, note_type")
      .in("note_type", ["pip", "verbal_warning"])
      .gte("created_at", thirtyDaysAgoStr)

    if (notesError) {
      return NextResponse.json({ error: notesError.message }, { status: 500 })
    }

    // Build a set of rep IDs with warnings
    const repIdsWithWarnings = new Set(
      (recentNotes ?? []).map((n) => n.rep_id)
    )

    // Fetch current week performance data for each rep
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const weekStart = new Date(now)
    weekStart.setDate(diff)
    const weekStartStr = weekStart.toISOString().split("T")[0]
    const todayStr = now.toISOString().split("T")[0]

    const { data: weekActivities } = await supabase
      .from("daily_activities")
      .select("user_id, qualified_bookings, cash_collected")
      .gte("date", weekStartStr)
      .lte("date", todayStr)

    // Aggregate performance by user
    const perfMap = new Map<string, number>()
    if (weekActivities) {
      for (const a of weekActivities) {
        const existing = perfMap.get(a.user_id) ?? 0
        // We'll send the raw number; the client decides which KPI to show based on role
        const rep = reps?.find((r) => r.id === a.user_id)
        if (rep?.role === "setter") {
          perfMap.set(a.user_id, existing + (a.qualified_bookings ?? 0))
        } else {
          perfMap.set(a.user_id, existing + (a.cash_collected ?? 0))
        }
      }
    }

    // Combine into response
    const repsWithBadges = (reps ?? []).map((rep) => ({
      ...rep,
      hasPipWarning: repIdsWithWarnings.has(rep.id),
      currentWeekKpi: perfMap.get(rep.id) ?? 0,
    }))

    return NextResponse.json({ data: repsWithBadges })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
