/**
 * Smart campaign message generator — personalizes outreach based on lead context.
 * Uses the same prospecting scripts taught to the AI inbound agent.
 *
 * Lead types: seller, buyer, investor, expired, cold/unknown
 * Each gets a different opening aligned to their situation.
 */

type LeadContext = {
  ownerName?: string | null
  propertyAddress?: string | null
  propertyType?: string | null
  propertyInterest?: string | null
  notes?: string | null
  status?: string | null
  tags?: string[] | null
  locationPreference?: string | null
  agentName: string
}

/**
 * Extract the area/neighborhood from an address (city or neighborhood name).
 * "789 Elm Dr, Hoboken, NJ 07030" → "Hoboken"
 * "123 Main St" → null (no city found)
 */
function extractArea(address: string | null | undefined): string | null {
  if (!address) return null
  const parts = address.split(',').map(p => p.trim())
  // Second part is usually city: "789 Elm Dr, Hoboken, NJ" → "Hoboken"
  if (parts.length >= 2) {
    const city = parts[1].replace(/\s+(NJ|NY|FL|CA|TX|PA|CT|MA|IL|OH|GA|NC|VA|MD|SC|AL|TN|CO|AZ|WA|OR|MI|MN|WI|MO|IN|KY|LA|OK|IA|AR|MS|KS|UT|NV|NE|NM|WV|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY|DC|PR)\b.*$/i, '').trim()
    if (city && city.length > 1) return city
  }
  return null
}

/**
 * Detect lead intent from property_interest, notes, and tags.
 */
function detectIntent(ctx: LeadContext): 'seller' | 'buyer' | 'tenant' | 'investor' | 'expired' | 'cold' {
  const interest = (ctx.propertyInterest || '').toLowerCase()
  const notes = (ctx.notes || '').toLowerCase()
  const tags = (ctx.tags || []).map(t => t.toLowerCase())
  const status = (ctx.status || '').toLowerCase()
  const propType = (ctx.propertyType || '').toLowerCase()

  // Check property_type for lease/buy signals (common in CRM imports)
  if (propType.includes('lease') || propType.includes('rent') || propType.includes('tenant')) return 'tenant'
  if (propType.includes('for sale') && !propType.includes('by owner')) return 'buyer'

  // Check explicit property_interest field
  if (interest.includes('sell') || interest.includes('listing')) return 'seller'
  if (interest.includes('lease') || interest.includes('rent') || interest.includes('tenant')) return 'tenant'
  if (interest.includes('buy') || interest.includes('purchas') || interest.includes('looking')) return 'buyer'
  if (interest.includes('invest')) return 'investor'

  // Check notes for signals
  if (notes.includes('motivated seller') || notes.includes('pre-foreclosure') || notes.includes('probate') ||
      notes.includes('inherited') || notes.includes('absentee') || notes.includes('vacant') ||
      notes.includes('fsbo') || notes.includes('for sale by owner')) return 'seller'
  if (notes.includes('expired listing') || notes.includes('didn\'t sell') || notes.includes('failed listing')) return 'expired'
  if (notes.includes('lease') || notes.includes('tenant') || notes.includes('looking for space') ||
      notes.includes('office space') || notes.includes('retail space')) return 'tenant'
  if (notes.includes('buyer') || notes.includes('looking to buy') || notes.includes('searching for')) return 'buyer'
  if (notes.includes('invest') || notes.includes('rental') || notes.includes('cap rate') ||
      notes.includes('noi') || notes.includes('portfolio')) return 'investor'

  // Check tags
  if (tags.some(t => t.includes('seller') || t.includes('listing'))) return 'seller'
  if (tags.some(t => t.includes('tenant') || t.includes('lease'))) return 'tenant'
  if (tags.some(t => t.includes('buyer'))) return 'buyer'
  if (tags.some(t => t.includes('investor') || t.includes('investment'))) return 'investor'
  if (tags.some(t => t.includes('expired'))) return 'expired'

  // Check status — don't assume warm = seller, could be buyer
  return 'cold'
}

/**
 * Generate a personalized outreach message based on lead context.
 * Aligned with the AI agent's prospecting scripts.
 */
export function generateOutreachMessage(ctx: LeadContext): string {
  const firstName = ctx.ownerName?.split(' ')[0] || 'there'
  const address = ctx.propertyAddress || 'your property'
  const area = extractArea(ctx.propertyAddress)
  const intent = detectIntent(ctx)
  const isCommercial = (ctx.propertyType || '').toLowerCase().includes('commercial')

  switch (intent) {
    case 'seller': {
      if (isCommercial) {
        // Commercial seller — from PROSPECTING NEW LEADS script
        if (area) {
          return `Hi ${firstName}, properties like yours at ${address} are in high demand in ${area} right now. We recently closed a deal nearby and have an overflow of buyers looking in your area. Would you be open to a brief chat about what similar properties have been going for?`
        }
        return `Hi ${firstName}, we recently sold a building near ${address} for a premium and have buyers looking for similar properties. Would you be open to a quick conversation about your property's current market value?`
      }
      // Residential seller
      if (area) {
        return `Hi ${firstName}, properties like yours at ${address} are in high demand in ${area} right now. I'd love to share what similar properties have been going for. Would you be open to a brief chat?`
      }
      return `Hi ${firstName}, I noticed your property at ${address} and wanted to reach out. The market has been very active and I have buyers looking in your area. Would you be open to a quick conversation about your property's current market value?`
    }

    case 'tenant': {
      const locationHint = ctx.locationPreference || area || 'your preferred area'
      return `Hi ${firstName}, this is ${ctx.agentName}. I have a few commercial spaces available in ${locationHint} that could be a great fit. Whether you're looking for office, retail, or flex space — I'd love to understand what you need and match you with the right property. Would you be open to a quick call?`
    }

    case 'buyer': {
      const locationHint = ctx.locationPreference || area || 'your preferred area'
      if (isCommercial) {
        return `Hi ${firstName}, I have some commercial properties in ${locationHint} that match what buyers in your space are looking for — a few aren't on the market yet. Would you be open to a quick call to go over what's available?`
      }
      return `Hi ${firstName}, I understand you're looking for property in ${locationHint}. We have some listings that match what you're looking for — a few aren't even on the market yet. Would you be open to a quick chat?`
    }

    case 'investor': {
      const investArea = ctx.locationPreference || area || 'the area'
      return `Hi ${firstName}, I work with investors looking at properties in ${investArea}. Values haven't reached peak pricing yet and we're seeing strong cap rates on a few deals. Would you be interested in hearing about some opportunities?`
    }

    case 'expired': {
      // From EXPIRED LISTING APPROACH script
      return `Hi ${firstName}, I noticed your property at ${address} was previously on the market. Even the best properties don't always sell on the first go — it usually just takes a fresh approach. Would you be open to a quick conversation about a new strategy?`
    }

    case 'cold':
    default: {
      // Generic but still personalized
      const areaHint = ctx.locationPreference || area
      if (areaHint) {
        return `Hi ${firstName}, this is ${ctx.agentName}. The ${areaHint} market has been very active and I wanted to connect. Whether you're looking to buy, sell, lease, or just want to know what's happening in your area — I'd love to share some insights. Would you be open to a quick chat?`
      }
      return `Hi ${firstName}, this is ${ctx.agentName}. I wanted to connect about ${address}. Whether you're exploring selling, buying, leasing, or just curious about the market — I'd love to share some insights. Would you be open to a quick conversation?`
    }
  }
}
