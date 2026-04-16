-- ============================================================================
-- StudyCore Sales Tracking Platform - Initial Database Schema
-- Migration: 001_initial_schema.sql
-- Description: Creates all tables, enums, indexes, RLS policies, functions,
--              triggers, views, and seed data for the sales tracking platform.
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE user_role AS ENUM ('admin', 'setter', 'closer');

CREATE TYPE user_status AS ENUM ('active', 'inactive', 'terminated');

CREATE TYPE payment_plan_type AS ENUM ('PIF', '2-pay', '3-pay', '4-pay', '6-pay');

CREATE TYPE deal_status AS ENUM ('active', 'refunded', 'chargedback');

CREATE TYPE call_type AS ENUM ('setter', 'closer');

CREATE TYPE notification_type AS ENUM (
  'deal_closed',
  'activity_reminder',
  'performance_alert',
  'speed_to_lead_alert',
  'refund_alert',
  'general'
);

CREATE TYPE note_type AS ENUM ('coaching', 'verbal_warning', 'pip', 'positive', 'general');

CREATE TYPE fulfillment_status AS ENUM (
  'pending_onboarding',
  'active',
  'paused',
  'completed',
  'cancelled'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. users
-- Primary user table, keyed by Supabase auth.users UUID.
CREATE TABLE users (
  id               UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email            TEXT UNIQUE NOT NULL,
  full_name        TEXT NOT NULL,
  role             user_role NOT NULL,
  status           user_status NOT NULL DEFAULT 'active',
  hire_date        DATE,
  termination_date DATE,
  commission_rate  DECIMAL(5,4),
  base_pay_weekly  DECIMAL(10,2),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Sales team members (admins, setters, closers)';

-- 2. daily_activity
-- Tracks daily KPIs for each rep.
CREATE TABLE daily_activity (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date                      DATE NOT NULL,
  dials_made                INT NOT NULL DEFAULT 0,
  conversations             INT NOT NULL DEFAULT 0,
  speed_to_lead_avg_min     DECIMAL(5,1),
  qualified_bookings        INT NOT NULL DEFAULT 0,
  follow_ups_completed      INT NOT NULL DEFAULT 0,
  show_confirmations_sent   INT NOT NULL DEFAULT 0,
  intros_completed          INT NOT NULL DEFAULT 0,
  demos_booked_from_intros  INT NOT NULL DEFAULT 0,
  demos_scheduled           INT NOT NULL DEFAULT 0,
  demos_completed           INT NOT NULL DEFAULT 0,
  offers_made               INT NOT NULL DEFAULT 0,
  deals_closed              INT NOT NULL DEFAULT 0,
  cash_collected            DECIMAL(10,2) NOT NULL DEFAULT 0,
  pif_deals                 INT NOT NULL DEFAULT 0,
  payment_plan_deals        INT NOT NULL DEFAULT 0,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

COMMENT ON TABLE daily_activity IS 'Daily activity metrics for setters and closers';

-- 3. deals
-- Individual closed deals with commission tracking.
CREATE TABLE deals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_closed       DATE NOT NULL,
  student_name      TEXT NOT NULL,
  parent_name       TEXT,
  setter_id         UUID REFERENCES users (id) ON DELETE SET NULL,
  closer_id         UUID REFERENCES users (id) ON DELETE SET NULL,
  deal_value        DECIMAL(10,2) NOT NULL,
  payment_plan      payment_plan_type NOT NULL,
  cash_collected    DECIMAL(10,2) NOT NULL,
  setter_commission DECIMAL(10,2),
  closer_commission DECIMAL(10,2),
  pif_bonus         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_commission  DECIMAL(10,2),
  payout_date       DATE,
  clawback          BOOLEAN NOT NULL DEFAULT FALSE,
  clawback_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  lost_reason       TEXT,
  notes             TEXT,
  status            deal_status NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE deals IS 'Closed deals with commission and payment plan details';

-- 4. call_reviews
-- Scored call reviews for setter and closer calls.
CREATE TABLE call_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewed_by           UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rep_id                UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  call_type             call_type NOT NULL,
  date                  DATE NOT NULL,
  prospect_name         TEXT,
  recording_link        TEXT,
  -- Setter scorecard fields (1-5 scale)
  opening_rapport       INT CHECK (opening_rapport BETWEEN 1 AND 5),
  discovery             INT CHECK (discovery BETWEEN 1 AND 5),
  budget_qualification  INT CHECK (budget_qualification BETWEEN 1 AND 5),
  transition_pitch      INT CHECK (transition_pitch BETWEEN 1 AND 5),
  booking_logistics     INT CHECK (booking_logistics BETWEEN 1 AND 5),
  professionalism       INT CHECK (professionalism BETWEEN 1 AND 5),
  -- Closer scorecard fields (1-5 scale)
  rapport_framing       INT CHECK (rapport_framing BETWEEN 1 AND 5),
  deep_discovery        INT CHECK (deep_discovery BETWEEN 1 AND 5),
  pitch_presentation    INT CHECK (pitch_presentation BETWEEN 1 AND 5),
  objection_handling    INT CHECK (objection_handling BETWEEN 1 AND 5),
  close_execution       INT CHECK (close_execution BETWEEN 1 AND 5),
  closer_professionalism INT CHECK (closer_professionalism BETWEEN 1 AND 5),
  -- Auto-fail flags
  auto_fail_1           BOOLEAN NOT NULL DEFAULT FALSE,
  auto_fail_2           BOOLEAN NOT NULL DEFAULT FALSE,
  auto_fail_3           BOOLEAN NOT NULL DEFAULT FALSE,
  auto_fail_4           BOOLEAN NOT NULL DEFAULT FALSE,
  -- Computed score
  weighted_score        DECIMAL(3,2),
  coaching_notes        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE call_reviews IS 'Call quality reviews with scored rubrics for setters and closers';

-- 5. commission_rates
-- Configurable commission rate tiers for setters and closers.
CREATE TABLE commission_rates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role            user_role NOT NULL CHECK (role IN ('setter', 'closer')),
  label           TEXT NOT NULL,
  rate            DECIMAL(5,4) NOT NULL,
  pif_bonus_rate  DECIMAL(5,4) NOT NULL DEFAULT 0,
  min_close_rate  DECIMAL(5,4),
  effective_date  DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE commission_rates IS 'Commission rate tiers by role and performance level';

-- 6. weekly_ad_spend
-- Weekly advertising spend tracking.
CREATE TABLE weekly_ad_spend (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start    DATE NOT NULL UNIQUE,
  spend_amount  DECIMAL(10,2) NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'Meta',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE weekly_ad_spend IS 'Weekly advertising spend by platform';

-- 7. rep_goals
-- Weekly goals assigned to each rep.
CREATE TABLE rep_goals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  week_start  DATE NOT NULL,
  goal_metric TEXT NOT NULL,
  goal_value  DECIMAL(10,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start, goal_metric)
);

COMMENT ON TABLE rep_goals IS 'Weekly performance goals per rep and metric';

-- 8. notifications
-- In-app and email notifications for users.
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  link        TEXT,
  email_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'User notifications (in-app and email)';

-- 9. refunds
-- Refund and chargeback records linked to deals.
CREATE TABLE refunds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id          UUID NOT NULL REFERENCES deals (id) ON DELETE CASCADE,
  refund_date      DATE NOT NULL,
  refund_amount    DECIMAL(10,2) NOT NULL,
  reason           TEXT NOT NULL,
  setter_clawback  DECIMAL(10,2) NOT NULL DEFAULT 0,
  closer_clawback  DECIMAL(10,2) NOT NULL DEFAULT 0,
  processed_by     UUID REFERENCES users (id) ON DELETE SET NULL,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE refunds IS 'Refund and chargeback records with clawback amounts';

-- 10. deal_fulfillment
-- Fulfillment / onboarding status for each deal.
CREATE TABLE deal_fulfillment (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id                  UUID NOT NULL UNIQUE REFERENCES deals (id) ON DELETE CASCADE,
  first_session_scheduled  BOOLEAN NOT NULL DEFAULT FALSE,
  first_session_date       DATE,
  tutor_assigned           TEXT,
  sessions_completed       INT NOT NULL DEFAULT 0,
  total_sessions_purchased INT,
  status                   fulfillment_status NOT NULL DEFAULT 'pending_onboarding',
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE deal_fulfillment IS 'Post-sale fulfillment and onboarding tracking per deal';

-- 11. rep_notes
-- Manager notes on reps (coaching, warnings, PIPs, etc.).
CREATE TABLE rep_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  note_type  note_type NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE rep_notes IS 'Manager notes on reps: coaching, warnings, PIPs, positive feedback';

-- 12. audit_log
-- Immutable audit trail for sensitive operations.
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID NOT NULL,
  changes     JSONB,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Immutable audit trail of data changes';

-- 13. app_settings
-- Global application configuration key-value store.
CREATE TABLE app_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT UNIQUE NOT NULL,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE app_settings IS 'Global application configuration settings';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- daily_activity indexes
CREATE INDEX idx_daily_activity_user_date ON daily_activity (user_id, date);
CREATE INDEX idx_daily_activity_date ON daily_activity (date);

-- deals indexes
CREATE INDEX idx_deals_date_closed ON deals (date_closed);
CREATE INDEX idx_deals_setter_id ON deals (setter_id);
CREATE INDEX idx_deals_closer_id ON deals (closer_id);
CREATE INDEX idx_deals_status ON deals (status);

-- call_reviews indexes
CREATE INDEX idx_call_reviews_rep_id ON call_reviews (rep_id);
CREATE INDEX idx_call_reviews_date ON call_reviews (date);

-- notifications indexes
CREATE INDEX idx_notifications_user_read ON notifications (user_id, read);

-- audit_log indexes
CREATE INDEX idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);

-- refunds indexes
CREATE INDEX idx_refunds_deal_id ON refunds (deal_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to users
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to weekly_ad_spend
CREATE TRIGGER trg_weekly_ad_spend_updated_at
  BEFORE UPDATE ON weekly_ad_spend
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to deal_fulfillment
CREATE TRIGGER trg_deal_fulfillment_updated_at
  BEFORE UPDATE ON deal_fulfillment
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to app_settings
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- HELPER FUNCTION: get current user's role
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- HELPER FUNCTION: check if current user is admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Leaderboard view: aggregated performance data, safe for all authenticated users.
-- Shows weekly aggregated metrics without exposing individual daily records.
CREATE OR REPLACE VIEW leaderboard_weekly AS
SELECT
  u.id AS user_id,
  u.full_name,
  u.role,
  DATE_TRUNC('week', da.date)::DATE AS week_start,
  SUM(da.dials_made) AS total_dials,
  SUM(da.conversations) AS total_conversations,
  SUM(da.qualified_bookings) AS total_bookings,
  SUM(da.demos_completed) AS total_demos_completed,
  SUM(da.offers_made) AS total_offers,
  SUM(da.deals_closed) AS total_deals_closed,
  SUM(da.cash_collected) AS total_cash_collected,
  SUM(da.pif_deals) AS total_pif_deals,
  -- Derived rates
  CASE
    WHEN SUM(da.conversations) > 0
    THEN ROUND(SUM(da.qualified_bookings)::DECIMAL / SUM(da.conversations), 4)
    ELSE 0
  END AS book_rate,
  CASE
    WHEN SUM(da.demos_completed) > 0
    THEN ROUND(SUM(da.deals_closed)::DECIMAL / SUM(da.demos_completed), 4)
    ELSE 0
  END AS close_rate
FROM users u
JOIN daily_activity da ON da.user_id = u.id
WHERE u.status = 'active'
GROUP BY u.id, u.full_name, u.role, DATE_TRUNC('week', da.date)::DATE;

COMMENT ON VIEW leaderboard_weekly IS 'Aggregated weekly performance leaderboard for all active reps';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_ad_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_fulfillment ENABLE ROW LEVEL SECURITY;
ALTER TABLE rep_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY users_admin_all ON users
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Non-admins: read all users (needed for names in UI), update own profile
CREATE POLICY users_read_all ON users
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY users_update_own ON users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- daily_activity
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY daily_activity_admin_all ON daily_activity
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Reps: read own rows
CREATE POLICY daily_activity_select_own ON daily_activity
  FOR SELECT
  USING (auth.uid() = user_id);

-- Reps: insert own rows
CREATE POLICY daily_activity_insert_own ON daily_activity
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Reps: update own rows
CREATE POLICY daily_activity_update_own ON daily_activity
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- deals
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY deals_admin_all ON deals
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Reps: read deals where they are setter or closer
CREATE POLICY deals_select_own ON deals
  FOR SELECT
  USING (auth.uid() = setter_id OR auth.uid() = closer_id);

-- ---------------------------------------------------------------------------
-- call_reviews
-- ---------------------------------------------------------------------------

-- Admins: full access (only admins can see and manage call reviews)
CREATE POLICY call_reviews_admin_all ON call_reviews
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Reps can see their own reviews (read-only)
CREATE POLICY call_reviews_select_own ON call_reviews
  FOR SELECT
  USING (auth.uid() = rep_id);

-- ---------------------------------------------------------------------------
-- commission_rates
-- ---------------------------------------------------------------------------

-- Everyone (authenticated): read access
CREATE POLICY commission_rates_read_all ON commission_rates
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins: full access (insert, update, delete)
CREATE POLICY commission_rates_admin_all ON commission_rates
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------------------------------------------------------------------------
-- weekly_ad_spend
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY weekly_ad_spend_admin_all ON weekly_ad_spend
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- All authenticated users: read access
CREATE POLICY weekly_ad_spend_read_all ON weekly_ad_spend
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- rep_goals
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY rep_goals_admin_all ON rep_goals
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Reps: read own goals
CREATE POLICY rep_goals_select_own ON rep_goals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Reps: insert own goals
CREATE POLICY rep_goals_insert_own ON rep_goals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Reps: update own goals
CREATE POLICY rep_goals_update_own ON rep_goals
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY notifications_admin_all ON notifications
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Reps: read own notifications
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Reps: update own notifications (mark as read)
CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- refunds
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY refunds_admin_all ON refunds
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Reps: read refunds on their deals
CREATE POLICY refunds_select_own ON refunds
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = refunds.deal_id
        AND (d.setter_id = auth.uid() OR d.closer_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- deal_fulfillment
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY deal_fulfillment_admin_all ON deal_fulfillment
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- Reps: read fulfillment on their deals
CREATE POLICY deal_fulfillment_select_own ON deal_fulfillment
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_fulfillment.deal_id
        AND (d.setter_id = auth.uid() OR d.closer_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- rep_notes
-- ---------------------------------------------------------------------------

-- Admins: full access
CREATE POLICY rep_notes_admin_all ON rep_notes
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---------------------------------------------------------------------------
-- audit_log
-- ---------------------------------------------------------------------------

-- Admins: read-only (audit logs are insert-only via functions)
CREATE POLICY audit_log_admin_select ON audit_log
  FOR SELECT
  USING (is_admin());

-- Any authenticated user can insert audit log entries (via triggers/functions)
CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- app_settings
-- ---------------------------------------------------------------------------

-- All authenticated users: read access
CREATE POLICY app_settings_read_all ON app_settings
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Admins: full access
CREATE POLICY app_settings_admin_all ON app_settings
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Commission rates
INSERT INTO commission_rates (role, label, rate, pif_bonus_rate, min_close_rate, effective_date)
VALUES
  ('setter', 'Setter base', 0.0500, 0.0300, NULL, '2024-01-01'),
  ('closer', 'Closer base', 0.1000, 0.0300, NULL, '2024-01-01'),
  ('closer', 'Closer 30%+', 0.1200, 0.0300, 0.3000, '2024-01-01'),
  ('closer', 'Closer 40%+', 0.1500, 0.0300, 0.4000, '2024-01-01');

-- Default application settings
INSERT INTO app_settings (key, value) VALUES
  ('leaderboard_mode', '"named"'),
  ('setter_weekly_dials_target', '350'),
  ('setter_weekly_conversations_target', '40'),
  ('setter_weekly_bookings_target', '20'),
  ('setter_contact_rate_target', '0.50'),
  ('setter_book_rate_target', '0.40'),
  ('setter_intro_demo_rate_target', '0.60'),
  ('closer_weekly_demos_target', '15'),
  ('closer_weekly_cash_target', '30000'),
  ('closer_close_rate_target', '0.30'),
  ('closer_offer_rate_target', '0.85'),
  ('closer_avg_deal_size_target', '5000'),
  ('monthly_revenue_target', '150000');
