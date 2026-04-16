import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params

    const { data, error } = await supabase
      .from("call_reviews")
      .select(
        `
        *,
        rep:users!call_reviews_rep_id_fkey(full_name, role),
        reviewer:users!call_reviews_reviewed_by_fkey(full_name)
      `
      )
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Review not found" }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const review = {
      ...data,
      rep_name:
        data.rep && typeof data.rep === "object" && "full_name" in data.rep
          ? (data.rep as { full_name: string }).full_name
          : null,
      rep_role:
        data.rep && typeof data.rep === "object" && "role" in data.rep
          ? (data.rep as { role: string }).role
          : null,
      reviewer_name:
        data.reviewer &&
        typeof data.reviewer === "object" &&
        "full_name" in data.reviewer
          ? (data.reviewer as { full_name: string }).full_name
          : null,
      rep: undefined,
      reviewer: undefined,
    }

    return NextResponse.json({ data: review })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
