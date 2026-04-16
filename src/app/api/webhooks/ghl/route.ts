import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getGhlWebhookSecret } from "@/lib/ghl/config"
import {
  processClosedWonOpportunity,
  processClosedLostOpportunity,
  syncAppointments,
} from "@/lib/ghl/sync"
import { getOpportunity, getContact } from "@/lib/ghl/client"
import { GHL_CONFIG } from "@/lib/ghl/config"
import { createClient } from "@supabase/supabase-js"

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  const secret = getGhlWebhookSecret()
  if (!secret) return true // no secret configured, skip verification
  if (!signature) return false

  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex")

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  )
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-ghl-signature")

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventType = body.type as string | undefined
  const supabase = getAdminSupabase()

  try {
    switch (eventType) {
      // --- Contact Created ---
      case "ContactCreate": {
        const contactId = body.contactId as string || body.id as string
        const dateAdded = (body.dateAdded as string) || new Date().toISOString()
        const date = dateAdded.split("T")[0]

        // Increment daily lead count in app_settings
        const key = `ghl_leads_${date}`
        const { data: existing } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", key)
          .single()

        const currentCount = existing ? Number(existing.value) : 0
        await supabase.from("app_settings").upsert(
          { key, value: currentCount + 1, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        )

        // Create notification
        const { data: admins } = await supabase
          .from("users")
          .select("id")
          .eq("role", "admin")

        const contactName = (body.firstName as string || "") + " " + (body.lastName as string || "")
        for (const admin of admins ?? []) {
          await supabase.from("notifications").insert({
            user_id: admin.id,
            type: "general",
            title: "New Lead from GHL",
            message: `New contact created: ${contactName.trim() || contactId}`,
            link: "/admin",
          })
        }

        await supabase.from("app_settings").upsert(
          { key: "ghl_last_webhook_received", value: new Date().toISOString(), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        )

        return NextResponse.json({ success: true, event: "contact_created" })
      }

      // --- Opportunity Stage Changed ---
      case "OpportunityStageUpdate": {
        const opportunityId = body.id as string || body.opportunityId as string
        const newStageId = body.pipelineStageId as string || body.stageId as string
        const pipelineId = body.pipelineId as string

        // Only process our target pipeline
        if (pipelineId && pipelineId !== GHL_CONFIG.pipelineId) {
          return NextResponse.json({ success: true, skipped: "wrong_pipeline" })
        }

        // Fetch the full opportunity for custom fields
        let opportunity
        try {
          opportunity = await getOpportunity(opportunityId)
        } catch {
          return NextResponse.json(
            { error: "Could not fetch opportunity details" },
            { status: 500 }
          )
        }

        // Fetch pipeline stages to determine which stage this is
        const { getPipelines } = await import("@/lib/ghl/client")
        const pipelines = await getPipelines()
        const pipeline = pipelines.find((p) => p.id === GHL_CONFIG.pipelineId)
        const stage = pipeline?.stages.find((s) => s.id === newStageId)
        const stageName = stage?.name?.toLowerCase() || ""

        if (stageName.includes("closed won") || stageName.includes("won")) {
          const result = await processClosedWonOpportunity(opportunity)

          if (result.dealId) {
            // Notify admins
            const { data: admins } = await supabase
              .from("users")
              .select("id")
              .eq("role", "admin")

            for (const admin of admins ?? []) {
              await supabase.from("notifications").insert({
                user_id: admin.id,
                type: "deal_closed",
                title: "New Deal Closed!",
                message: `${opportunity.contact?.name || opportunity.name} - $${opportunity.monetaryValue || 0}`,
                link: "/admin/deals",
              })
            }
          }

          return NextResponse.json({ success: true, event: "closed_won", dealId: result.dealId })
        }

        if (stageName.includes("closed lost") || stageName.includes("lost")) {
          const lostReason =
            (body.lostReason as string) ||
            (body.notes as string) ||
            "Closed Lost in GHL"

          await processClosedLostOpportunity(opportunity, lostReason)
          return NextResponse.json({ success: true, event: "closed_lost" })
        }

        // Stage change but not to a terminal stage — just log it
        await supabase.from("app_settings").upsert(
          { key: "ghl_last_webhook_received", value: new Date().toISOString(), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        )

        return NextResponse.json({ success: true, event: "stage_changed", stage: stage?.name })
      }

      // --- Appointment Status ---
      case "AppointmentCreate": {
        const status = (body.appointmentStatus as string || body.status as string || "").toLowerCase()
        const contactId = body.contactId as string
        const assignedUserId = body.assignedUserId as string
        const startTime = body.startTime as string
        const date = startTime ? startTime.split("T")[0] : new Date().toISOString().split("T")[0]

        if (status === "showed" || status === "completed" || status === "noshow" || status === "no_show") {
          // Find rep by GHL user mapping
          const { getGhlUsers } = await import("@/lib/ghl/client")
          const ghlUsers = await getGhlUsers()
          const ghlUser = ghlUsers.find((u) => u.id === assignedUserId)

          if (ghlUser) {
            const { data: rep } = await supabase
              .from("users")
              .select("id, role")
              .or(`email.ilike.%${ghlUser.email}%,full_name.ilike.%${ghlUser.name}%`)
              .in("role", ["setter", "closer"])
              .limit(1)
              .single()

            if (rep) {
              const { data: existing } = await supabase
                .from("daily_activity")
                .select("id, demos_completed, demos_scheduled")
                .eq("user_id", rep.id)
                .eq("date", date)
                .single()

              const isShow = status === "showed" || status === "completed"

              if (existing) {
                const updates: Record<string, number> = {
                  demos_scheduled: existing.demos_scheduled + 1,
                }
                if (isShow) updates.demos_completed = existing.demos_completed + 1
                await supabase.from("daily_activity").update(updates).eq("id", existing.id)
              } else {
                await supabase.from("daily_activity").insert({
                  user_id: rep.id,
                  date,
                  demos_scheduled: 1,
                  demos_completed: isShow ? 1 : 0,
                })
              }
            }
          }
        }

        await supabase.from("app_settings").upsert(
          { key: "ghl_last_webhook_received", value: new Date().toISOString(), updated_at: new Date().toISOString() },
          { onConflict: "key" }
        )

        return NextResponse.json({ success: true, event: "appointment_status" })
      }

      default:
        return NextResponse.json({ success: true, event: "unhandled", type: eventType })
    }
  } catch (err) {
    console.error("Webhook processing error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}

// Health check for the webhook endpoint
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "/api/webhooks/ghl" })
}
