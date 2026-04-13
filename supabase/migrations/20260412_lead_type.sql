-- Add lead_type column to distinguish buyers from sellers
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type text CHECK (lead_type IN ('buyer', 'seller', 'investor', 'landlord'));

-- Index for filtering campaigns by lead type
CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads (lead_type) WHERE lead_type IS NOT NULL;
