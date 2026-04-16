import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { PaymentPlanType } from "@/types/database"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: profile } = await supabase
      .from("users")
      .select("id, role, commission_rate")
      .eq("id", user.id)
      .single()

    if (!profile || (profile.role !== "closer" && profile.role !== "admin")) {
      return NextResponse.json({ error: "Only closers and admins can log deals" }, { status: 403 })
    }

    const body = await request.json()
    const {
      student_name, parent_name, deal_value, cash_collected,
      payment_plan, closer_id, setter_id, notes,
    } = body

    if (!student_name || !deal_value || !payment_plan) {
      return NextResponse.json(
        { error: "student_name, deal_value, and payment_plan are required" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const today = new Date().toISOString().split("T")[0]

    // Determine closer — use provided closer_id or the current user
    const effectiveCloserId = closer_id || (profile.role === "closer" ? profile.id : null)

    // Calculate commissions
    let setterCommission = 0
    let closerCommission = 0
    let pifBonus = 0

    if (setter_id) {
      const { data: setter } = await admin
        .from("users")
        .select("commission_rate")
        .eq("id", setter_id)
        .single()
      setterCommission = Math.round(deal_value * (setter?.commission_rate || 0.05) * 100) / 100
    }

    if (effectiveCloserId) {
      const { data: rates } = await admin
        .from("commission_rates")
        .select("rate, min_close_rate")
        .eq("role", "closer")
        .order("min_close_rate", { ascending: false, nullsFirst: false })

      const baseRate = rates?.find((r) => !r.min_close_rate)
      closerCommission = Math.round(deal_value * (baseRate?.rate || 0.10) * 100) / 100
    }

    if ((payment_plan as PaymentPlanType) === "PIF") {
      const { data: pifRate } = await admin
        .from("commission_rates")
        .select("pif_bonus_rate")
        .eq("role", "closer")
        .not("pif_bonus_rate", "is", null)
        .limit(1)
        .single()
      pifBonus = Math.round(deal_value * (pifRate?.pif_bonus_rate || 0.03) * 100) / 100
    }

    const totalCommission = setterCommission + closerCommission + pifBonus

    const { data: deal, error } = await admin
      .from("deals")
      .insert({
        date_closed: today,
        student_name,
        parent_name: parent_name || null,
        setter_id: setter_id || null,
        closer_id: effectiveCloserId,
        deal_value,
        payment_plan: payment_plan as PaymentPlanType,
        cash_collected: cash_collected || deal_value,
        setter_commission: setterCommission,
        closer_commission: closerCommission,
        pif_bonus: pifBonus,
        total_commission: totalCommission,
        status: "active",
        notes: notes || null,
      })
      .select("id")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Create fulfillment record
    await admin.from("deal_fulfillment").insert({
      deal_id: deal.id,
      status: "pending_onboarding",
    })

    // Audit log
    await admin.from("audit_log").insert({
      user_id: user.id,
      action: "deal_created",
      entity_type: "deal",
      entity_id: deal.id,
      description: `Deal logged by ${profile.role}: ${student_name} - $${deal_value}`,
    })

    // Notify admins
    const { data: admins } = await admin
      .from("users")
      .select("id")
      .eq("role", "admin")

    for (const a of admins ?? []) {
      await admin.from("notifications").insert({
        user_id: a.id,
        type: "deal_closed",
        title: "New Deal Logged!",
        message: `${student_name} - $${deal_value} by ${profile.role === "closer" ? "closer" : "admin"}`,
        link: "/admin/deals",
      })
    }

    return NextResponse.json({ id: deal.id }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to log deal" },
      { status: 500 }
    )
  }
}
