import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { LostDealsAnalysis } from "@/components/admin/lost-deals-analysis"

export default async function LostDealsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const startDate = ninetyDaysAgo.toISOString().split("T")[0]

  const { data: lostDeals } = await supabase
    .from("deals")
    .select("*, closer:users!deals_closer_id_fkey(full_name), setter:users!deals_setter_id_fkey(full_name)")
    .in("status", ["refunded", "chargedback"])
    .gte("date_closed", startDate)
    .order("date_closed", { ascending: false })

  const { data: allDeals } = await supabase
    .from("deals")
    .select("id, status, date_closed")
    .gte("date_closed", startDate)

  const deals = (lostDeals ?? []).map((d) => ({
    id: d.id,
    date_closed: d.date_closed,
    student_name: d.student_name,
    deal_value: d.deal_value,
    lost_reason: d.lost_reason || d.status,
    notes: d.notes,
    closer_name: d.closer && typeof d.closer === "object" && "full_name" in d.closer ? (d.closer as { full_name: string }).full_name : "Unknown",
    closer_id: d.closer_id,
    status: d.status,
  }))

  const totalDeals = allDeals?.length || 0
  const totalLost = deals.length
  const totalLostRevenue = deals.reduce((s, d) => s + d.deal_value, 0)

  const reasonCounts: Record<string, number> = {}
  deals.forEach((d) => {
    const reason = d.lost_reason || "Unknown"
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
  })

  const mostCommonReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A"

  const reasonDistribution = Object.entries(reasonCounts).map(([name, value]) => ({
    name,
    value,
    percentage: totalLost > 0 ? Math.round((value / totalLost) * 100) : 0,
  }))

  const closerBreakdown: Record<string, Record<string, number>> = {}
  deals.forEach((d) => {
    if (!closerBreakdown[d.closer_name]) closerBreakdown[d.closer_name] = {}
    const reason = d.lost_reason || "Unknown"
    closerBreakdown[d.closer_name][reason] = (closerBreakdown[d.closer_name][reason] || 0) + 1
  })

  const closerData = Object.entries(closerBreakdown).map(([name, reasons]) => ({
    name,
    ...reasons,
  }))

  const weeklyTrend: { week: string; count: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const ws = weekStart.toISOString().split("T")[0]
    const we = weekEnd.toISOString().split("T")[0]
    const count = deals.filter((d) => d.date_closed >= ws && d.date_closed < we).length
    weeklyTrend.push({ week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }), count })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Lost Deal Analysis</h1>
        <p className="text-sm text-muted-foreground">Understand why deals are lost and identify patterns</p>
      </div>
      <LostDealsAnalysis
        summary={{ totalLost, totalLostRevenue, mostCommonReason, lostRate: totalDeals > 0 ? totalLost / totalDeals : 0 }}
        reasonDistribution={reasonDistribution}
        closerData={closerData}
        weeklyTrend={weeklyTrend}
        deals={deals}
        allReasons={Object.keys(reasonCounts)}
      />
    </div>
  )
}
