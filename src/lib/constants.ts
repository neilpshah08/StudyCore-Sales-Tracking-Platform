export const COLORS = {
  navy: '#1B2A4A',
  sidebar: '#1B2A4A',
  positive: '#16A34A',
  negative: '#DC2626',
  warning: '#F59E0B',
  interactive: '#3B82F6',
  background: '#FFFFFF',
  muted: '#F3F4F6',
} as const

export const SETTER_WEIGHTS = {
  opening_rapport: 0.15,
  discovery: 0.30,
  budget_qualification: 0.15,
  transition_pitch: 0.15,
  booking_logistics: 0.10,
  professionalism: 0.15,
} as const

export const CLOSER_WEIGHTS = {
  rapport_framing: 0.10,
  deep_discovery: 0.25,
  pitch_presentation: 0.20,
  objection_handling: 0.20,
  close_execution: 0.15,
  closer_professionalism: 0.10,
} as const

export const DEFAULT_BENCHMARKS = {
  setter_weekly_dials: 350,
  setter_weekly_conversations: 40,
  setter_weekly_bookings: 20,
  setter_contact_rate: 0.50,
  setter_book_rate: 0.40,
  setter_intro_demo_rate: 0.60,
  closer_weekly_demos: 15,
  closer_weekly_cash: 30000,
  closer_close_rate: 0.30,
  closer_offer_rate: 0.85,
  closer_avg_deal_size: 5000,
  monthly_revenue_target: 150000,
} as const

export const REFUND_REASONS = [
  'Unhappy with service',
  'Student not engaged',
  'Financial hardship',
  'Found alternative',
  "Didn't start sessions",
  'Other',
] as const

export const PAYMENT_PLANS = ['PIF', '2-pay', '3-pay', '4-pay', '6-pay'] as const
