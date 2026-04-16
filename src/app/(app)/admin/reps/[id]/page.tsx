import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { RepDetail } from "@/components/admin/rep-detail"
import type { User, CallReview, Deal, RepNote } from "@/types/database"

export interface EnrichedCallReview extends CallReview {
  reviewer_name: string
}

export interface EnrichedRepNote extends RepNote {
  author_name: string
}

export interface WeeklyBreakdown {
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

export interface WeeklyPerformance {
  weekStart: string
  primaryKpi: number
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminRepDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  // Verify admin role
  const { data: adminProfile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!adminProfile || adminProfile.role !== "admin") redirect("/dashboard")

  // Fetch all data in parallel
  const [repResult, activitiesResult, callReviewsResult, dealsResult, notesResult] =
    await Promise.all([
      supabase.from("users").select("*").eq("id", id).single(),
      (() => {
        const twelveWeeksAgo = new Date()
        twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
        return supabase
          .from("daily_activities")
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

  if (repResult.error || !repResult.data) notFound()

  const rep: User = repResult.data
  const activities = activitiesResult.data ?? []
  const callReviews = callReviewsResult.data ?? []
  const deals: Deal[] = dealsResult.data ?? []
  const notes = notesResult.data ?? []

  // Fetch reviewer names
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
  const weeklyMap = new Map<string, WeeklyBreakdown>()

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

  // Build performance array for chart
  const performance: WeeklyPerformance[] = Array.from(weeklyMap.values())
    .sort(
      (a, b) =>
        new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
    )
    .map((w) => ({
      weekStart: w.weekStart,
      primaryKpi:
        rep.role === "setter" ? w.qualified_bookings : w.cash_collected,
    }))

  // Enrich call reviews with reviewer names
  const enrichedReviews: EnrichedCallReview[] = callReviews.map((cr) => ({
    ...cr,
    reviewer_name: reviewerMap[cr.reviewed_by] ?? "Unknown",
  }))

  // Enrich notes with author names
  const enrichedNotes: EnrichedRepNote[] = notes.map((n) => ({
    ...n,
    author_name: authorMap[n.author_id] ?? "Unknown",
  }))

  return (
    <div className="space-y-6">
      <RepDetail
        rep={rep}
        performance={performance}
        callReviews={enrichedReviews}
        deals={deals}
        notes={enrichedNotes}
        weeklyData={weeklyData}
      />
    </div>
  )
}
