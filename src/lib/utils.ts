import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric' })
}

export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export function getMonthStart(date: Date = new Date()): string {
  const d = new Date(date)
  d.setDate(1)
  return d.toISOString().split('T')[0]
}

export function getMonthEnd(date: Date = new Date()): string {
  const d = new Date(date)
  d.setMonth(d.getMonth() + 1)
  d.setDate(0)
  return d.toISOString().split('T')[0]
}

// Calculate streak from daily activity records
export function calculateStreak(activities: { date: string; hasActivity: boolean }[]): { current: number; longest: number } {
  // Sort by date descending
  const sorted = [...activities].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  let current = 0
  let longest = 0
  let tempStreak = 0

  // Check current streak (count from today backwards, skipping weekends if not historically logged)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const activity of sorted) {
    if (activity.hasActivity) {
      tempStreak++
    } else {
      const dayOfWeek = new Date(activity.date).getDay()
      if (dayOfWeek === 0 || dayOfWeek === 6) continue // skip weekends
      break
    }
  }
  current = tempStreak

  // Calculate longest streak
  tempStreak = 0
  for (const activity of sorted.reverse()) {
    if (activity.hasActivity) {
      tempStreak++
      longest = Math.max(longest, tempStreak)
    } else {
      const dayOfWeek = new Date(activity.date).getDay()
      if (dayOfWeek === 0 || dayOfWeek === 6) continue
      tempStreak = 0
    }
  }

  return { current, longest }
}

// Get flame emoji based on streak
export function getStreakFlame(streak: number): string {
  if (streak <= 0) return ''
  if (streak <= 6) return '\u{1F525}'
  if (streak <= 13) return '\u{1F525}\u{1F525}'
  if (streak <= 29) return '\u{1F525}\u{1F525}\u{1F525}'
  return `\u{1F499}\u{1F525} ${streak}`
}

// Commission calculation helpers
export function calculateSetterCommission(dealValue: number, rate: number): number {
  return Math.round(dealValue * rate * 100) / 100
}

export function calculateCloserCommission(dealValue: number, closeRate: number, tiers: { rate: number; minCloseRate: number | null }[]): number {
  const sortedTiers = [...tiers].sort((a, b) => (b.minCloseRate || 0) - (a.minCloseRate || 0))
  for (const tier of sortedTiers) {
    if (tier.minCloseRate === null || closeRate >= tier.minCloseRate) {
      return Math.round(dealValue * tier.rate * 100) / 100
    }
  }
  return 0
}

export function calculatePifBonus(dealValue: number, pifBonusRate: number, isPif: boolean): number {
  if (!isPif) return 0
  return Math.round(dealValue * pifBonusRate * 100) / 100
}

// Weighted QA Score calculation
export function calculateSetterQAScore(scores: {
  opening_rapport: number; discovery: number; budget_qualification: number;
  transition_pitch: number; booking_logistics: number; professionalism: number;
}, hasAutoFail: boolean): number {
  if (hasAutoFail) return 0
  return Math.round((
    scores.opening_rapport * 0.15 +
    scores.discovery * 0.30 +
    scores.budget_qualification * 0.15 +
    scores.transition_pitch * 0.15 +
    scores.booking_logistics * 0.10 +
    scores.professionalism * 0.15
  ) * 100) / 100
}

export function calculateCloserQAScore(scores: {
  rapport_framing: number; deep_discovery: number; pitch_presentation: number;
  objection_handling: number; close_execution: number; closer_professionalism: number;
}, hasAutoFail: boolean): number {
  if (hasAutoFail) return 0
  return Math.round((
    scores.rapport_framing * 0.10 +
    scores.deep_discovery * 0.25 +
    scores.pitch_presentation * 0.20 +
    scores.objection_handling * 0.20 +
    scores.close_execution * 0.15 +
    scores.closer_professionalism * 0.10
  ) * 100) / 100
}

// Clawback calculation
export function calculateClawback(commission: number, daysSinceClose: number): number {
  if (daysSinceClose <= 14) return commission // full clawback
  if (daysSinceClose <= 90) {
    const remaining = (90 - daysSinceClose) / 90
    return Math.round(commission * remaining * 100) / 100
  }
  return 0 // no clawback after 90 days
}

// CSV export helper
export function exportToCsv(data: Record<string, unknown>[], filename: string): void {
  // Will use papaparse on the client side - this is just the trigger function
  if (typeof window === 'undefined') return
  import('papaparse').then(Papa => {
    const csv = Papa.unparse(data)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  })
}
