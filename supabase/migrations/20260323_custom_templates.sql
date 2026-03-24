-- Custom campaign message templates (Pro/Agency feature)
CREATE TABLE IF NOT EXISTS custom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'custom',
  description TEXT,
  sms_body TEXT NOT NULL,
  email_subject TEXT,
  email_body TEXT,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT FALSE,
  use_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE custom_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates" ON custom_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own templates" ON custom_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON custom_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON custom_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_custom_templates_user ON custom_templates(user_id);
