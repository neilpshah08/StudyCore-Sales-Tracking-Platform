"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { cn, formatCurrency, formatPercent } from "@/lib/utils"
import { Plus, Minus, Clock, Loader2 } from "lucide-react"
import type { DailyActivity } from "@/types/database"
import type { AggregatedMetrics } from "@/components/dashboard/scorecard"

interface TallyField {
  key: string
  label: string
  emoji: string
}

const SETTER_TALLIES: TallyField[] = [
  { key: "dials_made", label: "Dials", emoji: "📞" },
  { key: "conversations", label: "Conversations", emoji: "💬" },
  { key: "qualified_bookings", label: "Bookings Set", emoji: "📅" },
  { key: "follow_ups_completed", label: "Follow-Ups", emoji: "🔄" },
  { key: "show_confirmations_sent", label: "Show Confirms", emoji: "✅" },
  { key: "intros_completed", label: "Intros Done", emoji: "🤝" },
  { key: "demos_booked_from_intros", label: "Demos Booked", emoji: "🎯" },
]

const CLOSER_TALLIES: TallyField[] = [
  { key: "demos_completed", label: "Demos Done", emoji: "🎬" },
  { key: "offers_made", label: "Offers Made", emoji: "💰" },
]

interface DealStats {
  deals_closed: number
  cash_collected: number
  pif_deals: number
  payment_plan_deals: number
}

interface Benchmark {
  label: string
  current: number
  target: number
  format: "number" | "currency" | "percent"
}

interface Props {
  userId: string
  role: "setter" | "closer"
  existingData: DailyActivity | null
  date: string
  dealStats?: DealStats
  weekData: AggregatedMetrics
  benchmarks: Record<string, number>
}

const OFFLINE_QUEUE_KEY = "studycore_tally_queue"

