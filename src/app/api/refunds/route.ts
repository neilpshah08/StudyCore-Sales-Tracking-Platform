import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { calculateClawback } from "@/lib/utils"

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

    // Fetch all refunds with deal and rep details
    const { data: refunds, error: refundsError } = await supabase
      .from("refunds")
      .select(
        `
        *,
        deal:deals!refunds_deal_id_fkey(
          id,
          student_name,
          deal_value,
          date_closed,
          setter_id,
          closer_id,
          setter_commission,
          closer_commission,
          setter:users!deals_setter_id_fkey(id, full_name),
          closer:users!deals_closer_id_fkey(id, full_name)
        )
      `
      )
      .order("refund_date", { ascending: false })

    if (refundsError) {
      return NextResponse.json({ error: refundsError.message }, { status: 500 })
    }

    // Flatten refund data
    const refundsWithDetails = (refunds || []).map((refund) => {
      const deal = refund.deal as Record<string, unknown> | null
      return {
        id: refund.id,
        deal_id: refund.deal_id,
        refund_date: refund.refund_date,
        refund_amount: refund.refund_amount,
        reason: refund.reason,
        setter_clawback: refund.setter_clawback,
        closer_clawback: refund.closer_clawback,
        processed_by: refund.processed_by,
        notes: refund.notes,
        created_at: refund.created_at,
        student_name: deal?.student_name ?? "Unknown",
        deal_value: deal?.deal_value ?? 0,
        date_closed: deal?.date_closed ?? "",
        setter_name:
          deal?.setter &&
          typeof deal.setter === "object" &&
          "full_name" in (deal.setter as Record<string, unknown>)
            ? (deal.setter as { full_name: string }).full_name
            : null,
        closer_name:
          deal?.closer &&
          typeof deal.closer === "object" &&
          "full_name" in (deal.closer as Record<string, unknown>)
            ? (deal.closer as { full_name: string }).full_name
            : null,
      }
    })

    // Summary stats
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0]
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0]

    const refundsThisMonth = refundsWithDetails.filter(
      (r) => r.refund_date >= monthStart && r.refund_date <= monthEnd
    )

    const totalRefundsThisMonth = refundsThisMonth.length
    const totalRefundAmount = refundsThisMonth.reduce(
      (sum, r) => sum + r.refund_amount,
      0
    )

    // Trailing 30-day refund rate
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

    const { data: recentDeals } = await supabase
      .from("deals")
      .select("id, status")
      .gte("date_closed", thirtyDaysAgoStr)

    const totalRecentDeals = (recentDeals || []).length
    const refundedRecentDeals = (recentDeals || []).filter(
      (d) => d.status === "refunded"
    ).length
    const refundRate =
      totalRecentDeals > 0 ? refundedRecentDeals / totalRecentDeals : 0

    // Total clawbacks processed
    const totalClawbacks = refundsWithDetails.reduce(
      (sum, r) => sum + r.setter_clawback + r.closer_clawback,
      0
    )

    // Refund rate trend (6 months)
    const trendData: { month: string; refundRate: number; refundCount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now)
      d.setMonth(d.getMonth() - i)
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .split("T")[0]
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        .toISOString()
        .split("T")[0]
      const monthLabel = d.toLocaleString("en-US", {
        month: "short",
        year: "2-digit",
      })

      const monthRefunds = refundsWithDetails.filter(
        (r) => r.refund_date >= mStart && r.refund_date <= mEnd
      )

      // Get deals for this month to calculate rate
      const { data: monthDeals } = await supabase
        .from("deals")
        .select("id")
        .gte("date_closed", mStart)
        .lte("date_closed", mEnd)

      const monthDealCount = (monthDeals || []).length
      const monthRefundCount = monthRefunds.length
      const monthRefundRate =
        monthDealCount > 0 ? monthRefundCount / monthDealCount : 0

      trendData.push({
        month: monthLabel,
        refundRate: Math.round(monthRefundRate * 10000) / 10000,
        refundCount: monthRefundCount,
      })
    }

    // Fetch active deals for the process refund dropdown
    const { data: activeDeals } = await supabase
      .from("deals")
      .select("id, student_name, date_closed, deal_value, setter_commission, closer_commission")
      .eq("status", "active")
      .order("date_closed", { ascending: false })

    const summary = {
      total_refunds_this_month: totalRefundsThisMonth,
      total_refund_amount: Math.round(totalRefundAmount * 100) / 100,
      refund_rate: Math.round(refundRate * 10000) / 10000,
      total_clawbacks: Math.round(totalClawbacks * 100) / 100,
    }

    return NextResponse.json({
      summary,
      refunds: refundsWithDetails,
      trendData,
      deals: activeDeals || [],
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
    const { deal_id, refund_amount, reason, notes } = body

    if (!deal_id || refund_amount === undefined || !reason) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: deal_id, refund_amount, reason",
        },
        { status: 400 }
      )
    }

    // Fetch the deal
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .select("*")
      .eq("id", deal_id)
      .single()

    if (dealError || !deal) {
      return NextResponse.json(
        { error: "Deal not found" },
        { status: 404 }
      )
    }

    if (deal.status !== "active") {
      return NextResponse.json(
        { error: "Deal is not active and cannot be refunded" },
        { status: 400 }
      )
    }

    // Calculate clawbacks
    const now = new Date()
    const dateClosed = new Date(deal.date_closed)
    const daysSinceClose = Math.floor(
      (now.getTime() - dateClosed.getTime()) / (1000 * 60 * 60 * 24)
    )

    const setterCommission = deal.setter_commission ?? 0
    const closerCommission = deal.closer_commission ?? 0

    const setterClawback = calculateClawback(setterCommission, daysSinceClose)
    const closerClawback = calculateClawback(closerCommission, daysSinceClose)
    const totalClawback = Math.round((setterClawback + closerClawback) * 100) / 100

    const refundDate = now.toISOString().split("T")[0]

    // Create refund record
    const { data: refund, error: refundError } = await supabase
      .from("refunds")
      .insert({
        deal_id,
        refund_date: refundDate,
        refund_amount: Number(refund_amount),
        reason,
        setter_clawback: setterClawback,
        closer_clawback: closerClawback,
        processed_by: user.id,
        notes: notes || null,
      })
      .select()
      .single()

    if (refundError) {
      return NextResponse.json(
        { error: refundError.message },
        { status: 500 }
      )
    }

    // Update deal status
    const { error: updateError } = await supabase
      .from("deals")
      .update({
        status: "refunded",
        clawback: true,
        clawback_amount: totalClawback,
      })
      .eq("id", deal_id)

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Create audit log entry
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "refund_processed",
      entity_type: "refund",
      entity_id: refund.id,
      changes: {
        deal_id,
        student_name: deal.student_name,
        refund_amount: Number(refund_amount),
        reason,
        setter_clawback: setterClawback,
        closer_clawback: closerClawback,
        days_since_close: daysSinceClose,
        admin_name: profile.full_name,
      },
      description: `Processed refund of $${Number(refund_amount).toFixed(2)} for ${deal.student_name}. Clawback: $${totalClawback.toFixed(2)}`,
    })

    // Create notification for admin about the refund
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "refund_alert" as const,
      title: "Refund Processed",
      message: `Refund of $${Number(refund_amount).toFixed(2)} processed for ${deal.student_name}. Total clawback: $${totalClawback.toFixed(2)}.`,
      read: false,
      link: "/admin/refunds",
      email_sent: false,
    })

    return NextResponse.json(
      {
        data: {
          ...refund,
          days_since_close: daysSinceClose,
          total_clawback: totalClawback,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
