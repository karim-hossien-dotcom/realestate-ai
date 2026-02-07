-- Meetings / Appointments table
CREATE TABLE IF NOT EXISTS meetings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  lead_id UUID REFERENCES leads(id),
  title TEXT NOT NULL,
  description TEXT,
  meeting_date TIMESTAMPTZ,
  duration_minutes INTEGER DEFAULT 30,
  location TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'ai_bot', 'campaign')),
  lead_name TEXT,
  lead_phone TEXT,
  property_address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meetings"
  ON meetings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meetings"
  ON meetings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meetings"
  ON meetings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to meetings"
  ON meetings FOR ALL
  USING (true)
  WITH CHECK (true);
