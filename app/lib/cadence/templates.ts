/**
 * Cadence Templates — research-backed follow-up sequences
 *
 * Based on industry research (Greg Harrelson 400K-lead study, MIT/InsideSales,
 * Outreach.io 2025): 95% of conversions happen after touch 6, ideal cadence
 * front-loads first 10 days then extends.
 */

export type CadenceTemplate = 'aggressive' | 'standard' | 'gentle' | 'long_haul' | 'custom'
export type LeadType = 'buyer' | 'seller' | 'investor' | 'landlord' | 'tenant'

export interface CadenceConfig {
  name: string
  description: string
  dayOffsets: number[]
  bestFor: string
}

/**
 * Built-in cadence templates.
 * dayOffsets are days after the first touch (campaign send / build action).
 */
export const CADENCE_TEMPLATES: Record<Exclude<CadenceTemplate, 'custom'>, CadenceConfig> = {
  aggressive: {
    name: 'Aggressive (Buyer-focused)',
    description: '8 touches in 30 days — front-loaded first week. Best for hot buyers.',
    dayOffsets: [1, 2, 4, 7, 10, 14, 21, 30],
    bestFor: 'Buyers, hot leads, time-sensitive campaigns',
  },
  standard: {
    name: 'Standard (Balanced)',
    description: '8 touches in 30 days — research-backed default. Works for most leads.',
    dayOffsets: [1, 2, 4, 7, 10, 14, 21, 30],
    bestFor: 'Sellers, investors, mixed lead lists',
  },
  gentle: {
    name: 'Gentle (Long-cycle)',
    description: '8 touches in 90 days — respectful pace. Best for sellers & high-value.',
    dayOffsets: [3, 7, 14, 21, 30, 45, 60, 90],
    bestFor: 'Sellers, luxury listings, tenants, long sales cycles',
  },
  long_haul: {
    name: 'Long Haul (12-month nurture)',
    description: '12 touches across a full year. Best for cold leads.',
    dayOffsets: [3, 7, 14, 30, 60, 90, 120, 150, 180, 240, 300, 365],
    bestFor: 'Cold leads, future buyers/sellers (6-12 months out)',
  },
}

/**
 * Default template assignment per lead type.
 * Based on research: buyers need aggressive (comparison-shopping window),
 * sellers gentler (6-12 month research mode), tenants short cycle.
 */
export const DEFAULT_TEMPLATE_BY_LEAD_TYPE: Record<LeadType, CadenceTemplate> = {
  buyer: 'aggressive',
  seller: 'standard',
  investor: 'standard',
  landlord: 'standard',
  tenant: 'gentle',
}

/**
 * Resolve which cadence to use for a lead.
 * Priority: lead-type-specific override → user default → 'standard'
 */
export function resolveCadence(
  leadType: LeadType | null | undefined,
  userTemplateByLeadType: Record<string, CadenceTemplate> | null,
  userDefault: CadenceTemplate | null
): CadenceTemplate {
  if (leadType && userTemplateByLeadType?.[leadType]) {
    return userTemplateByLeadType[leadType]
  }
  if (leadType) {
    return DEFAULT_TEMPLATE_BY_LEAD_TYPE[leadType] || 'standard'
  }
  return userDefault || 'standard'
}

/**
 * Get day offsets for a template name.
 * Returns null if template is 'custom' (caller must provide custom offsets).
 */
export function dayOffsetsFor(template: CadenceTemplate): number[] | null {
  if (template === 'custom') return null
  return CADENCE_TEMPLATES[template]?.dayOffsets || CADENCE_TEMPLATES.standard.dayOffsets
}

/**
 * Validate a custom day_offsets array.
 * Rules: positive integers, ascending, max 20 touches, max 365 days.
 */
export function validateDayOffsets(offsets: number[]): { ok: boolean; error?: string } {
  if (!Array.isArray(offsets)) return { ok: false, error: 'Must be an array' }
  if (offsets.length === 0) return { ok: false, error: 'At least one touch required' }
  if (offsets.length > 20) return { ok: false, error: 'Maximum 20 touches' }
  for (let i = 0; i < offsets.length; i++) {
    if (!Number.isInteger(offsets[i]) || offsets[i] < 1) {
      return { ok: false, error: 'All offsets must be positive integers (1+)' }
    }
    if (offsets[i] > 365) return { ok: false, error: 'Maximum 365 days' }
    if (i > 0 && offsets[i] <= offsets[i - 1]) {
      return { ok: false, error: 'Offsets must be strictly ascending' }
    }
  }
  return { ok: true }
}
