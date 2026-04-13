/**
 * Cadence Scheduler — unified follow-up sequence builder
 *
 * Combines: cadence templates + lead-type branching + TCPA quiet hours +
 * approval mode + AI message generation into one entry point.
 */

import { generateFollowUpsForOffsets } from '@/app/lib/ai/followup-generator'
import {
  CadenceTemplate, LeadType, dayOffsetsFor, resolveCadence, validateDayOffsets,
} from './templates'
import { getTimezoneFromAreaCode, isInQuietHours, shiftToNextAllowedSlot, resolveQuietHours } from './tcpa'

export type AutomationMode = 'full_auto' | 'approval_required' | 'manual'

export interface UserAutomationProfile {
  followup_automation_mode: AutomationMode
  followup_approval_window_hours: number
  followup_default_template: CadenceTemplate
  followup_template_by_lead_type: Record<string, CadenceTemplate> | null
  followup_quiet_hours_start: number
  followup_quiet_hours_end: number
  followup_tcpa_enabled: boolean
  followup_skip_weekends: boolean
  followup_max_touches: number
}

export const DEFAULT_PROFILE: UserAutomationProfile = {
  followup_automation_mode: 'full_auto',
  followup_approval_window_hours: 6,
  followup_default_template: 'standard',
  followup_template_by_lead_type: null,
  followup_quiet_hours_start: 8,
  followup_quiet_hours_end: 21,
  followup_tcpa_enabled: true,
  followup_skip_weekends: false,
  followup_max_touches: 8,
}

export interface ScheduledRow {
  user_id: string
  lead_id: string
  message_text: string
  scheduled_at: string  // ISO
  original_scheduled_at: string  // ISO (before TCPA shift)
  status: 'pending'
  channel: string
  follow_up_number: number
  cadence_template: CadenceTemplate
  automation_mode: AutomationMode
  approval_status: 'auto_approved' | 'pending'
  approval_deadline: string | null  // ISO
  lead_type: string | null
  lead_timezone: string | null
}

export interface BuildScheduleInput {
  userId: string
  lead: {
    id: string
    owner_name?: string | null
    property_address?: string | null
    phone?: string | null
    email?: string | null
    lead_type?: LeadType | null
  }
  firstSms: string
  profile: UserAutomationProfile
  customDayOffsets?: number[]  // overrides template if provided
  startDate?: Date
  contactEmail?: string
}

/**
 * Build a complete follow-up schedule for a single lead.
 * Returns rows ready to insert into follow_ups table.
 *
 * Returns empty array if mode is 'manual' (user wants to create manually).
 */
export async function buildSchedule(input: BuildScheduleInput): Promise<ScheduledRow[]> {
  const { userId, lead, firstSms, profile, customDayOffsets, startDate = new Date(), contactEmail } = input

  // Manual mode: skip auto-creation entirely
  if (profile.followup_automation_mode === 'manual') return []

  // Resolve which template to use for this lead
  const template = customDayOffsets
    ? 'custom'
    : resolveCadence(lead.lead_type, profile.followup_template_by_lead_type, profile.followup_default_template)

  // Resolve day offsets
  let offsets = customDayOffsets || dayOffsetsFor(template) || [1, 3, 7, 14, 30]

  // Validate custom offsets if provided
  if (customDayOffsets) {
    const validation = validateDayOffsets(customDayOffsets)
    if (!validation.ok) throw new Error(`Invalid cadence: ${validation.error}`)
  }

  // Cap at user's max touches
  if (profile.followup_max_touches > 0 && offsets.length > profile.followup_max_touches) {
    offsets = offsets.slice(0, profile.followup_max_touches)
  }

  // Generate AI messages for each offset
  let messages: Record<number, string>
  try {
    messages = await generateFollowUpsForOffsets(
      lead, firstSms, offsets,
      { contactEmail, leadType: lead.lead_type || null }
    )
  } catch (err) {
    console.error('[scheduler] AI generation failed, using fallback templates:', err)
    messages = fallbackMessages(lead, offsets)
  }

  // Resolve TCPA quiet hours (state-aware)
  const quietHours = resolveQuietHours(
    lead.phone, profile.followup_quiet_hours_start, profile.followup_quiet_hours_end
  )
  const leadTimezone = getTimezoneFromAreaCode(lead.phone)

  // Determine approval state
  const requiresApproval = profile.followup_automation_mode === 'approval_required'
  const approvalStatus = requiresApproval ? 'pending' : 'auto_approved'

  // Build rows
  const rows: ScheduledRow[] = []
  for (let i = 0; i < offsets.length; i++) {
    const offset = offsets[i]
    const messageText = messages[offset]
    if (!messageText) continue

    // Compute scheduled time (offset days from start)
    const originalScheduled = new Date(startDate)
    originalScheduled.setDate(originalScheduled.getDate() + offset)

    // Apply TCPA shift if enabled
    let scheduledAt = originalScheduled
    if (profile.followup_tcpa_enabled && isInQuietHours(
      originalScheduled, leadTimezone, quietHours.start, quietHours.end, profile.followup_skip_weekends
    )) {
      scheduledAt = shiftToNextAllowedSlot(
        originalScheduled, leadTimezone, quietHours.start, quietHours.end, profile.followup_skip_weekends
      )
    }

    // Approval deadline: scheduled_at minus approval window (or null if not required)
    const approvalDeadline = requiresApproval
      ? new Date(scheduledAt.getTime() - profile.followup_approval_window_hours * 60 * 60 * 1000).toISOString()
      : null

    // Channel preference: phone → whatsapp/sms, email-only → email
    const channel = lead.phone ? 'whatsapp' : (lead.email ? 'email' : 'whatsapp')

    rows.push({
      user_id: userId,
      lead_id: lead.id,
      message_text: messageText,
      scheduled_at: scheduledAt.toISOString(),
      original_scheduled_at: originalScheduled.toISOString(),
      status: 'pending',
      channel,
      follow_up_number: i + 1,
      cadence_template: template,
      automation_mode: profile.followup_automation_mode,
      approval_status: approvalStatus,
      approval_deadline: approvalDeadline,
      lead_type: lead.lead_type || null,
      lead_timezone: leadTimezone,
    })
  }

  return rows
}

/**
 * Fallback messages when AI generation fails — generic but contextual.
 */
function fallbackMessages(
  lead: { owner_name?: string | null; property_address?: string | null },
  offsets: number[]
): Record<number, string> {
  const name = (lead.owner_name || '').trim() || 'there'
  const address = (lead.property_address || '').trim() || 'your property'
  const messages: Record<number, string> = {}

  for (const offset of offsets) {
    if (offset <= 2) {
      messages[offset] = `Hi ${name}, just following up about ${address}. Any questions I can answer?`
    } else if (offset <= 7) {
      messages[offset] = `Hi ${name}, wanted to check in about ${address}. Happy to share recent market activity if helpful.`
    } else if (offset <= 14) {
      messages[offset] = `Hi ${name}, hope all's well. Still happy to chat about ${address} when you're ready.`
    } else if (offset <= 30) {
      messages[offset] = `Hi ${name}, the market in your area has been active. Want a quick update on ${address}?`
    } else {
      messages[offset] = `Hi ${name}, still here when you're ready to talk about ${address}. No pressure.`
    }
  }
  return messages
}

/**
 * Resolve a user's automation profile from raw profile row, with defaults.
 */
export function resolveProfile(profileRow: Partial<UserAutomationProfile> | null | undefined): UserAutomationProfile {
  return {
    ...DEFAULT_PROFILE,
    ...(profileRow || {}),
  } as UserAutomationProfile
}
