-- Migration: Add CRM connections table
-- Run this in Supabase SQL Editor

-- Create CRM connections table
CREATE TABLE IF NOT EXISTS crm_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('follow_up_boss', 'hubspot')),
  api_key TEXT,
  access_token TEXT,
  refresh_token TEXT,
  last_sync_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Add CRM reference columns to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS crm_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS crm_provider TEXT;

-- Enable RLS
ALTER TABLE crm_connections ENABLE ROW LEVEL SECURITY;

-- RLS policies for crm_connections
CREATE POLICY "Users can view own crm_connections" ON crm_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own crm_connections" ON crm_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own crm_connections" ON crm_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own crm_connections" ON crm_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_crm_connections_user_id ON crm_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_connections_provider ON crm_connections(provider);
CREATE INDEX IF NOT EXISTS idx_leads_crm_id ON leads(crm_id);

-- Update trigger for updated_at
DROP TRIGGER IF EXISTS update_crm_connections_updated_at ON crm_connections;
CREATE TRIGGER update_crm_connections_updated_at
  BEFORE UPDATE ON crm_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Comments
COMMENT ON TABLE crm_connections IS 'Stores CRM integration credentials and sync status';
COMMENT ON COLUMN crm_connections.provider IS 'CRM provider: follow_up_boss or hubspot';
COMMENT ON COLUMN crm_connections.api_key IS 'API key for Follow Up Boss';
COMMENT ON COLUMN crm_connections.access_token IS 'OAuth access token for HubSpot';
COMMENT ON COLUMN crm_connections.refresh_token IS 'OAuth refresh token for HubSpot';
COMMENT ON COLUMN crm_connections.last_sync_at IS 'Last successful sync timestamp';
COMMENT ON COLUMN leads.crm_id IS 'External ID from CRM system';
COMMENT ON COLUMN leads.crm_provider IS 'Which CRM this lead was synced from';
