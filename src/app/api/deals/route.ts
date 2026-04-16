import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { PaymentPlanType } from "@/types/database"

export async function GET(request: NextRequest) {
  try {
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

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const setterId = searchParams.get("setter_id")
    const closerId = searchParams.get("closer_id")
    const status = searchParams.get("status")

    let query = supabase
      .from("deals")
      .select(
        `
        *,
        setter:users!deals_setter_id_fkey(full_name),
        closer:users!deals_closer_id_fkey(full_name)
      `
      )
      .order("date_closed", { ascending: false })

    if (startDate) {
      query = query.gte("date_closed", startDate)
    }
    if (endDate) {
      query = query.lte("date_closed", endDate)
    }
    if (setterId) {
      query = query.eq("setter_id", setterId)
    }
    if (closerId) {
      query = query.eq("closer_id", closerId)
    }
    if (status && status !== "all") {
      query = query.eq("status", status)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Flatten the joined names
    const deals = (data ?? []).map((deal) => ({
      ...deal,
      setter_name:
        deal.setter && typeof deal.setter === "object" && "full_name" in deal.setter
          ? (deal.setter as { full_name: string }).full_name
          : null,
      closer_name:
        deal.closer && typeof deal.closer === "object" && "full_name" in deal.closer
          ? (deal.closer as { full_name: string }).full_name
          : null,
      setter: undefined,
      closer: undefined,
    }))

    return NextResponse.json({ data: deals })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json()

    // Validate required fields
    if (!body.date_closed || !body.student_name || !body.deal_value || !body.payment_plan) {
      return NextResponse.json(
        { error: "Missing required fields: date_closed, student_name, deal_value, payment_plan" },
        { status: 400 }
      )
    }

    const dealValue = Number(body.deal_value)
    const cashCollected = Number(body.cash_collected ?? 0)
    const paymentPlan = body.payment_plan as PaymentPlanType

    // Calculate setter commission
    let setterCommission = 0
    if (body.setter_id) {
      const { data: setter } = await supabase
        .from("users")
        .select("commission_rate")
        .eq("id", body.setter_id)
        .single()

      if (setter?.commission_rate) {
        setterCommission = Math.round(dealValue * setter.commission_rate * 100) / 100
      }
    }

    // Calculate closer commission based on tiered close rate
    let closerCommission = 0
    if (body.closer_id) {
      // Get closer's trailing 30-day close rate
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

      const { data: recentActivity } = await supabase
        .from("daily_activities")
        .select("demos_completed, deals_closed")
        .eq("user_id", body.closer_id)
        .gte("date", thirtyDaysAgoStr)

      let closeRate = 0
      if (recentActivity && recentActivity.length > 0) {
        const totalDemos = recentActivity.reduce((sum, a) => sum + (a.demos_completed ?? 0), 0)
        const totalClosed = recentActivity.reduce((sum, a) => sum + (a.deals_closed ?? 0), 0)
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
          .eq("id", body.closer_id)
          .single()

        if (closer?.commission_rate) {
          closerCommission = Math.round(dealValue * closer.commission_rate * 100) / 100
        }
      }
    }

    // Calculate PIF bonus
    let pifBonus = 0
    if (paymentPlan === "PIF") {
      // Get PIF bonus rate from commission_rates table
      const { data: pifRate } = await supabase
        .from("commission_rates")
        .select("pif_bonus_rate")
        .limit(1)
        .single()

      const bonusRate = pifRate?.pif_bonus_rate ?? 0.05
      pifBonus = Math.round(dealValue * bonusRate * 100) / 100
    }

    const totalCommission = Math.round((setterCommission + closerCommission + pifBonus) * 100) / 100

    const dealData = {
      date_closed: body.date_closed,
      student_name: body.student_name,
      parent_name: body.parent_name || null,
      setter_id: body.setter_id || null,
      closer_id: body.closer_id || null,
      deal_value: dealValue,
      payment_plan: paymentPlan,
      cash_collected: cashCollected,
      setter_commission: setterCommission,
      closer_commission: closerCommission,
      pif_bonus: pifBonus,
      total_commission: totalCommission,
      payout_date: null,
      clawback: false,
      clawback_amount: 0,
      lost_reason: null,
      notes: body.notes || null,
      status: "active" as const,
    }

    const { data: created, error: insertError } = await supabase
      .from("deals")
      .insert(dealData)
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Create audit log entry
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create",
      entity_type: "deal",
      entity_id: created.id,
      changes: dealData as unknown as Record<string, unknown>,
      description: `Created deal for ${body.student_name} - ${paymentPlan} - $${dealValue}`,
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
