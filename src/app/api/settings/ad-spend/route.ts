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

    let query = supabase
      .from("weekly_ad_spend")
      .select("*")
      .order("week_start", { ascending: false })

    if (startDate) {
      query = query.gte("week_start", startDate)
    }
    if (endDate) {
      query = query.lte("week_start", endDate)
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

    const { week_start, spend_amount, platform, notes } = body

    if (!week_start || spend_amount === undefined || spend_amount === null) {
      return NextResponse.json(
        { error: "week_start and spend_amount are required" },
        { status: 400 }
      )
    }

    if (typeof spend_amount !== "number" || spend_amount < 0) {
      return NextResponse.json(
        { error: "spend_amount must be a non-negative number" },
        { status: 400 }
      )
    }

    // Upsert based on week_start + platform
    const { data, error } = await supabase
      .from("weekly_ad_spend")
      .upsert(
        {
          week_start,
          spend_amount,
          platform: platform || "Meta",
          notes: notes || null,
        },
        {
          onConflict: "week_start,platform",
        }
      )
      .select()
      .single()

    if (error) {
      // If upsert with composite key fails, try without onConflict
      const { data: insertData, error: insertError } = await supabase
        .from("weekly_ad_spend")
        .insert({
          week_start,
          spend_amount,
          platform: platform || "Meta",
          notes: notes || null,
        })
        .select()
        .single()

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      return NextResponse.json({ data: insertData })
    }

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
