import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { FulfillmentDashboard } from "@/components/admin/fulfillment-dashboard"

export default async function FulfillmentPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || profile.role !== "admin") redirect("/dashboard")

  const { data: deals } = await supabase
    .from("deals")
    .select("id, student_name, date_closed, deal_value, status")
    .eq("status", "active")
    .order("date_closed", { ascending: false })

  const dealIds = (deals ?? []).map((d) => d.id)
  let fulfillmentMap: Record<string, Record<string, unknown>> = {}

  if (dealIds.length > 0) {
    const { data: fulfillments } = await supabase
      .from("deal_fulfillment")
      .select("*")
      .in("deal_id", dealIds)

    if (fulfillments) {
      fulfillmentMap = Object.fromEntries(fulfillments.map((f) => [f.deal_id, f]))
    }
  }

  const today = new Date()
  const records = (deals ?? []).map((d) => {
    const f = fulfillmentMap[d.id] as Record<string, unknown> | undefined
    const daysSinceClose = Math.floor((today.getTime() - new Date(d.date_closed).getTime()) / (1000 * 60 * 60 * 24))
    return {
      deal_id: d.id,
      student_name: d.student_name,
      date_closed: d.date_closed,
      days_since_close: daysSinceClose,
      first_session_scheduled: (f?.first_session_scheduled as boolean) || false,
      first_session_date: (f?.first_session_date as string) || null,
      tutor_assigned: (f?.tutor_assigned as string) || null,
      sessions_completed: (f?.sessions_completed as number) || 0,
      total_sessions_purchased: (f?.total_sessions_purchased as number) || null,
      status: (f?.status as string) || "pending_onboarding",
      fulfillment_id: (f?.id as string) || null,
    }
  })

  const totalActive = records.length
  const withFirstSession = records.filter((r) => r.first_session_date)
  const avgDaysToFirst = withFirstSession.length > 0
    ? withFirstSession.reduce((s, r) => {
        const days = Math.floor((new Date(r.first_session_date!).getTime() - new Date(r.date_closed).getTime()) / (1000 * 60 * 60 * 24))
        return s + days
      }, 0) / withFirstSession.length
    : 0
  const onboardingDelay = records.filter((r) => r.days_since_close > 3 && !r.first_session_scheduled).length
  const atRisk = records.filter((r) => r.days_since_close > 7 && r.status === "pending_onboarding").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Fulfillment Tracker</h1>
        <p className="text-sm text-muted-foreground">Monitor delivery and identify at-risk students</p>
      </div>
      <FulfillmentDashboard
        summary={{ totalActiveStudents: totalActive, avgDaysToFirstSession: Math.round(avgDaysToFirst * 10) / 10, onboardingDelayCount: onboardingDelay, atRiskCount: atRisk }}
        records={records}
      />
    </div>
  )
}
