import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { RevenueForecast } from "@/components/admin/revenue-forecast"

export default async function ForecastPage() {
  await requireAdmin()
  const supabase = await createClient()

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyDaysStart = thirtyDaysAgo.toISOString().split("T")[0]

  const [revenueResult, activityResult, settingsResult] = await Promise.all([
    supabase.from("deals").select("cash_collected").eq("status", "active").gte("date_closed", monthStart).lte("date_closed", monthEnd),
    supabase.from("daily_activity").select("demos_scheduled, demos_completed, offers_made, deals_closed, cash_collected").gte("date", thirtyDaysStart),
    supabase.from("app_settings").select("key, value").in("key", ["monthly_revenue_target"]),
  ])

  const revenueSoFar = (revenueResult.data ?? []).reduce((s, d) => s + (d.cash_collected || 0), 0)

  const activities = activityResult.data ?? []
  const totalDemosScheduled = activities.reduce((s, a) => s + (a.demos_scheduled || 0), 0)
  const totalDemosCompleted = activities.reduce((s, a) => s + (a.demos_completed || 0), 0)
  const totalOffersMade = activities.reduce((s, a) => s + (a.offers_made || 0), 0)
  const totalDealsClosed = activities.reduce((s, a) => s + (a.deals_closed || 0), 0)
  const totalCash = activities.reduce((s, a) => s + (a.cash_collected || 0), 0)

  const showRate = totalDemosScheduled > 0 ? totalDemosCompleted / totalDemosScheduled : 0.7
  const closeRate = totalDemosCompleted > 0 ? totalDealsClosed / totalDemosCompleted : 0.3
  const avgDealSize = totalDealsClosed > 0 ? totalCash / totalDealsClosed : 5000

  const today = new Date()
  const weekStart = new Date(today)
  const day = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1))
  const ws = weekStart.toISOString().split("T")[0]

  const { data: currentWeekActivity } = await supabase
    .from("daily_activity")
    .select("demos_scheduled, demos_completed")
    .gte("date", ws)

  const currentWeekScheduled = (currentWeekActivity ?? []).reduce((s, a) => s + (a.demos_scheduled || 0), 0)
  const currentWeekCompleted = (currentWeekActivity ?? []).reduce((s, a) => s + (a.demos_completed || 0), 0)
  const demosInPipeline = Math.max(0, currentWeekScheduled - currentWeekCompleted)

  const monthlyTarget = (settingsResult.data ?? []).find((s) => s.key === "monthly_revenue_target")?.value ?? 150000
  const targetValue = typeof monthlyTarget === "number" ? monthlyTarget : Number(monthlyTarget) || 150000

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Revenue Forecast</h1>
        <p className="text-sm text-white/55">Forward-looking revenue projection</p>
      </div>
      <RevenueForecast
        pipeline={{ demosInPipeline, offersInPipeline: 0 }}
        historicalRates={{ showRate, closeRate, avgDealSize }}
        revenueSoFar={revenueSoFar}
        monthlyTarget={targetValue}
      />
    </div>
  )
}
