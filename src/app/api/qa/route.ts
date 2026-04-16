import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { calculateSetterQAScore, calculateCloserQAScore } from "@/lib/utils"
import type { CallType } from "@/types/database"

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const repId = searchParams.get("rep_id")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const minScore = searchParams.get("minScore")
    const maxScore = searchParams.get("maxScore")
    const autoFail = searchParams.get("autoFail")

    let query = supabase
      .from("call_reviews")
      .select(
        `
        *,
        rep:users!call_reviews_rep_id_fkey(full_name, role),
        reviewer:users!call_reviews_reviewed_by_fkey(full_name)
      `
      )
      .order("date", { ascending: false })

    if (repId) {
      query = query.eq("rep_id", repId)
    }
    if (startDate) {
      query = query.gte("date", startDate)
    }
    if (endDate) {
      query = query.lte("date", endDate)
    }
    if (minScore) {
      query = query.gte("weighted_score", parseFloat(minScore))
    }
    if (maxScore) {
      query = query.lte("weighted_score", parseFloat(maxScore))
    }
    if (autoFail === "yes") {
      query = query.or(
        "auto_fail_1.eq.true,auto_fail_2.eq.true,auto_fail_3.eq.true,auto_fail_4.eq.true"
      )
    } else if (autoFail === "no") {
      query = query
        .eq("auto_fail_1", false)
        .eq("auto_fail_2", false)
        .eq("auto_fail_3", false)
        .eq("auto_fail_4", false)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const reviews = (data ?? []).map((review) => ({
      ...review,
      rep_name:
        review.rep && typeof review.rep === "object" && "full_name" in review.rep
          ? (review.rep as { full_name: string }).full_name
          : null,
      rep_role:
        review.rep && typeof review.rep === "object" && "role" in review.rep
          ? (review.rep as { role: string }).role
          : null,
      reviewer_name:
        review.reviewer &&
        typeof review.reviewer === "object" &&
        "full_name" in review.reviewer
          ? (review.reviewer as { full_name: string }).full_name
          : null,
      rep: undefined,
      reviewer: undefined,
    }))

    return NextResponse.json({ data: reviews })
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

    // Validate required fields
    if (!body.rep_id || !body.call_type || !body.date) {
      return NextResponse.json(
        { error: "Missing required fields: rep_id, call_type, date" },
        { status: 400 }
      )
    }

    const callType = body.call_type as CallType

    // Validate scores are 1-5
    const validateScore = (val: unknown, field: string): number | null => {
      if (val === null || val === undefined) return null
      const num = Number(val)
      if (isNaN(num) || num < 1 || num > 5) {
        throw new Error(`${field} must be between 1 and 5`)
      }
      return num
    }

    try {
      // Parse setter fields
      const openingRapport = validateScore(body.opening_rapport, "opening_rapport")
      const discovery = validateScore(body.discovery, "discovery")
      const budgetQualification = validateScore(body.budget_qualification, "budget_qualification")
      const transitionPitch = validateScore(body.transition_pitch, "transition_pitch")
      const bookingLogistics = validateScore(body.booking_logistics, "booking_logistics")
      const professionalism = validateScore(body.professionalism, "professionalism")

      // Parse closer fields
      const rapportFraming = validateScore(body.rapport_framing, "rapport_framing")
      const deepDiscovery = validateScore(body.deep_discovery, "deep_discovery")
      const pitchPresentation = validateScore(body.pitch_presentation, "pitch_presentation")
      const objectionHandling = validateScore(body.objection_handling, "objection_handling")
      const closeExecution = validateScore(body.close_execution, "close_execution")
      const closerProfessionalism = validateScore(body.closer_professionalism, "closer_professionalism")

      // Auto-fail flags
      const autoFail1 = Boolean(body.auto_fail_1)
      const autoFail2 = Boolean(body.auto_fail_2)
      const autoFail3 = Boolean(body.auto_fail_3)
      const autoFail4 = Boolean(body.auto_fail_4)
      const hasAutoFail = autoFail1 || autoFail2 || autoFail3 || autoFail4

      // Calculate weighted score
      let weightedScore: number | null = null

      if (callType === "setter") {
        if (
          openingRapport !== null &&
          discovery !== null &&
          budgetQualification !== null &&
          transitionPitch !== null &&
          bookingLogistics !== null &&
          professionalism !== null
        ) {
          weightedScore = calculateSetterQAScore(
            {
              opening_rapport: openingRapport,
              discovery,
              budget_qualification: budgetQualification,
              transition_pitch: transitionPitch,
              booking_logistics: bookingLogistics,
              professionalism,
            },
            hasAutoFail
          )
        }
      } else if (callType === "closer") {
        if (
          rapportFraming !== null &&
          deepDiscovery !== null &&
          pitchPresentation !== null &&
          objectionHandling !== null &&
          closeExecution !== null &&
          closerProfessionalism !== null
        ) {
          weightedScore = calculateCloserQAScore(
            {
              rapport_framing: rapportFraming,
              deep_discovery: deepDiscovery,
              pitch_presentation: pitchPresentation,
              objection_handling: objectionHandling,
              close_execution: closeExecution,
              closer_professionalism: closerProfessionalism,
            },
            hasAutoFail
          )
        }
      }

      const reviewData = {
        reviewed_by: user.id,
        rep_id: body.rep_id,
        call_type: callType,
        date: body.date,
        prospect_name: body.prospect_name || null,
        recording_link: body.recording_link || null,
        opening_rapport: openingRapport,
        discovery,
        budget_qualification: budgetQualification,
        transition_pitch: transitionPitch,
        booking_logistics: bookingLogistics,
        professionalism,
        rapport_framing: rapportFraming,
        deep_discovery: deepDiscovery,
        pitch_presentation: pitchPresentation,
        objection_handling: objectionHandling,
        close_execution: closeExecution,
        closer_professionalism: closerProfessionalism,
        auto_fail_1: autoFail1,
        auto_fail_2: autoFail2,
        auto_fail_3: autoFail3,
        auto_fail_4: autoFail4,
        weighted_score: weightedScore,
        coaching_notes: body.coaching_notes || null,
      }

      const { data: created, error: insertError } = await supabase
        .from("call_reviews")
        .insert(reviewData)
        .select()
        .single()

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }

      // Create audit log entry
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action: "create",
        entity_type: "call_review",
        entity_id: created.id,
        changes: reviewData as unknown as Record<string, unknown>,
        description: `Created ${callType} call review for rep ${body.rep_id} - Score: ${weightedScore ?? "N/A"}`,
      })

      return NextResponse.json({ data: created }, { status: 201 })
    } catch (validationError) {
      return NextResponse.json(
        {
          error:
            validationError instanceof Error
              ? validationError.message
              : "Validation error",
        },
        { status: 400 }
      )
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    )
  }
}
