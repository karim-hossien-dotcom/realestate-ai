/**
 * Lead Scoring Algorithm
 *
 * Score 0-100 based on:
 * - Response behavior (+30 for any response)
 * - Intent signals (+25 for positive, -20 for negative)
 * - Engagement (+3 per message, capped at +15)
 * - Contact completeness (+5 for having phone & email)
 * - Time decay (-1 per day after 14 days of inactivity)
 *
 * Categories:
 * - Hot: 80-100
 * - Warm: 50-79
 * - Cold: 20-49
 * - Dead: 0-19
 */

export type LeadScoreInput = {
  status?: string
  responseCount: number
  messagesSent: number
  lastResponse?: Date | string | null
  lastContacted?: Date | string | null
  hasPhone: boolean
  hasEmail: boolean
}

export type LeadScoreResult = {
  score: number
  category: 'Hot' | 'Warm' | 'Cold' | 'Dead'
  breakdown: {
    responseBonus: number
    intentBonus: number
    engagementBonus: number
    completenessBonus: number
    timeDecay: number
  }
}

// Status values that indicate positive intent
const POSITIVE_STATUSES = ['interested', 'qualified', 'meeting_scheduled', 'hot']

// Status values that indicate negative intent
const NEGATIVE_STATUSES = ['not_interested', 'do_not_contact', 'dead', 'unsubscribed']

export function calculateLeadScore(input: LeadScoreInput): LeadScoreResult {
  const BASE_SCORE = 50
  let score = BASE_SCORE

  const breakdown = {
    responseBonus: 0,
    intentBonus: 0,
    engagementBonus: 0,
    completenessBonus: 0,
    timeDecay: 0,
  }

  // Response bonus: +30 for any response
  if (input.responseCount > 0) {
    breakdown.responseBonus = 30
    score += 30
  }

  // Intent bonus/penalty based on status
  const statusLower = (input.status || '').toLowerCase()
  if (POSITIVE_STATUSES.includes(statusLower)) {
    breakdown.intentBonus = 25
    score += 25
  } else if (NEGATIVE_STATUSES.includes(statusLower)) {
    breakdown.intentBonus = -20
    score -= 20
  }

  // Engagement bonus: +3 per message, capped at +15
  const engagementPoints = Math.min(input.messagesSent * 3, 15)
  breakdown.engagementBonus = engagementPoints
  score += engagementPoints

  // Contact completeness: +5 for having both phone and email
  if (input.hasPhone && input.hasEmail) {
    breakdown.completenessBonus = 5
    score += 5
  }

  // Time decay: -1 per day after 14 days of inactivity
  const lastActivity = input.lastResponse || input.lastContacted
  if (lastActivity) {
    const lastDate = typeof lastActivity === 'string' ? new Date(lastActivity) : lastActivity
    const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysSince > 14) {
      const decay = daysSince - 14
      breakdown.timeDecay = -decay
      score -= decay
    }
  } else if (input.messagesSent > 0) {
    // If we've sent messages but never got any activity, apply a penalty
    breakdown.timeDecay = -10
    score -= 10
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score))

  // Determine category
  let category: 'Hot' | 'Warm' | 'Cold' | 'Dead'
  if (score >= 80) {
    category = 'Hot'
  } else if (score >= 50) {
    category = 'Warm'
  } else if (score >= 20) {
    category = 'Cold'
  } else {
    category = 'Dead'
  }

  return { score, category, breakdown }
}

/**
 * Batch score multiple leads
 */
export function scoreLeads(leads: LeadScoreInput[]): LeadScoreResult[] {
  return leads.map(calculateLeadScore)
}

/**
 * Get a human-readable explanation of the score
 */
export function explainScore(result: LeadScoreResult): string {
  const parts: string[] = []

  if (result.breakdown.responseBonus > 0) {
    parts.push(`+${result.breakdown.responseBonus} (responded)`)
  }
  if (result.breakdown.intentBonus > 0) {
    parts.push(`+${result.breakdown.intentBonus} (positive intent)`)
  } else if (result.breakdown.intentBonus < 0) {
    parts.push(`${result.breakdown.intentBonus} (negative intent)`)
  }
  if (result.breakdown.engagementBonus > 0) {
    parts.push(`+${result.breakdown.engagementBonus} (engagement)`)
  }
  if (result.breakdown.completenessBonus > 0) {
    parts.push(`+${result.breakdown.completenessBonus} (complete contact)`)
  }
  if (result.breakdown.timeDecay < 0) {
    parts.push(`${result.breakdown.timeDecay} (time decay)`)
  }

  return `Score: ${result.score} (${result.category}) = 50 base ${parts.join(' ')}`
}
