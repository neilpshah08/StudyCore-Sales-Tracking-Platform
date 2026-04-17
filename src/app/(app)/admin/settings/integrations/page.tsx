import { requireAdmin } from "@/lib/auth"
import { GhlIntegrationPage } from "@/components/admin/ghl-integration"

export default async function IntegrationsPage() {
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Integrations</h1>
        <p className="text-sm text-white/55">
          Manage GoHighLevel connection and data sync
        </p>
      </div>
      <GhlIntegrationPage />
    </div>
  )
}
