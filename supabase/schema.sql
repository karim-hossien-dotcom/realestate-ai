-- Estate AI Database Schema
-- Run this in Supabase SQL Editor to create all tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (auto-created on signup)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  company TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- LEADS
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_address TEXT,
  owner_name TEXT,
  phone TEXT,
  email TEXT,
  contact_preference TEXT DEFAULT 'sms',
  status TEXT DEFAULT 'new',
  notes TEXT,
  sms_text TEXT,
  email_text TEXT,
  tags TEXT[] DEFAULT '{}',
  score INTEGER DEFAULT 50,
  score_category TEXT DEFAULT 'Warm',
  last_contacted TIMESTAMPTZ,
  last_response TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);

-- ============================================
-- MESSAGES (sent + received)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id UUID,  -- FK added after campaigns table
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms', 'email')),
  from_number TEXT,
  to_number TEXT,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  external_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- ============================================
-- CAMPAIGNS
-- ============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  template_name TEXT,
  total_leads INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  response_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Add FK to messages after campaigns exists
ALTER TABLE messages
  ADD CONSTRAINT fk_messages_campaign
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ============================================
-- CAMPAIGN_LEADS (junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS campaign_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, lead_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_leads_campaign ON campaign_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON campaign_leads(lead_id);

-- ============================================
-- FOLLOW_UPS
-- ============================================
CREATE TABLE IF NOT EXISTS follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_user_id ON follow_ups(user_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_lead_id ON follow_ups(lead_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled ON follow_ups(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_ups(status);

-- ============================================
-- ACTIVITY_LOGS (audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'success',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ============================================
-- DNC_LIST (Do Not Call)
-- ============================================
CREATE TABLE IF NOT EXISTS dnc_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_dnc_user_phone ON dnc_list(user_id, phone);

-- ============================================
-- CONSENT_RECORDS
-- ============================================
CREATE TABLE IF NOT EXISTS consent_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  consent_given BOOLEAN DEFAULT TRUE,
  source TEXT DEFAULT 'csv_import',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_user_phone ON consent_records(user_id, phone);

-- ============================================
-- RATE_LIMITS
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phone, date)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON rate_limits(user_id, phone, date);

-- ============================================
-- TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only see their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Leads: users can only see their own leads
CREATE POLICY "Users can view own leads" ON leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leads" ON leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leads" ON leads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own leads" ON leads
  FOR DELETE USING (auth.uid() = user_id);

-- Messages: users can only see their own messages
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (auth.uid() = user_id);

-- Campaigns: users can only see their own campaigns
CREATE POLICY "Users can view own campaigns" ON campaigns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaigns" ON campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" ON campaigns
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns" ON campaigns
  FOR DELETE USING (auth.uid() = user_id);

-- Campaign leads: based on campaign ownership
CREATE POLICY "Users can view own campaign_leads" ON campaign_leads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_leads.campaign_id AND campaigns.user_id = auth.uid())
  );

CREATE POLICY "Users can insert own campaign_leads" ON campaign_leads
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_leads.campaign_id AND campaigns.user_id = auth.uid())
  );

CREATE POLICY "Users can update own campaign_leads" ON campaign_leads
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_leads.campaign_id AND campaigns.user_id = auth.uid())
  );

-- Follow-ups: users can only see their own
CREATE POLICY "Users can view own follow_ups" ON follow_ups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own follow_ups" ON follow_ups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own follow_ups" ON follow_ups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own follow_ups" ON follow_ups
  FOR DELETE USING (auth.uid() = user_id);

-- Activity logs: users can only see their own
CREATE POLICY "Users can view own activity_logs" ON activity_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity_logs" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- DNC list: users can only see their own
CREATE POLICY "Users can view own dnc_list" ON dnc_list
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dnc_list" ON dnc_list
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dnc_list" ON dnc_list
  FOR DELETE USING (auth.uid() = user_id);

-- Consent records: users can only see their own
CREATE POLICY "Users can view own consent_records" ON consent_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consent_records" ON consent_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Rate limits: users can only see their own
CREATE POLICY "Users can view own rate_limits" ON rate_limits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own rate_limits" ON rate_limits
  FOR ALL USING (auth.uid() = user_id);

