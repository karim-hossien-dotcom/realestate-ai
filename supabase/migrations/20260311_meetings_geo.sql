-- ============================================
-- Add geographic columns to meetings table
-- Supports smart calendar with travel time awareness
-- ============================================

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS travel_buffer_minutes INTEGER DEFAULT 30;

-- Index for fast date-range queries per user
CREATE INDEX IF NOT EXISTS idx_meetings_user_date
  ON meetings (user_id, meeting_date);

COMMENT ON COLUMN meetings.latitude IS 'Geocoded latitude of meeting location';
COMMENT ON COLUMN meetings.longitude IS 'Geocoded longitude of meeting location';
COMMENT ON COLUMN meetings.travel_buffer_minutes IS 'Minutes of travel buffer between meetings';
