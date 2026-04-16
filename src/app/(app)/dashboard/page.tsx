import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  formatDate,
  getWeekStart,
  getMonthStart,
  getMonthEnd,
  calculateStreak,
} from "@/lib/utils"
import { DEFAULT_BENCHMARKS } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { StreakDisplay } from "@/components/dashboard/streak-display"
import { GoalSetter } from "@/components/dashboard/goal-setter"
import { DailyActivityForm } from "@/components/dashboard/daily-activity-form"
import { Scorecard } from "@/components/dashboard/scorecard"
import { Leaderboard } from "@/components/dashboard/leaderboard"
import { ActivityHistory } from "@/components/dashboard/activity-history"
import type { AggregatedMetrics } from "@/components/dashboard/scorecard"
import type { LeaderboardEntry } from "@/components/dashboard/leaderboard"
import type { DailyActivity, RepGoal, User } from "@/types/database"
import { Suspense } from "react"

function aggregateActivities(activities: DailyActivity[]): AggregatedMetrics {
  return activities.reduce<AggregatedMetrics>(
    (acc, a) => ({
      dials_made: acc.dials_made + (a.dials_made ?? 0),
      conversations: acc.conversations + (a.conversations ?? 0),
      qualified_bookings: acc.qualified_bookings + (a.qualified_bookings ?? 0),
      follow_ups_completed: acc.follow_ups_completed + (a.follow_ups_completed ?? 0),
      show_confirmations_sent:
        acc.show_confirmations_sent + (a.show_confirmations_sent ?? 0),
      intros_completed: acc.intros_completed + (a.intros_completed ?? 0),
      demos_booked_from_intros:
        acc.demos_booked_from_intros + (a.demos_booked_from_intros ?? 0),
      demos_scheduled: acc.demos_scheduled + (a.demos_scheduled ?? 0),
      demos_completed: acc.demos_completed + (a.demos_completed ?? 0),
      offers_made: acc.offers_made + (a.offers_made ?? 0),
      deals_closed: acc.deals_closed + (a.deals_closed ?? 0),
      cash_collected: acc.cash_collected + (a.cash_collected ?? 0),
      pif_deals: acc.pif_deals + (a.pif_deals ?? 0),
      payment_plan_deals: acc.payment_plan_deals + (a.payment_plan_deals ?? 0),
    }),
    {
      dials_made: 0,
      conversations: 0,
      qualified_bookings: 0,
      follow_ups_completed: 0,
      show_confirmations_sent: 0,
      intros_completed: 0,
      demos_booked_from_intros: 0,
      demos_scheduled: 0,
      demos_completed: 0,
      offers_made: 0,
      deals_closed: 0,
      cash_collected: 0,
      pif_deals: 0,
      payment_plan_deals: 0,
    }
  )
}

