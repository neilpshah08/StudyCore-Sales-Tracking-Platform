import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { AuditLogView } from "@/components/admin/audit-log-view"

export default async function AuditLogPage() {
  await requireAdmin()
  const supabase = await createClient()

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
        <h1 className="text-2xl font-bold text-white">Audit Log</h1>
        <p className="text-sm text-white/55">Track all changes made across the platform</p>
      </div>
      <AuditLogView entries={entries} />
    </div>
  )
}
