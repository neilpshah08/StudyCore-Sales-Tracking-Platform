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

  // Fetch reviews and users in parallel
  const [reviewsResult, usersResult] = await Promise.all([
    supabase
      .from("call_reviews")
      .select("*")
      .order("date", { ascending: false }),
    supabase
      .from("users")
      .select("id, full_name, role")
      .in("role", ["admin", "setter", "closer"]),
  ])

  const userMap = new Map<string, { full_name: string; role: string }>()
  for (const u of usersResult.data ?? []) {
    userMap.set(u.id, { full_name: u.full_name, role: u.role })
  }

  const reviews: ReviewWithNames[] = (reviewsResult.data ?? []).map((r) => ({
    ...r,
    rep_name: userMap.get(r.rep_id)?.full_name ?? null,
    rep_role: userMap.get(r.rep_id)?.role ?? null,
    reviewer_name: userMap.get(r.reviewed_by)?.full_name ?? null,
  }))

  // Active reps for the scoring form
  const reps = (usersResult.data ?? [])
    .filter((u) => u.role === "setter" || u.role === "closer")
    .map((r) => ({ id: r.id, full_name: r.full_name, role: r.role }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))

  // Per-rep average QA scores
  const repScoreMap = new Map<string, { totalScore: number; count: number; repName: string }>()
  for (const review of reviews) {
    if (review.weighted_score !== null && review.rep_name) {
      const existing = repScoreMap.get(review.rep_id)
      if (existing) {
        existing.totalScore += review.weighted_score
        existing.count += 1
      } else {
        repScoreMap.set(review.rep_id, {
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
        <h1 className="text-2xl font-bold text-white">Call QA Reviews</h1>
        <p className="text-sm text-white/55">
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
