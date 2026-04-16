import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { DealsList } from "@/components/admin/deals-list"
import type { Deal } from "@/types/database"

export type DealWithNames = Deal & {
  setter_name: string | null
  closer_name: string | null
}

export default async function AdminDealsPage() {
  await requireAdmin()
  const supabase = await createClient()

  // Fetch all deals with setter/closer names
  const { data: dealsData } = await supabase
    .from("deals")
    .select(
      `
      *,
      setter:users!deals_setter_id_fkey(full_name),
      closer:users!deals_closer_id_fkey(full_name)
    `
    )
    .order("date_closed", { ascending: false })

  // Flatten joined names
  const deals: DealWithNames[] = (dealsData ?? []).map((deal) => ({
    ...deal,
    setter_name:
      deal.setter && typeof deal.setter === "object" && "full_name" in deal.setter
        ? (deal.setter as { full_name: string }).full_name
        : null,
    closer_name:
      deal.closer && typeof deal.closer === "object" && "full_name" in deal.closer
        ? (deal.closer as { full_name: string }).full_name
        : null,
    setter: undefined,
    closer: undefined,
  })) as DealWithNames[]

  // Fetch all active reps for filter dropdowns and deal form
  const { data: repsData } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("role", ["setter", "closer"])
    .eq("status", "active")
    .order("full_name", { ascending: true })

  const reps = (repsData ?? []).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    role: r.role,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deal Management</h1>
        <p className="text-muted-foreground">
          View, create, and manage all closed deals and commissions.
        </p>
      </div>
      <DealsList deals={deals} reps={reps} />
    </div>
  )
}
