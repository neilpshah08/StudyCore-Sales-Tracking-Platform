import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { PaymentPlanType } from "@/types/database"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("deals")
      .select(
        `
        *,
        setter:users!deals_setter_id_fkey(id, full_name, commission_rate),
        closer:users!deals_closer_id_fkey(id, full_name, commission_rate)
      `
      )
      .eq("id", id)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    const deal = {
      ...data,
      setter_name:
        data.setter && typeof data.setter === "object" && "full_name" in data.setter
          ? (data.setter as { full_name: string }).full_name
          : null,
      closer_name:
        data.closer && typeof data.closer === "object" && "full_name" in data.closer
          ? (data.closer as { full_name: string }).full_name
          : null,
      setter: undefined,
      closer: undefined,
    }

    return NextResponse.json({ data: deal })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch existing deal for audit comparison
    const { data: existingDeal, error: fetchError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", id)
      .single()

    if (fetchError || !existingDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    const body = await request.json()

    const dealValue = Number(body.deal_value ?? existingDeal.deal_value)
    const cashCollected = Number(body.cash_collected ?? existingDeal.cash_collected)
    const paymentPlan = (body.payment_plan ?? existingDeal.payment_plan) as PaymentPlanType
    const setterId = body.setter_id !== undefined ? body.setter_id : existingDeal.setter_id
    const closerId = body.closer_id !== undefined ? body.closer_id : existingDeal.closer_id

    // Determine if we need to recalculate commissions
    const needsRecalc =
      dealValue !== existingDeal.deal_value ||
      paymentPlan !== existingDeal.payment_plan ||
      setterId !== existingDeal.setter_id ||
      closerId !== existingDeal.closer_id

    let setterCommission = existingDeal.setter_commission ?? 0
    let closerCommission = existingDeal.closer_commission ?? 0
    let pifBonus = existingDeal.pif_bonus ?? 0

    if (needsRecalc) {
      // Recalculate setter commission
      setterCommission = 0
      if (setterId) {
        const { data: setter } = await supabase
          .from("users")
          .select("commission_rate")
          .eq("id", setterId)
          .single()

        if (setter?.commission_rate) {
          setterCommission = Math.round(dealValue * setter.commission_rate * 100) / 100
        }
      }

      // Recalculate closer commission based on tiered close rate
      closerCommission = 0
      if (closerId) {
        // Get closer's trailing 30-day close rate
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

        const { data: recentActivity } = await supabase
          .from("daily_activities")
          .select("demos_completed, deals_closed")
          .eq("user_id", closerId)
          .gte("date", thirtyDaysAgoStr)

        let closeRate = 0
        if (recentActivity && recentActivity.length > 0) {
          const totalDemos = recentActivity.reduce(
            (sum, a) => sum + (a.demos_completed ?? 0),
            0
          )
          const totalClosed = recentActivity.reduce(
            (sum, a) => sum + (a.deals_closed ?? 0),
            0
          )
          closeRate = totalDemos > 0 ? totalClosed / totalDemos : 0
        }

        // Get commission tiers for closers
        const { data: tiers } = await supabase
          .from("commission_rates")
          .select("rate, min_close_rate")
          .eq("role", "closer")
          .order("min_close_rate", { ascending: false, nullsFirst: false })

        if (tiers && tiers.length > 0) {
          for (const tier of tiers) {
            if (tier.min_close_rate === null || closeRate >= tier.min_close_rate) {
              closerCommission = Math.round(dealValue * tier.rate * 100) / 100
              break
            }
          }
        } else {
          // Fallback: use the closer's commission_rate from user profile
          const { data: closer } = await supabase
            .from("users")
            .select("commission_rate")
            .eq("id", closerId)
            .single()

          if (closer?.commission_rate) {
            closerCommission = Math.round(dealValue * closer.commission_rate * 100) / 100
          }
        }
      }

      // Recalculate PIF bonus
      pifBonus = 0
      if (paymentPlan === "PIF") {
        const { data: pifRate } = await supabase
          .from("commission_rates")
          .select("pif_bonus_rate")
          .limit(1)
          .single()

        const bonusRate = pifRate?.pif_bonus_rate ?? 0.05
        pifBonus = Math.round(dealValue * bonusRate * 100) / 100
      }
    }

    const totalCommission =
      Math.round((setterCommission + closerCommission + pifBonus) * 100) / 100

    const updateData = {
      date_closed: body.date_closed ?? existingDeal.date_closed,
      student_name: body.student_name ?? existingDeal.student_name,
      parent_name: body.parent_name !== undefined ? body.parent_name : existingDeal.parent_name,
      setter_id: setterId || null,
      closer_id: closerId || null,
      deal_value: dealValue,
      payment_plan: paymentPlan,
      cash_collected: cashCollected,
      setter_commission: setterCommission,
      closer_commission: closerCommission,
      pif_bonus: pifBonus,
      total_commission: totalCommission,
      notes: body.notes !== undefined ? body.notes : existingDeal.notes,
      status: body.status ?? existingDeal.status,
    }

    const { data: updated, error: updateError } = await supabase
      .from("deals")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // Build changes object for audit log
    const changes: Record<string, { before: unknown; after: unknown }> = {}
    for (const [key, value] of Object.entries(updateData)) {
      const oldValue = (existingDeal as Record<string, unknown>)[key]
      if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
        changes[key] = { before: oldValue, after: value }
      }
    }

    // Create audit log entry
    if (Object.keys(changes).length > 0) {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "update",
        entity_type: "deal",
        entity_id: id,
        changes: changes as unknown as Record<string, unknown>,
        description: `Updated deal for ${updateData.student_name} - changed: ${Object.keys(changes).join(", ")}`,
      })
    }

    return NextResponse.json({ data: updated })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
