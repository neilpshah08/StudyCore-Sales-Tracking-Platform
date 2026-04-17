import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAuth } from "@/lib/auth"
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
import { TallyDashboard } from "@/components/dashboard/tally-dashboard"
import { Scorecard } from "@/components/dashboard/scorecard"
import { Leaderboard } from "@/components/dashboard/leaderboard"
import { ActivityHistory } from "@/components/dashboard/activity-history"
import { LogDealDialog } from "@/components/dashboard/log-deal-dialog"
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
      dials_made: 0, conversations: 0, qualified_bookings: 0,
      follow_ups_completed: 0, show_confirmations_sent: 0,
      intros_completed: 0, demos_booked_from_intros: 0,
      demos_scheduled: 0, demos_completed: 0, offers_made: 0,
      deals_closed: 0, cash_collected: 0, pif_deals: 0, payment_plan_deals: 0,
    }
  )
}

// Compute deal stats from the deals table for a closer
interface DealStats {
  deals_closed: number
  cash_collected: number
  pif_deals: number
  payment_plan_deals: number
}

function computeDealStats(deals: { deal_value: number; cash_collected: number; payment_plan: string; status: string }[]): DealStats {
  const active = deals.filter((d) => d.status === "active")
  return {
    deals_closed: active.length,
    cash_collected: active.reduce((s, d) => s + (d.cash_collected || 0), 0),
    pif_deals: active.filter((d) => d.payment_plan === "PIF").length,
    payment_plan_deals: active.filter((d) => d.payment_plan !== "PIF").length,
  }
}

