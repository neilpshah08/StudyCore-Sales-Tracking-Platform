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

    const { data: rates, error } = await supabase
      .from("commission_rates")
      .select("*")
      .order("role", { ascending: true })
      .order("min_close_rate", { ascending: true, nullsFirst: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: rates })
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
      .select("role")
      .eq("id", user.id)
      .single()

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { role, label, rate, pif_bonus_rate, min_close_rate, effective_date } =
      body

    if (!role || !label || rate === undefined || pif_bonus_rate === undefined || !effective_date) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: role, label, rate, pif_bonus_rate, effective_date",
        },
        { status: 400 }
      )
    }

    const { data: created, error: insertError } = await supabase
      .from("commission_rates")
      .insert({
        role,
        label,
        rate: Number(rate),
        pif_bonus_rate: Number(pif_bonus_rate),
        min_close_rate: min_close_rate != null ? Number(min_close_rate) : null,
        effective_date,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "create",
      entity_type: "commission_rate",
      entity_id: created.id,
      changes: body as Record<string, unknown>,
      description: `Created commission rate tier: ${label} for ${role}`,
    })

    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    const { id, ...updateFields } = body

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = {}
    if (updateFields.role !== undefined) updateData.role = updateFields.role
    if (updateFields.label !== undefined) updateData.label = updateFields.label
    if (updateFields.rate !== undefined) updateData.rate = Number(updateFields.rate)
    if (updateFields.pif_bonus_rate !== undefined)
      updateData.pif_bonus_rate = Number(updateFields.pif_bonus_rate)
    if (updateFields.min_close_rate !== undefined)
      updateData.min_close_rate =
        updateFields.min_close_rate != null
          ? Number(updateFields.min_close_rate)
          : null
    if (updateFields.effective_date !== undefined)
      updateData.effective_date = updateFields.effective_date

    const { data: updated, error: updateError } = await supabase
      .from("commission_rates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "update",
      entity_type: "commission_rate",
      entity_id: id,
      changes: updateData,
      description: `Updated commission rate tier: ${updated.label}`,
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
