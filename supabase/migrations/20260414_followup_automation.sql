-- Follow-Up Automation Overhaul
-- Adds: 3 modes, custom cadence templates, lead-type branching, TCPA engine, approval queue

-- ── 1. Extend follow_ups table ──
ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS automation_mode text DEFAULT 'full_auto'
    CHECK (automation_mode IN ('full_auto', 'approval_required', 'manual')),
  ADD COLUMN IF NOT EXISTS cadence_template text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'auto_approved'
    CHECK (approval_status IN ('none', 'pending', 'approved', 'rejected', 'auto_approved')),
  ADD COLUMN IF NOT EXISTS approval_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS lead_timezone text,
  ADD COLUMN IF NOT EXISTS quiet_hours_deferred_to timestamptz,
  ADD COLUMN IF NOT EXISTS original_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS lead_type text;

-- Backfill: existing rows are auto_approved (don't break in-flight sequences)
UPDATE follow_ups SET approval_status = 'auto_approved' WHERE approval_status IS NULL OR approval_status = 'none';

-- Indexes for queue queries
CREATE INDEX IF NOT EXISTS idx_followups_approval ON follow_ups (approval_status, approval_deadline) WHERE approval_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_followups_user_status_scheduled ON follow_ups (user_id, status, scheduled_at);

-- ── 2. Extend profiles table (user-level automation preferences) ──
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS followup_automation_mode text DEFAULT 'full_auto'
    CHECK (followup_automation_mode IN ('full_auto', 'approval_required', 'manual')),
  ADD COLUMN IF NOT EXISTS followup_approval_window_hours int DEFAULT 6,
  ADD COLUMN IF NOT EXISTS followup_default_template text DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS followup_template_by_lead_type jsonb DEFAULT
    '{"buyer":"aggressive","seller":"standard","investor":"standard","tenant":"gentle","landlord":"standard"}'::jsonb,
  ADD COLUMN IF NOT EXISTS followup_quiet_hours_start int DEFAULT 8 CHECK (followup_quiet_hours_start BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS followup_quiet_hours_end int DEFAULT 21 CHECK (followup_quiet_hours_end BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS followup_tcpa_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS followup_skip_weekends boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_max_touches int DEFAULT 8;

-- ── 3. Custom cadence templates table ──
CREATE TABLE IF NOT EXISTS cadence_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  day_offsets int[] NOT NULL,
  lead_type text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_cadence_templates_user ON cadence_templates (user_id);

ALTER TABLE cadence_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own cadence templates"
  ON cadence_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Auto-update trigger ──
CREATE OR REPLACE FUNCTION update_cadence_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cadence_templates_updated_at ON cadence_templates;
CREATE TRIGGER cadence_templates_updated_at
  BEFORE UPDATE ON cadence_templates
  FOR EACH ROW EXECUTE FUNCTION update_cadence_templates_updated_at();
