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
