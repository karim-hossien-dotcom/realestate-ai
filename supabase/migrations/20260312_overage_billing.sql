-- Add overage tracking columns to usage_records table
-- usage_records already exists (from migrate-stripe-billing.sql) but is unused
-- Now repurposed to track per-period overage counts for Stripe invoice items

ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS lead_count INTEGER DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS overage_sms INTEGER DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS overage_email INTEGER DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS overage_whatsapp INTEGER DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS overage_leads INTEGER DEFAULT 0;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
ALTER TABLE usage_records ADD COLUMN IF NOT EXISTS overage_reported BOOLEAN DEFAULT false;