-- Templates: users can only see their own
CREATE POLICY "Users can view own templates" ON templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates" ON templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" ON templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" ON templates
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Check if phone is on DNC list
CREATE OR REPLACE FUNCTION check_dnc(p_user_id UUID, p_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM dnc_list
    WHERE user_id = p_user_id AND phone = p_phone
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment rate limit, return whether allowed
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_user_id UUID,
  p_phone TEXT,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE(allowed BOOLEAN, current_count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Upsert the rate limit record
  INSERT INTO rate_limits (user_id, phone, date, message_count)
  VALUES (p_user_id, p_phone, CURRENT_DATE, 1)
  ON CONFLICT (user_id, phone, date)
  DO UPDATE SET
    message_count = rate_limits.message_count + 1,
    updated_at = NOW()
  RETURNING message_count INTO v_count;

  RETURN QUERY SELECT (v_count <= p_limit), v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get message stats for dashboard
CREATE OR REPLACE FUNCTION get_message_stats(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE(total_sent BIGINT, total_received BIGINT, total_failed BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'sent') as total_sent,
    COUNT(*) FILTER (WHERE direction = 'inbound') as total_received,
    COUNT(*) FILTER (WHERE direction = 'outbound' AND status = 'failed') as total_failed
  FROM messages
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get response rate
CREATE OR REPLACE FUNCTION get_response_rate(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS NUMERIC AS $$
DECLARE
  v_sent BIGINT;
  v_responses BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_sent
  FROM messages
  WHERE user_id = p_user_id
    AND direction = 'outbound'
    AND status = 'sent'
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  SELECT COUNT(*) INTO v_responses
  FROM messages
  WHERE user_id = p_user_id
    AND direction = 'inbound'
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;

  IF v_sent = 0 THEN
    RETURN 0;
  END IF;

  RETURN ROUND((v_responses::NUMERIC / v_sent::NUMERIC) * 100, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get lead status distribution
CREATE OR REPLACE FUNCTION get_lead_status_distribution(p_user_id UUID)
RETURNS TABLE(status TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT leads.status, COUNT(*) as count
  FROM leads
  WHERE user_id = p_user_id
  GROUP BY leads.status
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get messages time series for charts
CREATE OR REPLACE FUNCTION get_messages_time_series(p_user_id UUID, p_days INTEGER DEFAULT 14)
RETURNS TABLE(date DATE, sent BIGINT, received BIGINT) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (p_days - 1),
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as date
  )
  SELECT
    ds.date,
    COUNT(*) FILTER (WHERE m.direction = 'outbound' AND m.status = 'sent') as sent,
    COUNT(*) FILTER (WHERE m.direction = 'inbound') as received
  FROM date_series ds
  LEFT JOIN messages m ON DATE(m.created_at) = ds.date AND m.user_id = p_user_id
  GROUP BY ds.date
  ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update lead score based on activity
CREATE OR REPLACE FUNCTION update_lead_score(p_lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 50;  -- Base score
  v_responses INTEGER;
  v_messages_sent INTEGER;
  v_last_response TIMESTAMPTZ;
  v_days_since_response INTEGER;
  v_lead_status TEXT;
BEGIN
  -- Get lead data
  SELECT status, last_response INTO v_lead_status, v_last_response
  FROM leads WHERE id = p_lead_id;

  -- Count responses from this lead
  SELECT COUNT(*) INTO v_responses
  FROM messages
  WHERE lead_id = p_lead_id AND direction = 'inbound';

  -- Count messages sent to this lead
  SELECT COUNT(*) INTO v_messages_sent
  FROM messages
  WHERE lead_id = p_lead_id AND direction = 'outbound';

  -- Score adjustments
  -- +30 for any response
  IF v_responses > 0 THEN
    v_score := v_score + 30;
  END IF;

  -- +3 per message engagement (capped at +15)
  v_score := v_score + LEAST(v_messages_sent * 3, 15);

  -- +25 for positive status indicators
  IF v_lead_status IN ('interested', 'qualified', 'meeting_scheduled') THEN
    v_score := v_score + 25;
  ELSIF v_lead_status IN ('not_interested', 'do_not_contact') THEN
    v_score := v_score - 20;
  END IF;

  -- Time decay: -1 per day after 14 days of no response
  IF v_last_response IS NOT NULL THEN
    v_days_since_response := EXTRACT(DAY FROM NOW() - v_last_response);
    IF v_days_since_response > 14 THEN
      v_score := v_score - (v_days_since_response - 14);
    END IF;
  ELSIF v_messages_sent > 0 THEN
    -- If we've sent messages but never got a response, apply stronger decay
    v_score := v_score - 10;
  END IF;

  -- Clamp score to 0-100
  v_score := GREATEST(0, LEAST(100, v_score));

  -- Update the lead
  UPDATE leads
  SET
    score = v_score,
    score_category = CASE
      WHEN v_score >= 80 THEN 'Hot'
      WHEN v_score >= 50 THEN 'Warm'
      WHEN v_score >= 20 THEN 'Cold'
      ELSE 'Dead'
    END,
    updated_at = NOW()
  WHERE id = p_lead_id;

  RETURN v_score;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update lead score after message insert
CREATE OR REPLACE FUNCTION trigger_update_lead_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    PERFORM update_lead_score(NEW.lead_id);

    -- Also update last_contacted or last_response on the lead
    IF NEW.direction = 'outbound' THEN
      UPDATE leads SET last_contacted = NOW(), updated_at = NOW() WHERE id = NEW.lead_id;
    ELSIF NEW.direction = 'inbound' THEN
      UPDATE leads SET last_response = NOW(), updated_at = NOW() WHERE id = NEW.lead_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_insert ON messages;
CREATE TRIGGER on_message_insert
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION trigger_update_lead_score();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION check_dnc TO authenticated;
GRANT EXECUTE ON FUNCTION increment_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_response_rate TO authenticated;
GRANT EXECUTE ON FUNCTION get_lead_status_distribution TO authenticated;
GRANT EXECUTE ON FUNCTION get_messages_time_series TO authenticated;
GRANT EXECUTE ON FUNCTION update_lead_score TO authenticated;
