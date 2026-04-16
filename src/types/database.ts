// ============================================================================
// StudyCore Sales Tracking Platform - Database Types
// Auto-generated from 001_initial_schema.sql
// ============================================================================

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'setter' | 'closer';

export type UserStatus = 'active' | 'inactive' | 'terminated';

export type PaymentPlanType = 'PIF' | '2-pay' | '3-pay' | '4-pay' | '6-pay';

export type DealStatus = 'active' | 'refunded' | 'chargedback';

export type CallType = 'setter' | 'closer';

export type NotificationType =
  | 'deal_closed'
  | 'activity_reminder'
  | 'performance_alert'
  | 'speed_to_lead_alert'
  | 'refund_alert'
  | 'general';

export type NoteType = 'coaching' | 'verbal_warning' | 'pip' | 'positive' | 'general';

export type FulfillmentStatus =
  | 'pending_onboarding'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled';

// ---------------------------------------------------------------------------
// Table Interfaces
// ---------------------------------------------------------------------------

/** Sales team members (admins, setters, closers) */
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  hire_date: string | null;
  termination_date: string | null;
  commission_rate: number | null;
  base_pay_weekly: number | null;
  created_at: string;
  updated_at: string;
}

/** Daily activity metrics for setters and closers */
export interface DailyActivity {
  id: string;
  user_id: string;
  date: string;
  dials_made: number;
  conversations: number;
  speed_to_lead_avg_min: number | null;
  qualified_bookings: number;
  follow_ups_completed: number;
  show_confirmations_sent: number;
  intros_completed: number;
  demos_booked_from_intros: number;
  demos_scheduled: number;
  demos_completed: number;
  offers_made: number;
  deals_closed: number;
  cash_collected: number;
  pif_deals: number;
  payment_plan_deals: number;
  notes: string | null;
  created_at: string;
}

/** Closed deals with commission and payment plan details */
export interface Deal {
  id: string;
  date_closed: string;
  student_name: string;
  parent_name: string | null;
  setter_id: string | null;
  closer_id: string | null;
  deal_value: number;
  payment_plan: PaymentPlanType;
  cash_collected: number;
  setter_commission: number | null;
  closer_commission: number | null;
  pif_bonus: number;
  total_commission: number | null;
  payout_date: string | null;
  clawback: boolean;
  clawback_amount: number;
  lost_reason: string | null;
  notes: string | null;
  status: DealStatus;
  created_at: string;
}

/** Call quality reviews with scored rubrics for setters and closers */
export interface CallReview {
  id: string;
  reviewed_by: string;
  rep_id: string;
  call_type: CallType;
  date: string;
  prospect_name: string | null;
  recording_link: string | null;
  // Setter scorecard fields (1-5 scale)
  opening_rapport: number | null;
  discovery: number | null;
  budget_qualification: number | null;
  transition_pitch: number | null;
  booking_logistics: number | null;
  professionalism: number | null;
  // Closer scorecard fields (1-5 scale)
  rapport_framing: number | null;
  deep_discovery: number | null;
  pitch_presentation: number | null;
  objection_handling: number | null;
  close_execution: number | null;
  closer_professionalism: number | null;
  // Auto-fail flags
  auto_fail_1: boolean;
  auto_fail_2: boolean;
  auto_fail_3: boolean;
  auto_fail_4: boolean;
  // Computed score
  weighted_score: number | null;
  coaching_notes: string | null;
  created_at: string;
}

/** Commission rate tiers by role and performance level */
export interface CommissionRate {
  id: string;
  role: UserRole;
  label: string;
  rate: number;
  pif_bonus_rate: number;
  min_close_rate: number | null;
  effective_date: string;
  created_at: string;
}

/** Weekly advertising spend by platform */
export interface WeeklyAdSpend {
  id: string;
  week_start: string;
  spend_amount: number;
  platform: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Weekly performance goals per rep and metric */
export interface RepGoal {
  id: string;
  user_id: string;
  week_start: string;
  goal_metric: string;
  goal_value: number;
  created_at: string;
}

/** User notifications (in-app and email) */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  link: string | null;
  email_sent: boolean;
  created_at: string;
}

