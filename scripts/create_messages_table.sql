-- ==============================================
-- Migration: Create messages table
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ==============================================

-- 1. Create the messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  campaign_id UUID,
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

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_lead_id ON messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_messages_direction ON messages(direction);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- 3. Foreign key to campaigns (if campaigns table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
    ALTER TABLE messages
      ADD CONSTRAINT fk_messages_campaign
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists
END $$;

-- 4. Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own messages" ON messages
  FOR UPDATE USING (auth.uid() = user_id);

-- 6. Service role bypass (Python webhook + admin API routes use service role key)
-- Service role already bypasses RLS by default in Supabase, no extra policy needed.

-- 7. Functions that depend on messages table

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

-- Trigger: auto-update lead score when message is inserted
CREATE OR REPLACE FUNCTION trigger_update_lead_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    PERFORM update_lead_score(NEW.lead_id);

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

-- 8. Grant permissions
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_response_rate TO authenticated;
GRANT EXECUTE ON FUNCTION get_messages_time_series TO authenticated;
