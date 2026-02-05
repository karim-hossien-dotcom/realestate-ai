// Simplified Supabase types for runtime use
// These are intentionally loose to avoid build-time type errors
// while the database schema is being developed

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any

// Convenience types for common tables
export type Profile = {
  id: string
  email: string
  full_name: string | null
  company: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export type Lead = {
  id: string
  user_id: string
  property_address: string | null
  owner_name: string | null
  phone: string | null
  email: string | null
  contact_preference: string | null
  status: string
  notes: string | null
  sms_text: string | null
  email_text: string | null
  tags: string[]
  score: number
  score_category: string
  last_contacted: string | null
  last_response: string | null
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  user_id: string
  lead_id: string | null
  campaign_id: string | null
  direction: 'inbound' | 'outbound'
  channel: 'whatsapp' | 'sms' | 'email'
  from_number: string | null
  to_number: string | null
  body: string
  status: string
  external_id: string | null
  error_message: string | null
  created_at: string
}

export type Campaign = {
  id: string
  user_id: string
  name: string
  status: string
  template_name: string | null
  total_leads: number
  sent_count: number
  failed_count: number
  response_count: number
  created_at: string
  completed_at: string | null
}

export type CampaignLead = {
  id: string
  campaign_id: string
  lead_id: string
  status: string
  sent_at: string | null
  created_at: string
}

export type FollowUp = {
  id: string
  user_id: string
  lead_id: string
  message_text: string
  scheduled_at: string
  status: string
  sent_at: string | null
  created_at: string
}

export type ActivityLog = {
  id: string
  user_id: string
  event_type: string
  description: string
  status: string
  metadata: Json | null
  created_at: string
}

export type DncEntry = {
  id: string
  user_id: string
  phone: string
  reason: string | null
  source: string
  created_at: string
}

export type ConsentRecord = {
  id: string
  user_id: string
  lead_id: string | null
  phone: string
  consent_type: string
  consent_given: boolean
  source: string
  ip_address: string | null
  created_at: string
}

export type RateLimit = {
  id: string
  user_id: string
  phone: string
  date: string
  message_count: number
  created_at: string
  updated_at: string
}

export type Template = {
  id: string
  user_id: string
  name: string
  body: string
  category: string | null
  variables: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}
