-- =============================================
-- Estate AI — Stripe Billing Migration
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Add stripe_customer_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- 2. Plans table
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price_cents INTEGER NOT NULL DEFAULT 0,
  included_sms INTEGER NOT NULL DEFAULT 0,
  included_leads INTEGER NOT NULL DEFAULT 0,
  features JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on plans (public read)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active plans" ON plans
  FOR SELECT USING (active = true);

-- 3. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id),
  stripe_subscription_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS — users can only see their own subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- 4. Usage records table
CREATE TABLE IF NOT EXISTS usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  billing_period_start TIMESTAMPTZ NOT NULL,
  sms_count INTEGER DEFAULT 0,
  email_count INTEGER DEFAULT 0,
  whatsapp_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, billing_period_start)
);

-- Enable RLS
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own usage" ON usage_records
  FOR SELECT USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_usage_records_user_period ON usage_records(user_id, billing_period_start);

-- 5. Seed default plans (update stripe_product_id and stripe_price_id after creating in Stripe Dashboard)
INSERT INTO plans (name, slug, price_cents, included_sms, included_leads, stripe_product_id, stripe_price_id, features)
VALUES
  ('Starter', 'starter', 9900, 750, 250, 'prod_U6MmlkuwAJZIDE', 'price_1T8A2sBnEbq1TQAJMhNJiifA', '["Up to 250 leads", "750 SMS messages/month", "WhatsApp + Email + SMS", "AI message generation", "Lead scoring", "Basic analytics", "1 user"]'::jsonb),
  ('Pro', 'pro', 24900, 3000, 1000, 'prod_U6MnS7Ya9QAzju', 'price_1T8A48BnEbq1TQAJLhCs69LI', '["Up to 1,000 leads", "3,000 SMS messages/month", "Everything in Starter", "Follow-up automation", "CRM integration (FUB)", "Advanced analytics", "Priority support", "Up to 5 users"]'::jsonb),
  ('Agency', 'agency', 49900, 15000, -1, 'prod_U6Mo8Z0XAUR15r', 'price_1T8A4kBnEbq1TQAJOYrwh08Z', '["Unlimited leads", "15,000 SMS messages/month", "Everything in Pro", "Team management", "White-label reports", "Dedicated support", "Custom integrations", "Up to 15 users"]'::jsonb)
ON CONFLICT (slug) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  included_sms = EXCLUDED.included_sms,
  included_leads = EXCLUDED.included_leads,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id = EXCLUDED.stripe_price_id,
  features = EXCLUDED.features;
