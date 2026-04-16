import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createWebhook, deleteWebhook, listWebhooks } from "@/lib/ghl/client"
import { GHL_CONFIG } from "@/lib/ghl/config"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const webhookUrl = body.webhookUrl as string

    if (!webhookUrl) {
      return NextResponse.json({ error: "webhookUrl is required" }, { status: 400 })
    }

    // Remove existing StudyCore webhooks first
    const existing = await listWebhooks()
    for (const wh of existing) {
      if (wh.name === "StudyCore Sales Tracker" && wh.id) {
        try {
          await deleteWebhook(wh.id)
        } catch {
          // ignore deletion errors
        }
      }
    }

    // Register new webhook
    const webhook = await createWebhook(
      webhookUrl,
      [...GHL_CONFIG.webhookEvents]
    )

    return NextResponse.json({ webhook })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to register webhook" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const webhookId = body.webhookId as string

    if (!webhookId) {
      return NextResponse.json({ error: "webhookId is required" }, { status: 400 })
    }

    await deleteWebhook(webhookId)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete webhook" },
      { status: 500 }
    )
  }
}
