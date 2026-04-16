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
    const weekStart = searchParams.get("week_start")
    const userId = searchParams.get("userId") || user.id

    let query = supabase
      .from("rep_goals")
      .select("*")
      .eq("user_id", userId)

    if (weekStart) {
      query = query.eq("week_start", weekStart)
    }

    const { data, error } = await query.order("created_at", { ascending: false })

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

    // Ensure user can only create/update their own goals
    if (body.user_id && body.user_id !== user.id) {
      return NextResponse.json(
        { error: "Cannot modify another user's goals" },
        { status: 403 }
      )
    }

    const { week_start, goal_metric, goal_value } = body

    if (!week_start || !goal_metric || goal_value === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: week_start, goal_metric, goal_value" },
        { status: 400 }
      )
    }

    const goalData = {
      user_id: user.id,
      week_start,
      goal_metric,
      goal_value: Number(goal_value),
    }

    // Upsert: insert or update based on user_id + week_start + goal_metric unique constraint
    const { data, error } = await supabase
      .from("rep_goals")
      .upsert(goalData, {
        onConflict: "user_id,week_start,goal_metric",
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
