import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { EarningsView } from "@/components/dashboard/earnings-view"

type EarningsSummary = {
  totalAllTime: number
  totalThisMonth: number
  totalPending: number
  totalPaid: number
}

type EarningsDeal = {
  id: string
  date: string
  studentName: string
  dealValue: number
  myCommission: number
  pifBonus: number
  payoutStatus: "Pending" | "Paid" | "Clawback"
  clawbackAmount?: number
}

export default async function EarningsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const { data: profile } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", user.id)
    .single()

  if (!profile) redirect("/login")

  // Fetch all deals where user is setter or closer
  const { data: setterDeals } = await supabase
    .from("deals")
    .select("*")
    .eq("setter_id", user.id)
    .order("date_closed", { ascending: false })

  const { data: closerDeals } = await supabase
    .from("deals")
    .select("*")
    .eq("closer_id", user.id)
    .order("date_closed", { ascending: false })

  // Deduplicate deals where user is both setter and closer
  const dealsMap = new Map<string, { deal: typeof setterDeals extends (infer T)[] | null ? T : never; roleOnDeal: "setter" | "closer" }>()

  if (setterDeals) {
    for (const deal of setterDeals) {
      dealsMap.set(`${deal.id}-setter`, { deal, roleOnDeal: "setter" })
    }
  }

  if (closerDeals) {
    for (const deal of closerDeals) {
      // If user is both setter and closer on the same deal, add both entries
      dealsMap.set(`${deal.id}-closer`, { deal, roleOnDeal: "closer" })
    }
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]

  let totalAllTime = 0
  let totalThisMonth = 0
  let totalPending = 0
  let totalPaid = 0

  const earningsDeals: EarningsDeal[] = []

  for (const [, { deal, roleOnDeal }] of dealsMap) {
    // Determine the user's commission based on their role on this deal
    const myCommission =
      roleOnDeal === "setter"
        ? deal.setter_commission ?? 0
        : deal.closer_commission ?? 0

    // PIF bonus: split evenly if both setter and closer exist, otherwise full amount
    let pifBonus = 0
    if (deal.pif_bonus > 0) {
      const hasSetter = !!deal.setter_id
      const hasCloser = !!deal.closer_id
      if (hasSetter && hasCloser) {
        pifBonus = Math.round((deal.pif_bonus / 2) * 100) / 100
      } else {
        pifBonus = deal.pif_bonus
      }
    }

    const totalEarning = myCommission + pifBonus

    // Determine payout status
    let payoutStatus: "Pending" | "Paid" | "Clawback" = "Pending"
    let clawbackAmount: number | undefined

    if (deal.clawback && deal.clawback_amount > 0) {
      payoutStatus = "Clawback"
      // Show the clawback amount relevant to this rep's role
      clawbackAmount =
        roleOnDeal === "setter"
          ? deal.clawback_amount
          : deal.clawback_amount
    } else if (deal.payout_date) {
      payoutStatus = "Paid"
    }

    // Accumulate summary stats
    if (deal.status === "active") {
      totalAllTime += totalEarning

      if (deal.date_closed >= monthStart) {
        totalThisMonth += totalEarning
      }

      if (!deal.payout_date && payoutStatus !== "Clawback") {
        totalPending += totalEarning
      }

      if (deal.payout_date && payoutStatus !== "Clawback") {
        totalPaid += totalEarning
      }
    }

    // Subtract clawback amounts from totals
    if (payoutStatus === "Clawback" && clawbackAmount) {
      totalAllTime -= clawbackAmount
    }

    earningsDeals.push({
      id: `${deal.id}-${roleOnDeal}`,
      date: deal.date_closed,
      studentName: deal.student_name,
      dealValue: deal.deal_value,
      myCommission,
      pifBonus,
      payoutStatus,
      clawbackAmount,
    })
  }

  // Sort by date descending
  earningsDeals.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  // Round summary values
  const summary: EarningsSummary = {
    totalAllTime: Math.round(totalAllTime * 100) / 100,
    totalThisMonth: Math.round(totalThisMonth * 100) / 100,
    totalPending: Math.round(totalPending * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
  }

  const userRole: "setter" | "closer" =
    profile.role === "closer" ? "closer" : "setter"

  return (
    <EarningsView
      userId={user.id}
      role={userRole}
      summary={summary}
      deals={earningsDeals}
    />
  )
}