export function TallyDashboard({
  userId,
  role,
  existingData,
  date,
  dealStats,
  weekData,
  benchmarks,
}: Props) {
  const tallies = role === "setter" ? SETTER_TALLIES : CLOSER_TALLIES

  const [counts, setCounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const t of tallies) {
      initial[t.key] = (existingData as unknown as Record<string, number> | null)?.[t.key] ?? 0
    }
    return initial
  })

  const [speedToLead, setSpeedToLead] = useState(
    existingData?.speed_to_lead_avg_min ?? 0
  )
  const [notes, setNotes] = useState(existingData?.notes ?? "")
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const saveTimer = useRef<NodeJS.Timeout | null>(null)
  const pendingRef = useRef<Record<string, number>>({})

  const weekDataRecord: Record<string, number> = Object.fromEntries(
    Object.entries(weekData).map(([k, v]) => [k, v as number])
  )

  const [liveWeekTotals, setLiveWeekTotals] = useState<Record<string, number>>(() => ({ ...weekDataRecord }))

  useEffect(() => {
    const totals = { ...weekDataRecord }
    for (const t of tallies) {
      const savedToday = (existingData as unknown as Record<string, number> | null)?.[t.key] ?? 0
      totals[t.key] = (totals[t.key] ?? 0) - savedToday + (counts[t.key] ?? 0)
    }
    setLiveWeekTotals(totals)
  }, [counts])

  const saveToApi = useCallback(
    async (newCounts: Record<string, number>, extraFields?: Record<string, unknown>) => {
      setSaving(true)
      try {
        const body: Record<string, unknown> = {
          user_id: userId,
          date,
          ...newCounts,
          ...(extraFields || {}),
        }

        const res = await fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (!res.ok) throw new Error("Save failed")

        setLastSaved(new Date())
        if (typeof window !== "undefined") {
          localStorage.removeItem(OFFLINE_QUEUE_KEY)
        }
      } catch {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            OFFLINE_QUEUE_KEY,
            JSON.stringify({ userId, date, counts: newCounts, extraFields, timestamp: Date.now() })
          )
        }
      } finally {
        setSaving(false)
      }
    },
    [userId, date]
  )

  const debouncedSave = useCallback(
    (newCounts: Record<string, number>) => {
      pendingRef.current = newCounts
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveToApi(pendingRef.current, {
          notes: notes || null,
          speed_to_lead_avg_min: role === "setter" ? speedToLead : null,
        })
      }, 600)
    },
    [saveToApi, notes, speedToLead, role]
  )

  useEffect(() => {
    if (typeof window === "undefined") return
    const queued = localStorage.getItem(OFFLINE_QUEUE_KEY)
    if (queued) {
      try {
        const data = JSON.parse(queued)
        if (data.userId === userId && data.date === date) {
          saveToApi(data.counts, data.extraFields)
        }
      } catch { /* ignore corrupt data */ }
    }
  }, [userId, date, saveToApi])

  function handleTap(key: string, delta: number) {
    setCounts((prev) => {
      const newVal = Math.max(0, (prev[key] ?? 0) + delta)
      const newCounts = { ...prev, [key]: newVal }
      debouncedSave(newCounts)
      return newCounts
    })
  }

  const notesTimer = useRef<NodeJS.Timeout | null>(null)
  function handleNotesChange(value: string) {
    setNotes(value)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => {
      saveToApi(counts, {
        notes: value || null,
        speed_to_lead_avg_min: role === "setter" ? speedToLead : null,
      })
    }, 1500)
  }

  function handleSpeedToLeadChange(value: string) {
    const num = parseFloat(value) || 0
    setSpeedToLead(num)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveToApi(counts, {
        notes: notes || null,
        speed_to_lead_avg_min: num,
      })
    }, 1000)
  }

  const progressBars: Benchmark[] = role === "setter" ? [
    { label: "Dials", current: liveWeekTotals.dials_made ?? 0, target: benchmarks.setter_weekly_dials ?? 350, format: "number" },
    { label: "Conversations", current: liveWeekTotals.conversations ?? 0, target: benchmarks.setter_weekly_conversations ?? 40, format: "number" },
    { label: "Bookings", current: liveWeekTotals.qualified_bookings ?? 0, target: benchmarks.setter_weekly_bookings ?? 20, format: "number" },
    { label: "Contact Rate", current: (liveWeekTotals.dials_made ?? 0) > 0 ? (liveWeekTotals.conversations ?? 0) / (liveWeekTotals.dials_made ?? 1) : 0, target: benchmarks.setter_contact_rate ?? 0.5, format: "percent" },
    { label: "Book Rate", current: (liveWeekTotals.conversations ?? 0) > 0 ? (liveWeekTotals.qualified_bookings ?? 0) / (liveWeekTotals.conversations ?? 1) : 0, target: benchmarks.setter_book_rate ?? 0.4, format: "percent" },
  ] : [
    { label: "Demos Done", current: liveWeekTotals.demos_completed ?? 0, target: benchmarks.closer_weekly_demos ?? 15, format: "number" },
    { label: "Cash Collected", current: (dealStats?.cash_collected ?? 0) + (weekData.cash_collected ?? 0) - ((existingData?.cash_collected ?? 0)), target: benchmarks.closer_weekly_cash ?? 30000, format: "currency" },
    { label: "Close Rate", current: (liveWeekTotals.demos_completed ?? 0) > 0 ? (dealStats?.deals_closed ?? 0) / (liveWeekTotals.demos_completed ?? 1) : 0, target: benchmarks.closer_close_rate ?? 0.3, format: "percent" },
  ]

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between text-xs text-white/55 px-1">
        <span>
          {saving ? (
            <span className="flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>
          ) : lastSaved ? (
            `Saved ${lastSaved.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          ) : (
            "Auto-saves on each tap"
          )}
        </span>
        <span className="font-medium metric-number text-white/70">{date}</span>
      </div>

      {/* Tally Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {tallies.map((t) => (
          <TallyCard
            key={t.key}
            label={t.label}
            emoji={t.emoji}
            count={counts[t.key] ?? 0}
            onIncrement={() => handleTap(t.key, 1)}
            onDecrement={() => handleTap(t.key, -1)}
          />
        ))}
      </div>

      {/* Closer deal stats (read-only, auto-populated) */}
      {role === "closer" && dealStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ReadOnlyStatCard label="Deals Closed" value={String(dealStats.deals_closed)} emoji="🏆" />
          <ReadOnlyStatCard label="Cash Collected" value={formatCurrency(dealStats.cash_collected)} emoji="💵" highlight />
          <ReadOnlyStatCard label="PIF Deals" value={String(dealStats.pif_deals)} emoji="⭐" />
          <ReadOnlyStatCard label="Payment Plans" value={String(dealStats.payment_plan_deals)} emoji="📋" />
        </div>
      )}

      {/* Speed to Lead (setter only) */}
      {role === "setter" && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-4">
              <Clock className="h-5 w-5 text-white/60 flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-sm font-medium">Speed to Lead (avg minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={speedToLead || ""}
                  onChange={(e) => handleSpeedToLeadChange(e.target.value)}
                  placeholder="Enter at end of day"
                  className="mt-1 h-11"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Scorecard Progress */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <p className="text-xs uppercase tracking-wider font-semibold text-white/55 mb-3">This Week vs Benchmarks</p>
          <div className="space-y-3">
            {progressBars.map((b) => {
              const pct = b.target > 0 ? Math.min((b.current / b.target) * 100, 100) : 0
              const atTarget = b.current >= b.target
              const nearTarget = b.current >= b.target * 0.85

              let displayValue: string
              if (b.format === "currency") displayValue = formatCurrency(b.current)
              else if (b.format === "percent") displayValue = formatPercent(b.current)
              else displayValue = String(Math.round(b.current))

              let displayTarget: string
              if (b.format === "currency") displayTarget = formatCurrency(b.target)
              else if (b.format === "percent") displayTarget = formatPercent(b.target)
              else displayTarget = String(b.target)

              return (
                <div key={b.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-white/85">{b.label}</span>
                    <span className={cn(
                      "metric-number",
                      atTarget ? "text-[#10B981] font-bold" : nearTarget ? "text-[#F59E0B]" : "text-white/55"
                    )}>
                      {displayValue} / {displayTarget}
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className="h-2"
                    indicatorClassName={cn(
                      atTarget ? "progress-fill-green" : nearTarget ? "progress-fill-yellow" : "progress-fill-blue"
                    )}
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <Label className="text-sm font-medium">Notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Optional notes..."
            rows={2}
            className="mt-1"
          />
        </CardContent>
      </Card>
    </div>
  )
}

// --- Tally Card subcomponent ---

function TallyCard({
  label,
  emoji,
  count,
  onIncrement,
  onDecrement,
}: {
  label: string
  emoji: string
  count: number
  onIncrement: () => void
  onDecrement: () => void
}) {
  return (
    <div className="glass-card p-4 flex flex-col items-center text-center">
      <span className="text-2xl">{emoji}</span>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-white/55 mt-1.5 leading-tight">
        {label}
      </p>
      <p className="metric-number text-4xl font-bold text-white mt-1.5 mb-3">
        {count}
      </p>
      <div className="flex items-center gap-2.5 mt-auto">
        <button
          type="button"
          onClick={onDecrement}
          disabled={count <= 0}
          className="tally-btn tally-btn-minus disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onIncrement}
          className="tally-btn"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}

// --- Read-only stat card ---

function ReadOnlyStatCard({
  label,
  value,
  emoji,
  highlight,
}: {
  label: string
  emoji: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className={cn(
      "glass-card p-3 text-center",
      highlight && "border-[#10B981]/30 shadow-[0_0_24px_rgba(16,185,129,0.15)]"
    )}>
      <span className="text-lg">{emoji}</span>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-white/55 mt-1">
        {label}
      </p>
      <p className={cn(
        "metric-number text-xl font-bold mt-0.5",
        highlight ? "text-[#10B981]" : "text-white"
      )}>
        {value}
      </p>
    </div>
  )
}
