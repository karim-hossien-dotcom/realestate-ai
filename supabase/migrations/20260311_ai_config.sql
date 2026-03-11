-- AI Script Customization — per-user AI personality configuration
-- Allows each agent to customize how the AI bot communicates with their leads

CREATE TABLE IF NOT EXISTS ai_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tone TEXT DEFAULT 'professional' CHECK (tone IN ('professional', 'casual', 'friendly', 'formal', 'luxury')),
  language TEXT DEFAULT 'english',
  introduction_template TEXT,
  qualification_questions TEXT[] DEFAULT '{}',
  escalation_message TEXT,
  closing_style TEXT DEFAULT 'direct' CHECK (closing_style IN ('direct', 'soft', 'consultative', 'urgent')),
  property_focus TEXT DEFAULT 'general' CHECK (property_focus IN ('residential', 'commercial', 'luxury', 'industrial', 'general')),
  custom_instructions TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by user_id (already UNIQUE, but explicit)
CREATE INDEX idx_ai_config_user_id ON ai_config(user_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_ai_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_ai_config_updated_at
  BEFORE UPDATE ON ai_config
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_config_updated_at();

-- RLS: Users can only see/edit their own config
ALTER TABLE ai_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai_config"
  ON ai_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai_config"
  ON ai_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai_config"
  ON ai_config FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role has full access to ai_config"
  ON ai_config FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
