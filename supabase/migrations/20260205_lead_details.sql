-- Add property interest and budget fields to leads table
-- These fields capture the lead's real estate preferences

ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_interest TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget_min INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget_max INTEGER;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_type TEXT; -- residential, commercial, land, etc.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS location_preference TEXT;

-- Add index for filtering by property type
CREATE INDEX IF NOT EXISTS idx_leads_property_type ON leads(property_type);
