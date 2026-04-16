import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { RepList } from "@/components/admin/rep-list"
import type { User } from "@/types/database"

export interface RepWithBadges extends User {
  hasPipWarning: boolean
  currentWeekKpi: number
}

export default async function AdminRepsPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch all users (active and inactive, setters and closers)
  const { data: reps } = await supabase
    .from("users")
    .select("*")
    .in("role", ["setter", "closer"])
    .order("full_name", { ascending: true })

  // Fetch recent rep_notes (last 30 days) for PIP/Warning badges
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

  const { data: recentNotes } = await supabase
    .from("rep_notes")
    .select("rep_id, note_type")
    .in("note_type", ["pip", "verbal_warning"])
    .gte("created_at", thirtyDaysAgoStr)

  const repIdsWithWarnings = new Set(
    (recentNotes ?? []).map((n) => n.rep_id)
  )

  // Fetch current week performance
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
      const rep = (reps ?? []).find((r) => r.id === a.user_id)
      if (rep?.role === "setter") {
        perfMap.set(a.user_id, existing + (a.qualified_bookings ?? 0))
      } else {
        perfMap.set(a.user_id, existing + (a.cash_collected ?? 0))
      }
    }
  }

  const repsWithBadges: RepWithBadges[] = (reps ?? []).map((rep) => ({
    ...rep,
    hasPipWarning: repIdsWithWarnings.has(rep.id),
    currentWeekKpi: perfMap.get(rep.id) ?? 0,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rep Management</h1>
        <p className="text-muted-foreground">
          Manage your sales team members, view performance, and track status.
        </p>
      </div>
      <RepList reps={repsWithBadges} />
    </div>
  )
}