function buildLeaderboardEntries(
  users: User[],
  activitiesMap: Map<string, DailyActivity[]>
): LeaderboardEntry[] {
  return users.map((u) => {
    const userActivities = activitiesMap.get(u.id) || []
    const agg = aggregateActivities(userActivities)

    return {
      user_id: u.id,
      full_name: u.full_name,
      role: u.role,
      total_bookings: agg.qualified_bookings,
      total_cash_collected: agg.cash_collected,
      contact_rate: agg.dials_made > 0 ? agg.conversations / agg.dials_made : 0,
      close_rate: agg.demos_completed > 0 ? agg.deals_closed / agg.demos_completed : 0,
    }
  })
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  // Authenticate user
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) redirect("/login")

  // Fetch user profile
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single()

  if (!profile) redirect("/login")

  // Only setters and closers should see this dashboard
  if (profile.role === "admin") {
    redirect("/admin")
  }

  const role = profile.role as "setter" | "closer"
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const weekStart = getWeekStart(today)
  const monthStart = getMonthStart(today)
  const monthEnd = getMonthEnd(today)

  // Calculate 90 days ago for streak
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0]

  // Thirty days ago for history
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

  // Fetch all data in parallel
  const [
    todayActivityResult,
    weekActivitiesResult,
    monthActivitiesResult,
    streakActivitiesResult,
    historyActivitiesResult,
    goalsResult,
    teamUsersResult,
    teamActivitiesResult,
  ] = await Promise.all([
    // Today's activity
    supabase
      .from("daily_activities")
      .select("*")
      .eq("user_id", authUser.id)
      .eq("date", todayStr)
      .maybeSingle(),

    // This week's activities
    supabase
      .from("daily_activities")
      .select("*")
      .eq("user_id", authUser.id)
      .gte("date", weekStart)
      .lte("date", todayStr)
      .order("date", { ascending: true }),

    // This month's activities
    supabase
      .from("daily_activities")
      .select("*")
      .eq("user_id", authUser.id)
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .order("date", { ascending: true }),

    // Streak data (last 90 days)
    supabase
      .from("daily_activities")
      .select("date")
      .eq("user_id", authUser.id)
      .gte("date", ninetyDaysAgoStr)
      .lte("date", todayStr)
      .order("date", { ascending: false }),

    // History data (last 30 entries)
    supabase
      .from("daily_activities")
      .select("*")
      .eq("user_id", authUser.id)
      .gte("date", thirtyDaysAgoStr)
      .order("date", { ascending: false })
      .limit(30),

    // Goals for current week
    supabase
      .from("rep_goals")
      .select("*")
      .eq("user_id", authUser.id)
      .eq("week_start", weekStart),

    // Team users (same role, active)
    supabase
      .from("users")
      .select("*")
      .eq("role", role)
      .eq("status", "active"),

    // Team activities this week for leaderboard
    supabase
      .from("daily_activities")
      .select("*")
      .gte("date", weekStart)
      .lte("date", todayStr),
  ])

  const todayActivity = (todayActivityResult.data as DailyActivity | null) ?? null
  const weekActivities = (weekActivitiesResult.data as DailyActivity[] | null) ?? []
  const monthActivities = (monthActivitiesResult.data as DailyActivity[] | null) ?? []
  const streakDates = (streakActivitiesResult.data as { date: string }[] | null) ?? []
  const historyActivities = (historyActivitiesResult.data as DailyActivity[] | null) ?? []
  const goals = (goalsResult.data as RepGoal[] | null) ?? []
  const teamUsers = (teamUsersResult.data as User[] | null) ?? []
  const teamActivities = (teamActivitiesResult.data as DailyActivity[] | null) ?? []

  // Calculate streak
  const streakDateSet = new Set(streakDates.map((d) => d.date))
  const streakInput: { date: string; hasActivity: boolean }[] = []
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split("T")[0]
    streakInput.push({ date: dateStr, hasActivity: streakDateSet.has(dateStr) })
  }
  const { current: currentStreak, longest: longestStreak } = calculateStreak(streakInput)

  // Aggregate metrics
  const weekData = aggregateActivities(weekActivities)
  const monthData = aggregateActivities(monthActivities)

  // Build leaderboard
  const teamActivitiesMap = new Map<string, DailyActivity[]>()
  for (const activity of teamActivities) {
    const existing = teamActivitiesMap.get(activity.user_id) || []
    existing.push(activity)
    teamActivitiesMap.set(activity.user_id, existing)
  }

  const leaderboardData = buildLeaderboardEntries(
    teamUsers.filter((u) => u.role === role),
    teamActivitiesMap
  )

  const benchmarks = DEFAULT_BENCHMARKS

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <div className="space-y-6">
        {/* 1. Welcome header with streak */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">
                Welcome back, {profile.full_name}
              </h1>
              <Badge variant={role === "setter" ? "default" : "secondary"}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
          </div>
          <StreakDisplay
            currentStreak={currentStreak}
            longestStreak={longestStreak}
          />
        </div>

        {/* 2. Goal Setter (compact) */}
        <GoalSetter
          userId={authUser.id}
          role={role}
          weekStart={weekStart}
          existingGoals={goals}
        />

        {/* 3. Daily Activity Logger (most prominent) */}
        <DailyActivityForm
          userId={authUser.id}
          role={role}
          existingData={todayActivity}
          date={todayStr}
        />

        {/* 4. My Scorecard + 5. Team Leaderboard - side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Scorecard
            role={role}
            weekData={weekData}
            monthData={monthData}
            benchmarks={benchmarks}
            goals={goals}
          />
          <Leaderboard
            role={role}
            currentUserId={authUser.id}
            data={leaderboardData}
            anonymous={false}
          />
        </div>

        {/* 6. My History */}
        <ActivityHistory activities={historyActivities} role={role} />
      </div>
    </Suspense>
  )
}
