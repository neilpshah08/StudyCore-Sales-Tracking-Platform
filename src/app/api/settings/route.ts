import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data, error } = await supabase.from("app_settings").select("*")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const settings: Record<string, unknown> = {}
    for (const s of data ?? []) {
      settings[s.key] = s.value
    }

    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
    if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()

    if (body.key && body.value !== undefined) {
      const { error } = await supabase.from("app_settings").upsert(
        { key: body.key, value: body.value, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      )
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else if (body.settings) {
      for (const [key, value] of Object.entries(body.settings)) {
        await supabase.from("app_settings").upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        )
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
