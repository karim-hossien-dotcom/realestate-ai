-- ============================================
-- PROJECT_TASKS — Unified task tracker for Command Center
-- Covers: Legal, Engineering, Marketing, Finance
-- ============================================

CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Classification
  department TEXT NOT NULL CHECK (department IN ('legal', 'engineering', 'marketing', 'finance')),
  priority TEXT NOT NULL DEFAULT 'P1' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'blocked', 'skipped')),

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  channel TEXT,                          -- SMS, Email, WhatsApp, All, etc.
  is_blocker BOOLEAN DEFAULT FALSE,
  is_automatable BOOLEAN DEFAULT FALSE,  -- Can AI / Claude Code handle this?

  -- Scheduling (for marketing sprints, etc.)
  week_label TEXT,                       -- W1, W2, W1-2, etc.
  due_date DATE,

  -- Finance-specific
  metric_threshold TEXT,                 -- e.g. "$50/mo", "< $150"
  metric_current TEXT,                   -- e.g. "$14/mo", "Variable"
  alert_status TEXT CHECK (alert_status IN ('ok', 'watch', 'alert', NULL)),

  -- Vendor-specific
  vendor_name TEXT,
  vendor_service TEXT,
  vendor_plan TEXT,
  vendor_action TEXT,

  -- Completion tracking
  completed_at TIMESTAMPTZ,
  completed_by TEXT,                     -- 'user', 'claude_code', 'scheduled_task'
  completion_note TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_user_id ON project_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_department ON project_tasks(department);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_priority ON project_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_project_tasks_blocker ON project_tasks(is_blocker) WHERE is_blocker = TRUE;

-- RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project_tasks" ON project_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own project_tasks" ON project_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own project_tasks" ON project_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own project_tasks" ON project_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Service role policy for Claude Code / cron / scheduled tasks
CREATE POLICY "Service role full access" ON project_tasks
  FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- Updated_at trigger
DROP TRIGGER IF EXISTS update_project_tasks_updated_at ON project_tasks;
CREATE TRIGGER update_project_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get task summary by department
CREATE OR REPLACE FUNCTION get_task_summary(p_user_id UUID)
RETURNS TABLE(
  department TEXT,
  total BIGINT,
  completed BIGINT,
  blockers BIGINT,
  automatable BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pt.department,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE pt.status = 'completed') as completed,
    COUNT(*) FILTER (WHERE pt.is_blocker = TRUE AND pt.status != 'completed') as blockers,
    COUNT(*) FILTER (WHERE pt.is_automatable = TRUE) as automatable
  FROM project_tasks pt
  WHERE pt.user_id = p_user_id
  GROUP BY pt.department
  ORDER BY pt.department;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_task_summary TO authenticated;
