-- Daily Operations System Migration
-- Creates tables for research findings and daily department reports

-- 1. Research Findings table
-- Stores competitive intelligence, market trends, and feature gap analysis
CREATE TABLE IF NOT EXISTS research_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('competitor_pricing', 'product_hunt', 'user_feedback', 'trend', 'usage_analysis')),
  finding_type TEXT NOT NULL CHECK (finding_type IN ('competitor_change', 'feature_gap', 'market_trend', 'user_request', 'pricing_change')),
  competitor_name TEXT,
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  recommended_action TEXT,
  priority TEXT DEFAULT 'P2' CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'accepted', 'rejected', 'implemented')),
  engineering_task_id UUID REFERENCES project_tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for research_findings
CREATE INDEX idx_research_findings_status ON research_findings(status);
CREATE INDEX idx_research_findings_source ON research_findings(source);
CREATE INDEX idx_research_findings_priority ON research_findings(priority);
CREATE INDEX idx_research_findings_created_at ON research_findings(created_at DESC);

-- 2. Daily Reports table
-- Stores daily department operation reports for Command Center
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department TEXT NOT NULL CHECK (department IN ('market_research', 'engineering', 'marketing', 'legal', 'finance')),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  health_status TEXT DEFAULT 'green' CHECK (health_status IN ('green', 'yellow', 'red')),
  metrics JSONB DEFAULT '{}',
  findings TEXT[] DEFAULT '{}',
  actions_taken TEXT[] DEFAULT '{}',
  actions_proposed TEXT[] DEFAULT '{}',
  blockers TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department, report_date)
);

-- Indexes for daily_reports
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date DESC);
CREATE INDEX idx_daily_reports_department ON daily_reports(department);
CREATE INDEX idx_daily_reports_health ON daily_reports(health_status);

-- 3. Update project_tasks department constraint to include market_research
-- Drop existing constraint and re-create with new value
ALTER TABLE project_tasks DROP CONSTRAINT IF EXISTS project_tasks_department_check;
ALTER TABLE project_tasks ADD CONSTRAINT project_tasks_department_check
  CHECK (department IN ('legal', 'engineering', 'marketing', 'finance', 'market_research'));

-- 4. Auto-update updated_at trigger for research_findings
CREATE OR REPLACE FUNCTION update_research_findings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_research_findings_updated_at
  BEFORE UPDATE ON research_findings
  FOR EACH ROW
  EXECUTE FUNCTION update_research_findings_updated_at();

-- 5. Auto-update updated_at trigger for daily_reports
CREATE OR REPLACE FUNCTION update_daily_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_reports_updated_at();

-- 6. RLS policies for research_findings (service role only -- admin data)
ALTER TABLE research_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to research_findings"
  ON research_findings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 7. RLS policies for daily_reports (service role only -- admin data)
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to daily_reports"
  ON daily_reports
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
