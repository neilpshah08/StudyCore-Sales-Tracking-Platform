import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SettingsPage } from "@/components/admin/settings-page"

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || profile.role !== "admin") redirect("/dashboard")

  const [settingsResult, ratesResult] = await Promise.all([
    supabase.from("app_settings").select("*"),
    supabase.from("commission_rates").select("*").order("effective_date", { ascending: false }),
  ])

  const settings: Record<string, unknown> = {}
  for (const s of settingsResult.data ?? []) {
    settings[s.key] = s.value
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure application settings and benchmarks</p>
      </div>
      <SettingsPage settings={settings} commissionRates={ratesResult.data ?? []} />
    </div>
  )
}
