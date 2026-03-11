-- AI conversation quality audits
CREATE TABLE IF NOT EXISTS ai_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  conversation_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  message_count INTEGER NOT NULL,
  audit_week DATE NOT NULL,
  scores JSONB NOT NULL,  -- { relevance, qualification, tone, compliance, escalation: 1-5 }
  overall_score NUMERIC(3,1) NOT NULL,
  ai_notes TEXT,
  sample_messages JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_audits_week ON ai_audits(audit_week DESC);
CREATE INDEX idx_ai_audits_user ON ai_audits(conversation_user_id);
CREATE INDEX idx_ai_audits_score ON ai_audits(overall_score);

-- RLS — service_role only (no user access)
ALTER TABLE ai_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ai_audits"
  ON ai_audits FOR ALL
  USING (auth.role() = 'service_role');
