import { z } from 'zod'

// ===== LEADS =====

export const createLeadSchema = z.object({
  property_address: z.string().min(1, 'Property address is required').max(500),
  owner_name: z.string().min(1, 'Owner name is required').max(200),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email').max(254).optional(),
  contact_preference: z.enum(['sms', 'email', 'whatsapp', 'call']).default('sms'),
  status: z.enum(['new', 'contacted', 'interested', 'not_interested', 'closed']).default('new'),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
})

export const updateLeadSchema = z.object({
  id: z.string().uuid('Invalid lead ID'),
  property_address: z.string().min(1).max(500).optional(),
  owner_name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(254).optional(),
  contact_preference: z.enum(['sms', 'email', 'whatsapp', 'call']).optional(),
  status: z.enum(['new', 'contacted', 'interested', 'not_interested', 'closed']).optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  score: z.number().min(0).max(100).optional(),
  score_category: z.enum(['hot', 'warm', 'cold', 'dead']).optional(),
  property_interest: z.string().max(500).optional(),
  budget_min: z.number().min(0).optional(),
  budget_max: z.number().min(0).optional(),
  property_type: z.string().max(100).optional(),
  location_preference: z.string().max(500).optional(),
})

// ===== STRIPE =====

export const stripeCheckoutSchema = z.object({
  priceId: z.string().min(1, 'priceId is required'),
})

// ===== WHATSAPP =====

export const whatsappSendSchema = z.object({
  to: z.string().min(1, 'Recipient phone is required').max(20),
  templateName: z.string().max(100).optional(),
  languageCode: z.string().max(10).optional(),
  bodyParams: z.array(z.string()).default([]),
})

// ===== EMAIL =====

export const emailSendSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, 'At least one lead ID is required'),
  customMessage: z.string().max(5000).optional(),
})

// ===== CAMPAIGNS =====

export const campaignSendSchema = z.object({
  leads: z.array(z.object({
    id: z.string().uuid().optional(),
    phone: z.string().max(20).optional(),
    email: z.string().email().max(254).optional(),
    sms_text: z.string().max(1600).optional(),
    email_text: z.string().max(5000).optional(),
    owner_name: z.string().max(200).optional(),
    property_address: z.string().max(500).optional(),
  })).min(1, 'At least one lead is required'),
  channel: z.enum(['whatsapp', 'email', 'sms']).default('whatsapp'),
  templateName: z.string().max(100).optional(),
  languageCode: z.string().max(10).optional(),
  campaignName: z.string().max(200).optional(),
})

// ===== PROJECT TASKS =====

export const createProjectTaskSchema = z.object({
  department: z.enum(['legal', 'engineering', 'marketing', 'finance']),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).default('P1'),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'skipped']).default('pending'),
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(2000).optional(),
  channel: z.string().max(50).optional(),
  is_blocker: z.boolean().default(false),
  is_automatable: z.boolean().default(false),
  week_label: z.string().max(20).optional(),
  due_date: z.string().optional(),
  metric_threshold: z.string().max(100).optional(),
  metric_current: z.string().max(100).optional(),
  alert_status: z.enum(['ok', 'watch', 'alert']).optional(),
  vendor_name: z.string().max(100).optional(),
  vendor_service: z.string().max(200).optional(),
  vendor_plan: z.string().max(200).optional(),
  vendor_action: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const updateProjectTaskSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'skipped']).optional(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  is_blocker: z.boolean().optional(),
  is_automatable: z.boolean().optional(),
  metric_current: z.string().max(100).optional(),
  alert_status: z.enum(['ok', 'watch', 'alert']).optional(),
  completion_note: z.string().max(1000).optional(),
  completed_by: z.enum(['user', 'claude_code', 'scheduled_task']).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const batchUpdateTasksSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked', 'skipped']),
  completed_by: z.enum(['user', 'claude_code', 'scheduled_task']).optional(),
  completion_note: z.string().max(1000).optional(),
})
