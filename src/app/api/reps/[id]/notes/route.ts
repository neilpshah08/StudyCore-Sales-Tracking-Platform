import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { NoteType } from "@/types/database"

interface RouteContext {
  params: Promise<{ id: string }>
}

const VALID_NOTE_TYPES: NoteType[] = [
  "coaching",
  "verbal_warning",
  "pip",
  "positive",
  "general",
]

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single()

    if (!adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      )
    }

    const { data: notes, error } = await supabase
      .from("rep_notes")
      .select("*")
      .eq("rep_id", id)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch author names
    const authorIds = [...new Set((notes ?? []).map((n) => n.author_id))]
    let authorMap: Record<string, string> = {}

    if (authorIds.length > 0) {
      const { data: authors } = await supabase
        .from("users")
        .select("id, full_name")
        .in("id", authorIds)

      if (authors) {
        authorMap = Object.fromEntries(
          authors.map((a) => [a.id, a.full_name])
        )
      }
    }

    const enrichedNotes = (notes ?? []).map((n) => ({
      ...n,
      author_name: authorMap[n.author_id] ?? "Unknown",
    }))

    return NextResponse.json({ data: enrichedNotes })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
      .from("users")
      .select("role, full_name")
      .eq("id", user.id)
      .single()

    if (!adminProfile || adminProfile.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden. Admin access required." },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { note_type, content } = body as {
      note_type: NoteType
      content: string
    }

    if (!note_type || !content) {
      return NextResponse.json(
        { error: "Missing required fields: note_type, content." },
        { status: 400 }
      )
    }

    if (!VALID_NOTE_TYPES.includes(note_type)) {
      return NextResponse.json(
        {
          error: `Invalid note_type. Must be one of: ${VALID_NOTE_TYPES.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Verify the rep exists
    const { data: repExists } = await supabase
      .from("users")
      .select("id")
      .eq("id", id)
      .single()

    if (!repExists) {
      return NextResponse.json(
        { error: "Rep not found." },
        { status: 404 }
      )
    }

    const { data, error } = await supabase
      .from("rep_notes")
      .insert({
        rep_id: id,
        author_id: user.id,
        note_type,
        content,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Return the note with author name
    return NextResponse.json(
      {
        data: {
          ...data,
          author_name: adminProfile.full_name,
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
