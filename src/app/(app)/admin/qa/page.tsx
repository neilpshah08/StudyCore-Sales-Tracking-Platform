import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { QADashboard } from "@/components/admin/qa-dashboard"

export interface ReviewWithNames {
  id: string
  reviewed_by: string
  rep_id: string
  call_type: "setter" | "closer"
  date: string
  prospect_name: string | null
  recording_link: string | null
  opening_rapport: number | null
  discovery: number | null
  budget_qualification: number | null
  transition_pitch: number | null
  booking_logistics: number | null
  professionalism: number | null
  rapport_framing: number | null
  deep_discovery: number | null
  pitch_presentation: number | null
  objection_handling: number | null
  close_execution: number | null
  closer_professionalism: number | null
  auto_fail_1: boolean
  auto_fail_2: boolean
  auto_fail_3: boolean
  auto_fail_4: boolean
  weighted_score: number | null
  coaching_notes: string | null
  created_at: string
  rep_name: string | null
  rep_role: string | null
  reviewer_name: string | null
}

export default async function AdminQAPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch all call reviews with rep and reviewer names
  const { data: rawReviews } = await supabase
    .from("call_reviews")
    .select(
      `
      *,
      rep:users!call_reviews_rep_id_fkey(full_name, role),
      reviewer:users!call_reviews_reviewed_by_fkey(full_name)
    `
    )
    .order("date", { ascending: false })

  const reviews: ReviewWithNames[] = (rawReviews ?? []).map((r) => ({
    ...r,
    rep_name:
      r.rep && typeof r.rep === "object" && "full_name" in r.rep
        ? (r.rep as { full_name: string }).full_name
        : null,
    rep_role:
      r.rep && typeof r.rep === "object" && "role" in r.rep
        ? (r.rep as { role: string }).role
        : null,
    reviewer_name:
      r.reviewer &&
      typeof r.reviewer === "object" &&
      "full_name" in r.reviewer
        ? (r.reviewer as { full_name: string }).full_name
        : null,
    rep: undefined,
    reviewer: undefined,
  }))

  // Fetch active reps for the scoring form
  const { data: repsData } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("role", ["setter", "closer"])
    .eq("status", "active")
    .order("full_name", { ascending: true })

  const reps = (repsData ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    role: r.role,
  }))

  // Compute per-rep average QA scores
  const repScoreMap = new Map<
    string,
    { totalScore: number; count: number; repName: string }
  >()
  for (const review of reviews) {
    if (review.weighted_score !== null && review.rep_name) {
      const key = review.rep_id
      const existing = repScoreMap.get(key)
      if (existing) {
        existing.totalScore += review.weighted_score
        existing.count += 1
      } else {
        repScoreMap.set(key, {
          totalScore: review.weighted_score,
          count: 1,
          repName: review.rep_name,
        })
      }
    }
  }

  const repAverages = Array.from(repScoreMap.values())
    .map((entry) => ({
      repName: entry.repName,
      avgScore: Math.round((entry.totalScore / entry.count) * 100) / 100,
      reviewCount: entry.count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Call QA Reviews</h1>
        <p className="text-sm text-muted-foreground">
          Score calls, track quality metrics, and coach your team
        </p>
      </div>
      <QADashboard
        reviews={reviews}
        reps={reps}
        repAverages={repAverages}
      />
    </div>
  )
}
