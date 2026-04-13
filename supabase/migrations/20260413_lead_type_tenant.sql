-- Add 'tenant' to lead_type CHECK constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_type_check;
ALTER TABLE leads ADD CONSTRAINT leads_lead_type_check CHECK (lead_type IN ('buyer', 'seller', 'investor', 'landlord', 'tenant'));
