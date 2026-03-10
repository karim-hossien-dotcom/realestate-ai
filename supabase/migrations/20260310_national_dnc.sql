-- National DNC (Do Not Call) Registry table
-- Stores phone numbers from the FTC National DNC Registry.
-- Numbers are stored as 10-digit US format (no country code).
-- Data must be refreshed from https://telemarketing.donotcall.gov/ periodically.

CREATE TABLE IF NOT EXISTS national_dnc (
  phone TEXT PRIMARY KEY  -- 10-digit US phone number
);

-- Index for fast lookups during campaign scrubbing
CREATE INDEX IF NOT EXISTS idx_national_dnc_phone ON national_dnc (phone);

COMMENT ON TABLE national_dnc IS 'FTC National Do Not Call Registry numbers. Updated periodically from FTC data files.';
