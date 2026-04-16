import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")
    const range = searchParams.get("range")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const userId = searchParams.get("userId") || user.id

    let query = supabase
      .from("daily_activities")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })

    if (date && !range && !startDate) {
      query = query.eq("date", date)
    } else if (startDate && endDate) {
      query = query.gte("date", startDate).lte("date", endDate)
    } else if (range === "week" && startDate) {
      const weekEnd = new Date(startDate)
      weekEnd.setDate(weekEnd.getDate() + 6)
      query = query
        .gte("date", startDate)
        .lte("date", weekEnd.toISOString().split("T")[0])
    } else if (range === "month" && startDate) {
      const monthDate = new Date(startDate)
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
      query = query
        .gte("date", startDate)
        .lte("date", monthEnd.toISOString().split("T")[0])
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
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

    const body = await request.json()

    // Ensure user can only create/update their own activity
    if (body.user_id && body.user_id !== user.id) {
      return NextResponse.json(
        { error: "Cannot modify another user's activity" },
        { status: 403 }
      )
    }

    const activityData = {
      user_id: user.id,
      date: body.date,
      dials_made: body.dials_made ?? 0,
      conversations: body.conversations ?? 0,
      speed_to_lead_avg_min: body.speed_to_lead_avg_min ?? null,
      qualified_bookings: body.qualified_bookings ?? 0,
      follow_ups_completed: body.follow_ups_completed ?? 0,
      show_confirmations_sent: body.show_confirmations_sent ?? 0,
      intros_completed: body.intros_completed ?? 0,
      demos_booked_from_intros: body.demos_booked_from_intros ?? 0,
      demos_scheduled: body.demos_scheduled ?? 0,
      demos_completed: body.demos_completed ?? 0,
      offers_made: body.offers_made ?? 0,
      deals_closed: body.deals_closed ?? 0,
      cash_collected: body.cash_collected ?? 0,
      pif_deals: body.pif_deals ?? 0,
      payment_plan_deals: body.payment_plan_deals ?? 0,
      notes: body.notes || null,
    }

    // Upsert: insert or update based on user_id + date unique constraint
    const { data, error } = await supabase
      .from("daily_activities")
      .upsert(activityData, {
        onConflict: "user_id,date",
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