/** Refund and chargeback records with clawback amounts */
export interface Refund {
  id: string;
  deal_id: string;
  refund_date: string;
  refund_amount: number;
  reason: string;
  setter_clawback: number;
  closer_clawback: number;
  processed_by: string | null;
  notes: string | null;
  created_at: string;
}

/** Post-sale fulfillment and onboarding tracking per deal */
export interface DealFulfillment {
  id: string;
  deal_id: string;
  first_session_scheduled: boolean;
  first_session_date: string | null;
  tutor_assigned: string | null;
  sessions_completed: number;
  total_sessions_purchased: number | null;
  status: FulfillmentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Manager notes on reps: coaching, warnings, PIPs, positive feedback */
export interface RepNote {
  id: string;
  rep_id: string;
  author_id: string;
  note_type: NoteType;
  content: string;
  created_at: string;
}

/** Immutable audit trail of data changes */
export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, unknown> | null;
  description: string | null;
  created_at: string;
}

/** Global application configuration settings */
export interface AppSetting {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert Types (omit server-generated fields)
// ---------------------------------------------------------------------------

export type UserInsert = Omit<User, 'created_at' | 'updated_at'>;
export type UserUpdate = Partial<Omit<UserInsert, 'id'>>;

export type DailyActivityInsert = Omit<DailyActivity, 'id' | 'created_at'>;
export type DailyActivityUpdate = Partial<Omit<DailyActivityInsert, 'user_id' | 'date'>>;

export type DealInsert = Omit<Deal, 'id' | 'created_at'>;
export type DealUpdate = Partial<DealInsert>;

export type CallReviewInsert = Omit<CallReview, 'id' | 'created_at'>;
export type CallReviewUpdate = Partial<CallReviewInsert>;

export type CommissionRateInsert = Omit<CommissionRate, 'id' | 'created_at'>;
export type CommissionRateUpdate = Partial<CommissionRateInsert>;

export type WeeklyAdSpendInsert = Omit<WeeklyAdSpend, 'id' | 'created_at' | 'updated_at'>;
export type WeeklyAdSpendUpdate = Partial<WeeklyAdSpendInsert>;

export type RepGoalInsert = Omit<RepGoal, 'id' | 'created_at'>;
export type RepGoalUpdate = Partial<RepGoalInsert>;

export type NotificationInsert = Omit<Notification, 'id' | 'created_at'>;
export type NotificationUpdate = Partial<Omit<NotificationInsert, 'user_id' | 'type'>>;

export type RefundInsert = Omit<Refund, 'id' | 'created_at'>;
export type RefundUpdate = Partial<RefundInsert>;

export type DealFulfillmentInsert = Omit<DealFulfillment, 'id' | 'created_at' | 'updated_at'>;
export type DealFulfillmentUpdate = Partial<Omit<DealFulfillmentInsert, 'deal_id'>>;

export type RepNoteInsert = Omit<RepNote, 'id' | 'created_at'>;
export type RepNoteUpdate = Partial<Omit<RepNoteInsert, 'rep_id' | 'author_id'>>;

export type AuditLogInsert = Omit<AuditLog, 'id' | 'created_at'>;

export type AppSettingInsert = Omit<AppSetting, 'id' | 'updated_at'>;
export type AppSettingUpdate = Partial<AppSettingInsert>;

// ---------------------------------------------------------------------------
// View Types
// ---------------------------------------------------------------------------

/** Aggregated weekly performance leaderboard for all active reps */
export interface LeaderboardWeekly {
  user_id: string;
  full_name: string;
  role: UserRole;
  week_start: string;
  total_dials: number;
  total_conversations: number;
  total_bookings: number;
  total_demos_completed: number;
  total_offers: number;
  total_deals_closed: number;
  total_cash_collected: number;
  total_pif_deals: number;
  book_rate: number;
  close_rate: number;
}
