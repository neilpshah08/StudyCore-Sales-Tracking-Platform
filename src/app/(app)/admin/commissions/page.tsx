import { createClient } from "@/lib/supabase/server"
import { requireAdmin } from "@/lib/auth"
import { CommissionsDashboard } from "@/components/admin/commissions-dashboard"
import type { CommissionRate } from "@/types/database"

export interface CommissionSummary {
  total_owed: number
  total_paid_this_month: number
  total_clawbacks: number
}

export interface RepCommission {
  rep_id: string
  rep_name: string
  role: string
  total_deals: number
  total_commission_earned: number
  total_paid: number
  total_clawbacks: number
  total_outstanding: number
}

export interface PayoutEntry {
  id: string
  date: string
  rep_name: string
  amount_paid: number
  num_deals: number
  notes: string
  admin_name: string
}

export default async function AdminCommissionsPage() {
  await requireAdmin()
  const supabase = await createClient()

  // -------------------------------------------------------------------
  // Date ranges
  // -------------------------------------------------------------------
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]

  // -------------------------------------------------------------------
  // Parallel data fetches
  // -------------------------------------------------------------------
  const [dealsResult, repsResult, ratesResult, payoutLogsResult] =
    await Promise.all([
      supabase
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
          status
        `
        )
        .order("date_closed", { ascending: false }),

      supabase
        .from("users")
        .select("id, full_name, role")
        .neq("role", "admin"),

      supabase
        .from("commission_rates")
        .select("*")
        .order("role", { ascending: true })
        .order("min_close_rate", { ascending: true, nullsFirst: true }),

      supabase
        .from("audit_log")
        .select("*")
        .eq("action", "payout_processed")
        .order("created_at", { ascending: false })
        .limit(100),
    ])

  const deals = dealsResult.data || []
  const reps = repsResult.data || []
  const rates: CommissionRate[] = ratesResult.data || []
  const payoutLogs = payoutLogsResult.data || []

  // -------------------------------------------------------------------
  // Build per-rep breakdown
  // -------------------------------------------------------------------
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

  for (const rep of reps) {
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

  for (const deal of deals) {
    // Process setter
    if (deal.setter_id && repMap.has(deal.setter_id)) {
      const rep = repMap.get(deal.setter_id)!
      const commission =
        (deal.setter_commission ?? 0) +
        (deal.pif_bonus > 0 && deal.closer_id
          ? deal.pif_bonus / 2
          : deal.pif_bonus > 0
            ? deal.pif_bonus
            : 0)
      rep.total_deals += 1
      rep.total_commission_earned += commission

      if (deal.payout_date) {
        rep.total_paid += commission
      }

      if (deal.clawback && deal.clawback_amount > 0) {
        const totalComm =
          (deal.setter_commission ?? 0) + (deal.closer_commission ?? 0)
        const setterShare =
          totalComm > 0 ? (deal.setter_commission ?? 0) / totalComm : 0.5
        rep.total_clawbacks += deal.clawback_amount * setterShare
      }
    }

    // Process closer
    if (deal.closer_id && repMap.has(deal.closer_id)) {
      const rep = repMap.get(deal.closer_id)!
      const commission =
        (deal.closer_commission ?? 0) +
        (deal.pif_bonus > 0 && deal.setter_id
          ? deal.pif_bonus / 2
          : deal.pif_bonus > 0
            ? deal.pif_bonus
            : 0)
      rep.total_deals += 1
      rep.total_commission_earned += commission

      if (deal.payout_date) {
        rep.total_paid += commission
      }

      if (deal.clawback && deal.clawback_amount > 0) {
        const totalComm =
          (deal.setter_commission ?? 0) + (deal.closer_commission ?? 0)
        const closerShare =
          totalComm > 0 ? (deal.closer_commission ?? 0) / totalComm : 0.5
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

  const repBreakdown: RepCommission[] = Array.from(repMap.values()).map(
    (rep) => ({
      ...rep,
      total_commission_earned:
        Math.round(rep.total_commission_earned * 100) / 100,
      total_paid: Math.round(rep.total_paid * 100) / 100,
      total_clawbacks: Math.round(rep.total_clawbacks * 100) / 100,
      total_outstanding:
        Math.round(
          (rep.total_commission_earned - rep.total_paid) * 100
        ) / 100,
    })
  )

  const summary: CommissionSummary = {
    total_owed: Math.round(totalOwed * 100) / 100,
    total_paid_this_month: Math.round(totalPaidThisMonth * 100) / 100,
    total_clawbacks: Math.round(totalClawbacks * 100) / 100,
  }

  // Enrich payout logs
  const payoutLog: PayoutEntry[] = payoutLogs.map((log) => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Commission Tracker
        </h1>
        <p className="text-white/55">
          Track commission payouts, rate tiers, and rep earnings.
        </p>
      </div>
      <CommissionsDashboard
        summary={summary}
        repBreakdown={repBreakdown}
        rates={rates}
        payoutLog={payoutLog}
      />
    </div>
  )
}
