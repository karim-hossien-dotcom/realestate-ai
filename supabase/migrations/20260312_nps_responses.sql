-- NPS (Net Promoter Score) survey responses
CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10),
  feedback TEXT,
  page_url TEXT,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nps_responses_user_id ON nps_responses(user_id);
CREATE INDEX idx_nps_responses_created_at ON nps_responses(created_at DESC);

-- RLS
ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;

-- Users can insert their own responses
CREATE POLICY "Users can insert own NPS responses"
  ON nps_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own responses
CREATE POLICY "Users can read own NPS responses"
  ON nps_responses FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can read all (for admin analytics)
CREATE POLICY "Service role full access on nps_responses"
  ON nps_responses FOR ALL
  USING (auth.role() = 'service_role');
