import { createClient } from "@supabase/supabase-js"
import {
  getContacts,
  getAppointments,
  getOpportunities,
  getGhlUsers,
  getCustomFieldValue,
  type GhlOpportunity,
} from "./client"
import { GHL_CONFIG, getGhlLocationId } from "./config"
import type { PaymentPlanType } from "@/types/database"

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export interface SyncResult {
  contactsAdded: number
  appointmentsProcessed: number
  dealsCreated: number
  lostDealsLogged: number
  errors: string[]
}

// --- Sync contacts → log daily lead counts ---

export async function syncContacts(date?: string): Promise<{
  count: number
  errors: string[]
}> {
  const errors: string[] = []
  const targetDate = date || new Date().toISOString().split("T")[0]
  const startOfDay = `${targetDate}T00:00:00.000Z`
  const endOfDay = `${targetDate}T23:59:59.999Z`

  try {
    const contacts = await getContacts(startOfDay, endOfDay)
    const supabase = getAdminSupabase()

    await supabase.from("app_settings").upsert(
      {
        key: "ghl_last_contact_sync",
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )

    return { count: contacts.length, errors }
  } catch (err) {
    errors.push(`Contact sync failed: ${err instanceof Error ? err.message : String(err)}`)
    return { count: 0, errors }
  }
}

// --- Sync appointments → update rep daily activity ---

export async function syncAppointments(date?: string): Promise<{
  processed: number
  errors: string[]
}> {
  const errors: string[] = []
  const targetDate = date || new Date().toISOString().split("T")[0]
  const startOfDay = `${targetDate}T00:00:00.000Z`
  const endOfDay = `${targetDate}T23:59:59.999Z`

  try {
    const appointments = await getAppointments(startOfDay, endOfDay)
    const supabase = getAdminSupabase()

    // Map GHL user IDs to our rep IDs
    const ghlUsers = await getGhlUsers()
    const { data: reps } = await supabase
      .from("users")
      .select("id, email, full_name")
      .in("role", ["setter", "closer"])

    const repByEmail = new Map(
      (reps ?? []).map((r) => [r.email.toLowerCase(), r])
    )
    const repByName = new Map(
      (reps ?? []).map((r) => [r.full_name.toLowerCase(), r])
    )

    const ghlUserToRep = new Map<string, string>()
    for (const gu of ghlUsers) {
      const byEmail = repByEmail.get(gu.email?.toLowerCase())
      const byName = repByName.get(gu.name?.toLowerCase())
      const rep = byEmail || byName
      if (rep) ghlUserToRep.set(gu.id, rep.id)
    }

    // Aggregate: count shows and no-shows per rep
    const repShows = new Map<string, number>()
    const repNoShows = new Map<string, number>()

    for (const appt of appointments) {
      const repId = ghlUserToRep.get(appt.assignedUserId)
      if (!repId) continue

      const status = appt.appointmentStatus?.toLowerCase() || appt.status?.toLowerCase()
      if (status === "showed" || status === "completed") {
        repShows.set(repId, (repShows.get(repId) || 0) + 1)
      } else if (status === "noshow" || status === "no_show") {
        repNoShows.set(repId, (repNoShows.get(repId) || 0) + 1)
      }
    }

    let processed = 0
    for (const [repId, showCount] of repShows) {
      const { data: existing } = await supabase
        .from("daily_activity")
        .select("id, demos_completed, demos_scheduled")
        .eq("user_id", repId)
        .eq("date", targetDate)
        .single()

      const totalScheduled = showCount + (repNoShows.get(repId) || 0)

      if (existing) {
        await supabase
          .from("daily_activity")
          .update({
            demos_completed: Math.max(existing.demos_completed, showCount),
            demos_scheduled: Math.max(existing.demos_scheduled, totalScheduled),
          })
          .eq("id", existing.id)
      } else {
        await supabase.from("daily_activity").insert({
          user_id: repId,
          date: targetDate,
          demos_completed: showCount,
          demos_scheduled: totalScheduled,
        })
      }
      processed++
    }

    await supabase.from("app_settings").upsert(
      {
        key: "ghl_last_appointment_sync",
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )

    return { processed, errors }
  } catch (err) {
    errors.push(`Appointment sync failed: ${err instanceof Error ? err.message : String(err)}`)
    return { processed: 0, errors }
  }
}

// --- Process a "Closed Won" opportunity into a deal ---

export async function processClosedWonOpportunity(
  opportunity: GhlOpportunity
): Promise<{ dealId?: string; error?: string }> {
  const supabase = getAdminSupabase()
  const cf = opportunity.customFields || []

  const studentName =
    getCustomFieldValue(cf, GHL_CONFIG.customFields.studentName) ||
    opportunity.contact?.name ||
    opportunity.name

  const purchasePrice = parseFloat(
    getCustomFieldValue(cf, GHL_CONFIG.customFields.purchasePrice) || "0"
  )
  const amountPaid = parseFloat(
    getCustomFieldValue(cf, GHL_CONFIG.customFields.amountPaid) || "0"
  )
  const paymentMethod =
    getCustomFieldValue(cf, GHL_CONFIG.customFields.paymentMethod) || ""
  const closerNameField =
    getCustomFieldValue(cf, GHL_CONFIG.customFields.closerName) || ""

  const dealValue = purchasePrice || opportunity.monetaryValue || 0
  const cashCollected = amountPaid || dealValue

  // Map payment method to our enum
  let paymentPlan: PaymentPlanType = "PIF"
  const pm = paymentMethod.toLowerCase()
  if (pm.includes("2")) paymentPlan = "2-pay"
  else if (pm.includes("3")) paymentPlan = "3-pay"
  else if (pm.includes("4")) paymentPlan = "4-pay"
  else if (pm.includes("6")) paymentPlan = "6-pay"

  // Find closer by name
  let closerId: string | null = null
  if (closerNameField) {
    const { data: closer } = await supabase
      .from("users")
      .select("id")
      .ilike("full_name", `%${closerNameField}%`)
      .eq("role", "closer")
      .limit(1)
      .single()
    if (closer) closerId = closer.id
  }

  // Find setter — use the assigned user in GHL if they match a setter
  let setterId: string | null = null
  if (opportunity.assignedTo) {
    const ghlUsers = await getGhlUsers()
    const assignedGhlUser = ghlUsers.find((u) => u.id === opportunity.assignedTo)
    if (assignedGhlUser) {
      const { data: setter } = await supabase
        .from("users")
        .select("id")
        .or(
          `email.ilike.%${assignedGhlUser.email}%,full_name.ilike.%${assignedGhlUser.name}%`
        )
        .eq("role", "setter")
        .limit(1)
        .single()
      if (setter) setterId = setter.id
    }
  }

  // Check for duplicate (same student name + date within 1 day)
  const today = new Date().toISOString().split("T")[0]
  const { data: existingDeal } = await supabase
    .from("deals")
    .select("id")
    .eq("student_name", studentName)
    .eq("date_closed", today)
    .limit(1)
    .single()

  if (existingDeal) {
    return { dealId: existingDeal.id, error: "Deal already exists" }
  }

  // Calculate commissions
  let setterCommission = 0
  let closerCommission = 0
  let pifBonus = 0

  if (setterId) {
    const { data: setterProfile } = await supabase
      .from("users")
      .select("commission_rate")
      .eq("id", setterId)
      .single()
    setterCommission = dealValue * (setterProfile?.commission_rate || 0.05)
  }

  if (closerId) {
    const { data: rates } = await supabase
      .from("commission_rates")
      .select("rate, min_close_rate")
      .eq("role", "closer")
      .order("min_close_rate", { ascending: false, nullsFirst: false })

    // Use base closer rate for now (trailing close rate calc needs historical data)
    const baseRate = rates?.find((r) => !r.min_close_rate)
    closerCommission = dealValue * (baseRate?.rate || 0.10)
  }

  if (paymentPlan === "PIF") {
    const { data: pifRate } = await supabase
      .from("commission_rates")
      .select("pif_bonus_rate")
      .eq("role", "closer")
      .not("pif_bonus_rate", "is", null)
      .limit(1)
      .single()
    pifBonus = dealValue * (pifRate?.pif_bonus_rate || 0.03)
  }

  const totalCommission = setterCommission + closerCommission + pifBonus

  const { data: deal, error } = await supabase
    .from("deals")
    .insert({
      date_closed: today,
      student_name: studentName,
      parent_name: opportunity.contact?.name || null,
      setter_id: setterId,
      closer_id: closerId,
      deal_value: dealValue,
      payment_plan: paymentPlan,
      cash_collected: cashCollected,
      setter_commission: setterCommission,
      closer_commission: closerCommission,
      pif_bonus: pifBonus,
      total_commission: totalCommission,
      status: "active",
      notes: `Auto-created from GHL opportunity ${opportunity.id}`,
    })
    .select("id")
    .single()

  if (error) return { error: error.message }

  // Create fulfillment tracking record
  await supabase.from("deal_fulfillment").insert({
    deal_id: deal.id,
    status: "pending_onboarding",
  })

  // Audit log
  await supabase.from("audit_log").insert({
    user_id: setterId || closerId || "00000000-0000-0000-0000-000000000000",
    action: "deal_created",
    entity_type: "deal",
    entity_id: deal.id,
    description: `Deal auto-created from GHL: ${studentName} - $${dealValue}`,
    changes: { source: { old: null, new: "ghl" }, ghl_opportunity_id: { old: null, new: opportunity.id } },
  })

  return { dealId: deal.id }
}

// --- Process a "Closed Lost" opportunity ---

export async function processClosedLostOpportunity(
  opportunity: GhlOpportunity,
  lostReason?: string
): Promise<void> {
  const supabase = getAdminSupabase()

  const studentName =
    getCustomFieldValue(
      opportunity.customFields || [],
      GHL_CONFIG.customFields.studentName
    ) ||
    opportunity.contact?.name ||
    opportunity.name

  // Check if there's an existing active deal for this student (maybe it was created earlier)
  const { data: existingDeal } = await supabase
    .from("deals")
    .select("id")
    .eq("student_name", studentName)
    .eq("status", "active")
    .limit(1)
    .single()

  if (existingDeal) {
    await supabase
      .from("deals")
      .update({
        status: "refunded",
        lost_reason: lostReason || "Closed Lost in GHL",
      })
      .eq("id", existingDeal.id)
  }

  // Log to audit
  await supabase.from("audit_log").insert({
    user_id: "00000000-0000-0000-0000-000000000000",
    action: "opportunity_lost",
    entity_type: "deal",
    entity_id: existingDeal?.id || "00000000-0000-0000-0000-000000000000",
    description: `Opportunity lost in GHL: ${studentName} - Reason: ${lostReason || "Not specified"}`,
    changes: {
      ghl_opportunity_id: { old: null, new: opportunity.id },
      lost_reason: { old: null, new: lostReason || "Closed Lost in GHL" },
    },
  })

  await supabase.from("app_settings").upsert(
    {
      key: "ghl_last_opportunity_sync",
      value: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  )
}

// --- Full manual sync ---

export async function runFullSync(): Promise<SyncResult> {
  const errors: string[] = []
  let contactsAdded = 0
  let appointmentsProcessed = 0
  let dealsCreated = 0
  let lostDealsLogged = 0

  const today = new Date().toISOString().split("T")[0]

  // 1. Sync contacts
  const contactResult = await syncContacts(today)
  contactsAdded = contactResult.count
  errors.push(...contactResult.errors)

  // 2. Sync appointments
  const apptResult = await syncAppointments(today)
  appointmentsProcessed = apptResult.processed
  errors.push(...apptResult.errors)

  // 3. Sync pipeline opportunities
  try {
    const opportunities = await getOpportunities(GHL_CONFIG.pipelineId)
    const pipelines = await import("./client").then((m) => m.getPipelines())
    const pipeline = pipelines.find((p) => p.id === GHL_CONFIG.pipelineId)

    const closedWonStage = pipeline?.stages.find(
      (s) => s.name.toLowerCase().includes("closed won") || s.name.toLowerCase().includes("won")
    )
    const closedLostStage = pipeline?.stages.find(
      (s) => s.name.toLowerCase().includes("closed lost") || s.name.toLowerCase().includes("lost")
    )

    for (const opp of opportunities) {
      if (closedWonStage && opp.pipelineStageId === closedWonStage.id) {
        const result = await processClosedWonOpportunity(opp)
        if (result.dealId && !result.error) dealsCreated++
        if (result.error && !result.error.includes("already exists")) {
          errors.push(result.error)
        }
      } else if (closedLostStage && opp.pipelineStageId === closedLostStage.id) {
        await processClosedLostOpportunity(opp)
        lostDealsLogged++
      }
    }

    const supabase = getAdminSupabase()
    await supabase.from("app_settings").upsert(
      {
        key: "ghl_last_opportunity_sync",
        value: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
  } catch (err) {
    errors.push(`Opportunity sync failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Update last full sync timestamp
  const supabase = getAdminSupabase()
  await supabase.from("app_settings").upsert(
    {
      key: "ghl_last_full_sync",
      value: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  )

  return { contactsAdded, appointmentsProcessed, dealsCreated, lostDealsLogged, errors }
}
