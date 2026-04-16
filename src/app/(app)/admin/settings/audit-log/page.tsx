import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AuditLogView } from "@/components/admin/audit-log-view"

export default async function AuditLogPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
  if (!profile || profile.role !== "admin") redirect("/dashboard")

  const { data: logs } = await supabase
    .from("audit_log")
    .select("*, actor:users!audit_log_user_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(500)

  const entries = (logs ?? []).map((l) => ({
    id: l.id,
    timestamp: l.created_at,
    admin_name: l.actor && typeof l.actor === "object" && "full_name" in l.actor ? (l.actor as { full_name: string }).full_name : "System",
    action: l.action,
    entity_type: l.entity_type,
    entity_id: l.entity_id,
    description: l.description || "",
    changes: l.changes,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Track all changes made across the platform</p>
      </div>
      <AuditLogView entries={entries} />
    </div>
  )
}