function buildLeaderboardEntries(
  users: User[],
  activitiesMap: Map<string, DailyActivity[]>,
  dealStatsMap: Map<string, DealStats>
): LeaderboardEntry[] {
  return users.map((u) => {
    const userActivities = activitiesMap.get(u.id) || []
    const agg = aggregateActivities(userActivities)
    const ds = dealStatsMap.get(u.id)

    // For closers, override deal metrics from the deals table
    const dealsClosed = u.role === "closer" && ds ? ds.deals_closed : agg.deals_closed
    const cashCollected = u.role === "closer" && ds ? ds.cash_collected : agg.cash_collected

    return {
      user_id: u.id,
      full_name: u.full_name,
      role: u.role,
      total_bookings: agg.qualified_bookings,
      total_cash_collected: cashCollected,
      contact_rate: agg.dials_made > 0 ? agg.conversations / agg.dials_made : 0,
      close_rate: agg.demos_completed > 0 ? dealsClosed / agg.demos_completed : 0,
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
  const { profile } = await requireAuth()

  if (profile.role === "admin") redirect("/admin")

  const role = profile.role as "setter" | "closer"
  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const weekStart = getWeekStart(today)
  const monthStart = getMonthStart(today)
  const monthEnd = getMonthEnd(today)

  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split("T")[0]

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
    // Deal queries for closers
    todayDealsResult,
    weekDealsResult,
    monthDealsResult,
    teamWeekDealsResult,
  ] = await Promise.all([
    supabase.from("daily_activity").select("*").eq("user_id", profile.id).eq("date", todayStr).maybeSingle(),
    supabase.from("daily_activity").select("*").eq("user_id", profile.id).gte("date", weekStart).lte("date", todayStr).order("date", { ascending: true }),
    supabase.from("daily_activity").select("*").eq("user_id", profile.id).gte("date", monthStart).lte("date", monthEnd).order("date", { ascending: true }),
    supabase.from("daily_activity").select("date").eq("user_id", profile.id).gte("date", ninetyDaysAgoStr).lte("date", todayStr).order("date", { ascending: false }),
    supabase.from("daily_activity").select("*").eq("user_id", profile.id).gte("date", thirtyDaysAgoStr).order("date", { ascending: false }).limit(30),
    supabase.from("rep_goals").select("*").eq("user_id", profile.id).eq("week_start", weekStart),
    supabase.from("users").select("*").eq("role", role).eq("status", "active"),
    supabase.from("daily_activity").select("*").gte("date", weekStart).lte("date", todayStr),
    // Today's deals for this closer
    role === "closer"
      ? supabase.from("deals").select("deal_value, cash_collected, payment_plan, status").eq("closer_id", profile.id).eq("date_closed", todayStr)
      : Promise.resolve({ data: null }),
    // This week's deals for this closer
    role === "closer"
      ? supabase.from("deals").select("deal_value, cash_collected, payment_plan, status").eq("closer_id", profile.id).gte("date_closed", weekStart).lte("date_closed", todayStr)
      : Promise.resolve({ data: null }),
    // This month's deals for this closer
    role === "closer"
      ? supabase.from("deals").select("deal_value, cash_collected, payment_plan, status").eq("closer_id", profile.id).gte("date_closed", monthStart).lte("date_closed", monthEnd)
      : Promise.resolve({ data: null }),
    // All closer deals this week for leaderboard
    role === "closer"
      ? supabase.from("deals").select("closer_id, deal_value, cash_collected, payment_plan, status").gte("date_closed", weekStart).lte("date_closed", todayStr)
      : Promise.resolve({ data: null }),
  ])

  const todayActivity = (todayActivityResult.data as DailyActivity | null) ?? null
  const weekActivities = (weekActivitiesResult.data as DailyActivity[] | null) ?? []
  const monthActivities = (monthActivitiesResult.data as DailyActivity[] | null) ?? []
  const streakDates = (streakActivitiesResult.data as { date: string }[] | null) ?? []
  const historyActivities = (historyActivitiesResult.data as DailyActivity[] | null) ?? []
  const goals = (goalsResult.data as RepGoal[] | null) ?? []
  const teamUsers = (teamUsersResult.data as User[] | null) ?? []
  const teamActivities = (teamActivitiesResult.data as DailyActivity[] | null) ?? []

  // Deal stats for closers
  type DealRow = { deal_value: number; cash_collected: number; payment_plan: string; status: string; closer_id?: string }
  const todayDeals = ((todayDealsResult as { data: DealRow[] | null }).data ?? []) as DealRow[]
  const weekDeals = ((weekDealsResult as { data: DealRow[] | null }).data ?? []) as DealRow[]
  const monthDeals = ((monthDealsResult as { data: DealRow[] | null }).data ?? []) as DealRow[]
  const teamWeekDeals = ((teamWeekDealsResult as { data: DealRow[] | null }).data ?? []) as DealRow[]

  const todayDealStats = role === "closer" ? computeDealStats(todayDeals) : undefined
  const weekDealStats = role === "closer" ? computeDealStats(weekDeals) : undefined
  const monthDealStats = role === "closer" ? computeDealStats(monthDeals) : undefined

  // Streak
  const streakDateSet = new Set(streakDates.map((d) => d.date))
  const streakInput: { date: string; hasActivity: boolean }[] = []
  for (let i = 0; i < 90; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split("T")[0]
    streakInput.push({ date: dateStr, hasActivity: streakDateSet.has(dateStr) })
  }
  const { current: currentStreak, longest: longestStreak } = calculateStreak(streakInput)

  // Aggregate metrics — for closers, overlay deal stats from the deals table
  const weekData = aggregateActivities(weekActivities)
  const monthData = aggregateActivities(monthActivities)

  if (role === "closer" && weekDealStats) {
    weekData.deals_closed = weekDealStats.deals_closed
    weekData.cash_collected = weekDealStats.cash_collected
    weekData.pif_deals = weekDealStats.pif_deals
    weekData.payment_plan_deals = weekDealStats.payment_plan_deals
  }
  if (role === "closer" && monthDealStats) {
    monthData.deals_closed = monthDealStats.deals_closed
    monthData.cash_collected = monthDealStats.cash_collected
    monthData.pif_deals = monthDealStats.pif_deals
    monthData.payment_plan_deals = monthDealStats.payment_plan_deals
  }

  // Build leaderboard — for closer leaderboard, use deal stats from deals table
  const teamActivitiesMap = new Map<string, DailyActivity[]>()
  for (const activity of teamActivities) {
    const existing = teamActivitiesMap.get(activity.user_id) || []
    existing.push(activity)
    teamActivitiesMap.set(activity.user_id, existing)
  }

  const teamDealStatsMap = new Map<string, DealStats>()
  if (role === "closer") {
    const closerDealsMap = new Map<string, DealRow[]>()
    for (const deal of teamWeekDeals) {
      if (deal.closer_id) {
        const existing = closerDealsMap.get(deal.closer_id) || []
        existing.push(deal)
        closerDealsMap.set(deal.closer_id, existing)
      }
    }
    for (const [closerId, deals] of closerDealsMap) {
      teamDealStatsMap.set(closerId, computeDealStats(deals))
    }
  }

  const leaderboardData = buildLeaderboardEntries(
    teamUsers.filter((u) => u.role === role),
    teamActivitiesMap,
    teamDealStatsMap
  )

  const benchmarks = DEFAULT_BENCHMARKS

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <div className="space-y-6">
        {/* 1. Welcome header with streak + Log Deal button for closers */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-display text-2xl font-bold text-white tracking-tight">
                Welcome back, <span className="bg-gradient-to-r from-[#60A5FA] to-[#A78BFA] bg-clip-text text-transparent">{profile.full_name}</span>
              </h1>
              <Badge variant={role === "setter" ? "default" : "success"}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </Badge>
            </div>
            <p className="text-sm text-white/55">{formatDate(today)}</p>
          </div>
          <div className="flex items-center gap-3">
            {role === "closer" && <LogDealDialog closerId={profile.id} />}
            <StreakDisplay
              currentStreak={currentStreak}
              longestStreak={longestStreak}
            />
          </div>
        </div>

        {/* 2. Goal Setter */}
        <GoalSetter
          userId={profile.id}
          role={role}
          weekStart={weekStart}
          existingGoals={goals}
        />

        {/* 3. Live Tally Dashboard */}
        <TallyDashboard
          userId={profile.id}
          role={role}
          existingData={todayActivity}
          date={todayStr}
          dealStats={todayDealStats}
          weekData={weekData}
          benchmarks={benchmarks}
        />

        {/* 4. Full Scorecard (week/month tabs) + Leaderboard */}
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
            currentUserId={profile.id}
            data={leaderboardData}
            anonymous={false}
          />
        </div>

        {/* 5. History */}
        <ActivityHistory activities={historyActivities} role={role} />
      </div>
    </Suspense>
  )
}
