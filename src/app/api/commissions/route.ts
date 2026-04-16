import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0]

    // Fetch all deals with rep details
    const { data: deals, error: dealsError } = await supabase
      .from("deals")
      .select(
        `
        id,
        date_closed,
        student_name,
        deal_value,
        setter_id,
        closer_id,
        setter_commission,
        closer_commission,
        pif_bonus,
        total_commission,
        payout_date,
        clawback,
        clawback_amount,
        status,
        setter:users!deals_setter_id_fkey(id, full_name, role),
        closer:users!deals_closer_id_fkey(id, full_name, role)
      `
      )
      .order("date_closed", { ascending: false })

    if (dealsError) {
      return NextResponse.json({ error: dealsError.message }, { status: 500 })
    }

    // Fetch all active reps
    const { data: reps } = await supabase
      .from("users")
      .select("id, full_name, role")
      .neq("role", "admin")

    // Build per-rep breakdown
    const repMap = new Map<
      string,
      {
        rep_id: string
        rep_name: string
        role: string
        total_deals: number
        total_commission_earned: number
        total_paid: number
        total_clawbacks: number
      }
    >()

    for (const rep of reps || []) {
      repMap.set(rep.id, {
        rep_id: rep.id,
        rep_name: rep.full_name,
        role: rep.role,
        total_deals: 0,
        total_commission_earned: 0,
        total_paid: 0,
        total_clawbacks: 0,
      })
    }

    let totalOwed = 0
    let totalPaidThisMonth = 0
    let totalClawbacks = 0

    for (const deal of deals || []) {
      // Process setter
      if (deal.setter_id && repMap.has(deal.setter_id)) {
        const rep = repMap.get(deal.setter_id)!
        const commission = (deal.setter_commission ?? 0) + (deal.pif_bonus > 0 && deal.closer_id ? deal.pif_bonus / 2 : deal.pif_bonus > 0 ? deal.pif_bonus : 0)
        rep.total_deals += 1
        rep.total_commission_earned += commission

        if (deal.payout_date) {
          rep.total_paid += commission
        }

        if (deal.clawback && deal.clawback_amount > 0) {
          // Approximate setter portion of clawback
          const totalComm = (deal.setter_commission ?? 0) + (deal.closer_commission ?? 0)
          const setterShare = totalComm > 0 ? (deal.setter_commission ?? 0) / totalComm : 0.5
          rep.total_clawbacks += deal.clawback_amount * setterShare
        }
      }

      // Process closer
      if (deal.closer_id && repMap.has(deal.closer_id)) {
        const rep = repMap.get(deal.closer_id)!
        const commission = (deal.closer_commission ?? 0) + (deal.pif_bonus > 0 && deal.setter_id ? deal.pif_bonus / 2 : deal.pif_bonus > 0 ? deal.pif_bonus : 0)
        rep.total_deals += 1
        rep.total_commission_earned += commission

        if (deal.payout_date) {
          rep.total_paid += commission
        }

        if (deal.clawback && deal.clawback_amount > 0) {
          const totalComm = (deal.setter_commission ?? 0) + (deal.closer_commission ?? 0)
          const closerShare = totalComm > 0 ? (deal.closer_commission ?? 0) / totalComm : 0.5
          rep.total_clawbacks += deal.clawback_amount * closerShare
        }
      }

      // Summary stats
      const dealCommission = deal.total_commission ?? 0
      if (!deal.payout_date && deal.status === "active") {
        totalOwed += dealCommission
      }
      if (
        deal.payout_date &&
        deal.payout_date >= monthStart &&
        deal.payout_date <= monthEnd
      ) {
        totalPaidThisMonth += dealCommission
      }
      if (deal.clawback) {
        totalClawbacks += deal.clawback_amount ?? 0
      }
    }

    const repBreakdown = Array.from(repMap.values()).map((rep) => ({
      ...rep,
      total_commission_earned: Math.round(rep.total_commission_earned * 100) / 100,
      total_paid: Math.round(rep.total_paid * 100) / 100,
      total_clawbacks: Math.round(rep.total_clawbacks * 100) / 100,
      total_outstanding: Math.round((rep.total_commission_earned - rep.total_paid) * 100) / 100,
    }))

    // Fetch payout log from audit_logs
    const { data: payoutLogs } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action", "payout_processed")
      .order("created_at", { ascending: false })
      .limit(100)

    // Enrich payout logs with admin and rep names
    const payoutLog = (payoutLogs || []).map((log) => {
      const changes = log.changes as Record<string, unknown> | null
      return {
        id: log.id,
        date: log.created_at,
        rep_name: (changes?.rep_name as string) || "Unknown",
        amount_paid: (changes?.amount as number) || 0,
        num_deals: (changes?.num_deals as number) || 0,
        notes: (changes?.notes as string) || "",
        admin_name: (changes?.admin_name as string) || "Admin",
      }
    })

    const summary = {
      total_owed: Math.round(totalOwed * 100) / 100,
      total_paid_this_month: Math.round(totalPaidThisMonth * 100) / 100,
      total_clawbacks: Math.round(totalClawbacks * 100) / 100,
    }

    return NextResponse.json({
      summary,
      repBreakdown,
      payoutLog,
    })
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

    const { data: profile } = await supabase
      .from("users")
      .select("role, full_name")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { rep_id, amount, payout_date, notes } = body

    if (!rep_id || amount === undefined || !payout_date) {
      return NextResponse.json(
        { error: "Missing required fields: rep_id, amount, payout_date" },
        { status: 400 }
      )
    }

    // Get rep details
    const { data: rep } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", rep_id)
      .single()

    // Update all unpaid deals for this rep (where they are setter or closer)
    const { data: setterDeals } = await supabase
      .from("deals")
      .select("id")
      .eq("setter_id", rep_id)
      .is("payout_date", null)
      .eq("status", "active")

    const { data: closerDeals } = await supabase
      .from("deals")
      .select("id")
      .eq("closer_id", rep_id)
      .is("payout_date", null)
      .eq("status", "active")

    const allDealIds = [
      ...(setterDeals || []).map((d) => d.id),
      ...(closerDeals || []).map((d) => d.id),
    ]

    // Deduplicate in case a rep is both setter and closer
    const uniqueDealIds = [...new Set(allDealIds)]

    if (uniqueDealIds.length > 0) {
      const { error: updateError } = await supabase
        .from("deals")
        .update({ payout_date })
        .in("id", uniqueDealIds)

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        )
      }
    }

    // Create audit log entry
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "payout_processed",
      entity_type: "payout",
      entity_id: rep_id,
      changes: {
        rep_id,
        rep_name: rep?.full_name || "Unknown",
        amount: Number(amount),
        payout_date,
        notes: notes || "",
        num_deals: uniqueDealIds.length,
        admin_name: profile.full_name,
      },
      description: `Processed payout of $${Number(amount).toFixed(2)} for ${rep?.full_name || "Unknown"} covering ${uniqueDealIds.length} deals`,
    })

    return NextResponse.json({
      success: true,
      deals_updated: uniqueDealIds.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
