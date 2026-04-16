import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
    if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()

    const { data: existing } = await supabase
      .from("deal_fulfillment")
      .select("id")
      .eq("deal_id", id)
      .single()

    const payload = {
      deal_id: id,
      first_session_scheduled: body.first_session_scheduled || false,
      first_session_date: body.first_session_date || null,
      tutor_assigned: body.tutor_assigned || null,
      sessions_completed: body.sessions_completed || 0,
      total_sessions_purchased: body.total_sessions_purchased || null,
      status: body.status || "pending_onboarding",
      notes: body.notes || null,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      const { data, error } = await supabase
        .from("deal_fulfillment")
        .update(payload)
        .eq("deal_id", id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    } else {
      const { data, error } = await supabase
        .from("deal_fulfillment")
        .insert(payload)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data, { status: 201 })
    }
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
