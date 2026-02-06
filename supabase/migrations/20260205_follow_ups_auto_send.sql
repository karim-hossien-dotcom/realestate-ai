-- Migration: Add columns for follow-up auto-sending
-- Run this in Supabase SQL Editor

-- Add channel column to specify how to send the follow-up
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'both';
-- 'both' = send via both WhatsApp and Email
-- 'whatsapp' = send via WhatsApp only
-- 'email' = send via Email only

-- Add retry tracking
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add error tracking
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add email-specific tracking
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;

-- Add follow-up number tracking (1st, 2nd, 3rd follow-up)
ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS follow_up_number INTEGER DEFAULT 1;

-- Create index for efficient querying of pending follow-ups
CREATE INDEX IF NOT EXISTS idx_follow_ups_pending_scheduled
ON follow_ups(status, scheduled_at)
WHERE status = 'pending';

-- Comment: Status values
-- 'pending' = not yet sent, waiting for scheduled time
-- 'sent' = successfully sent (at least one channel)
-- 'partial' = sent via one channel but failed on another
-- 'failed' = failed to send on all channels
-- 'cancelled' = cancelled by user

COMMENT ON COLUMN follow_ups.channel IS 'Send channel: both, whatsapp, or email';
COMMENT ON COLUMN follow_ups.retry_count IS 'Number of retry attempts';
COMMENT ON COLUMN follow_ups.error_message IS 'Last error message if send failed';
COMMENT ON COLUMN follow_ups.email_sent_at IS 'Timestamp when email was sent';
COMMENT ON COLUMN follow_ups.whatsapp_sent_at IS 'Timestamp when WhatsApp was sent';
COMMENT ON COLUMN follow_ups.follow_up_number IS 'Which follow-up this is (1st, 2nd, 3rd, etc)';
