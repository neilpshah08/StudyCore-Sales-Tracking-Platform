import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { EditRepForm } from "@/components/admin/edit-rep-form"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditRepPage({ params }: PageProps) {
  const { id } = await params
  await requireAdmin()
  const supabase = await createClient()

  const { data: rep, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !rep) notFound()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Edit Rep</h1>
        <p className="text-sm text-white/55">
          Update {rep.full_name}&apos;s profile and role
        </p>
      </div>
      <EditRepForm rep={rep} />
    </div>
  )
}
