import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { RepComparison } from "@/components/admin/rep-comparison"

export default async function ComparePage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: repsData } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("role", ["setter", "closer"])
    .eq("status", "active")
    .order("full_name")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1B2A4A]">Rep Comparison</h1>
        <p className="text-sm text-muted-foreground">Compare two reps side-by-side</p>
      </div>
      <RepComparison reps={(repsData ?? []).map((r) => ({ id: r.id, full_name: r.full_name, role: r.role }))} />
    </div>
  )
}
