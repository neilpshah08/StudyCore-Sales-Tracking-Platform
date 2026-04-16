import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkConnection, listWebhooks } from "@/lib/ghl/client"

export async function GET() {
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

    // Check GHL connection
    const hasApiKey = !!process.env.GHL_API_KEY
    const hasLocationId = !!process.env.GHL_LOCATION_ID
    let connection: { connected: boolean; error?: string; locationName?: string } = {
      connected: false,
      error: "API key not configured",
    }

    if (hasApiKey && hasLocationId) {
      connection = await checkConnection()
    }

    // Get webhooks
    let webhooks: Awaited<ReturnType<typeof listWebhooks>> = []
    if (connection.connected) {
      try {
        webhooks = await listWebhooks()
      } catch {
        // webhooks listing may fail silently
      }
    }

    // Get last sync times from app_settings
    const syncKeys = [
      "ghl_last_full_sync",
      "ghl_last_contact_sync",
      "ghl_last_appointment_sync",
      "ghl_last_opportunity_sync",
      "ghl_last_webhook_received",
    ]
    const { data: syncSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", syncKeys)

    const syncTimes: Record<string, string | null> = {}
    for (const key of syncKeys) {
      const setting = syncSettings?.find((s) => s.key === key)
      syncTimes[key] = setting ? String(setting.value) : null
    }

    return NextResponse.json({
      configured: hasApiKey && hasLocationId,
      connected: connection.connected,
      locationName: connection.locationName,
      error: connection.error,
      webhooks: webhooks.map((w) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        events: w.events,
        active: w.active,
      })),
      syncTimes,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get status" },
      { status: 500 }
    )
  }
}
