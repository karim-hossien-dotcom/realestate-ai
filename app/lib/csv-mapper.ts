/**
 * Smart CSV Column Mapper
 *
 * Auto-detects and maps CSV headers from various export formats
 * (MLS, Follow Up Boss, Zillow, etc.) to Estate AI lead fields.
 */

export type LeadField =
  | 'phone'
  | 'email'
  | 'owner_name'
  | 'first_name'
  | 'last_name'
  | 'property_address'
  | 'status'
  | 'notes'
  | 'contact_preference'
  | 'tags'
  | 'property_type'
  | 'property_interest'
  | 'budget_min'
  | 'budget_max'
  | 'location_preference'

export type Confidence = 'high' | 'medium' | 'low' | 'none'

export type ColumnMapping = {
  csvHeader: string
  mappedField: LeadField | null
  confidence: Confidence
  sampleValues: string[]
}

/** Fields the user can pick in the mapping dropdown */
export const MAPPABLE_FIELDS: { value: LeadField | '(skip)'; label: string }[] = [
  { value: '(skip)' as LeadField | '(skip)', label: '(Skip this column)' },
  { value: 'owner_name', label: 'Name' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'property_address', label: 'Address' },
  { value: 'status', label: 'Status' },
  { value: 'notes', label: 'Notes' },
  { value: 'contact_preference', label: 'Contact Preference' },
  { value: 'tags', label: 'Tags' },
  { value: 'property_type', label: 'Property Type' },
  { value: 'property_interest', label: 'Interest (Buyer/Seller/Investor)' },
  { value: 'budget_min', label: 'Budget Min / List Price' },
  { value: 'budget_max', label: 'Budget Max / Ask Price' },
  { value: 'location_preference', label: 'Location Preference' },
]

// ---------------------------------------------------------------------------
// Alias dictionary — maps normalized header names to lead fields
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<LeadField, string[]> = {
  phone: [
    'phone', 'phone number', 'phone_number', 'mobile', 'cell', 'tel',
    'telephone', 'contact number', 'primary phone', 'cell phone',
    'mobile phone', 'home phone', 'work phone', 'phone1', 'phone 1',
    // FUB
    'phones', 'best phone', 'direct phone',
    // MLS / Zillow
    'owner phone', 'listing agent phone', 'agent phone',
  ],
  email: [
    'email', 'email address', 'email_address', 'e-mail', 'e_mail',
    'contact email', 'primary email', 'email1', 'email 1',
    // FUB
    'emails', 'best email',
    // MLS
    'owner email', 'listing agent email', 'agent email',
  ],
  owner_name: [
    'name', 'full name', 'full_name', 'owner name', 'owner_name',
    'contact name', 'contact_name', 'lead name', 'client name', 'client',
    // FUB
    'people', 'person', 'contact',
    // MLS / Public Records
    'owner', 'property owner', 'owner 1', 'owner1',
  ],
  first_name: [
    'first name', 'first_name', 'firstname', 'first', 'given name',
    'fname', 'f name',
  ],
  last_name: [
    'last name', 'last_name', 'lastname', 'last', 'surname', 'family name',
    'lname', 'l name',
  ],
  property_address: [
    'address', 'property address', 'property_address', 'street address',
    'street', 'full address', 'mailing address', 'home address',
    // MLS / Public Records
    'site address', 'situs address', 'property location', 'listing address',
    'subject property address', 'parcel address',
  ],
  status: [
    'status', 'lead status', 'lead_status', 'stage', 'disposition',
    // FUB
    'people stage', 'pipeline stage', 'deal stage',
    // MLS
    'listing status', 'mls status',
  ],
  notes: [
    'notes', 'note', 'comments', 'comment', 'description', 'remarks',
    // FUB
    'background', 'bio', 'summary',
  ],
  contact_preference: [
    'contact preference', 'contact_preference', 'preferred channel',
    'channel', 'contact method', 'preferred contact',
  ],
  tags: [
    'tags', 'tag', 'labels', 'label', 'categories', 'category',
    // FUB
    'lead tags', 'groups', 'lists',
  ],
  property_type: [
    'property type', 'property_type', 'type', 'listing type',
    // MLS
    'prop type', 'building type', 'class', 'property class',
    'use code', 'land use', 'zoning',
    // Commercial
    'asset type', 'asset class',
  ],
  property_interest: [
    'interest', 'property interest', 'property_interest', 'intent',
    'lead type', 'lead_type', 'buyer seller', 'buyer or seller',
    // FUB
    'people type', 'contact type', 'role',
    // Common CRM
    'looking to', 'goal', 'objective', 'motivation',
    'buying or selling', 'transaction type', 'deal type',
  ],
  budget_min: [
    'budget min', 'budget_min', 'min budget', 'min price', 'price min',
    'low price', 'price from', 'starting price',
    // MLS
    'list price', 'listing price', 'asking price', 'price',
    'original price', 'current price',
  ],
  budget_max: [
    'budget max', 'budget_max', 'max budget', 'max price', 'price max',
    'high price', 'price to', 'max listing price',
    // Buyer searches
    'search price max', 'budget', 'price range',
  ],
  location_preference: [
    'location preference', 'preferred location',
    'neighborhood', 'preferred area', 'target area',
    // FUB
    'search city', 'search area', 'desired location',
    // MLS
    'subdivision', 'community', 'development',
  ],
}

// Address sub-field headers (for merging street+city+state+zip)
const ADDRESS_PARTS: Record<string, string[]> = {
  street: ['street', 'street address', 'address line', 'address line 1', 'address1'],
  city: ['city', 'town'],
  state: ['state', 'province', 'st'],
  zip: ['zip', 'zip code', 'zipcode', 'postal code', 'postal'],
}

// ---------------------------------------------------------------------------
// Normalize a header string for matching
// ---------------------------------------------------------------------------

function normalize(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, ' ')  // replace special chars with space
    .replace(/\s+/g, ' ')          // collapse whitespace
    .trim()
}

// ---------------------------------------------------------------------------
// Content-based detection helpers
// ---------------------------------------------------------------------------

function looksLikeEmail(values: string[]): boolean {
  const valid = values.filter(Boolean)
  if (valid.length === 0) return false
  const emailCount = valid.filter(v => v.includes('@') && v.includes('.')).length
  return emailCount / valid.length >= 0.5
}

function looksLikePhone(values: string[]): boolean {
  const valid = values.filter(Boolean)
  if (valid.length === 0) return false
  const phoneCount = valid.filter(v => {
    const digits = v.replace(/\D/g, '')
    return digits.length >= 7 && digits.length <= 15
  }).length
  return phoneCount / valid.length >= 0.5
}

function looksLikeAddress(values: string[]): boolean {
  const valid = values.filter(Boolean)
  if (valid.length === 0) return false
  const streetKeywords = /\b(ave|avenue|st|street|blvd|boulevard|dr|drive|rd|road|ct|court|ln|lane|way|pl|place|cir|circle|hwy|highway)\b/i
  const addressCount = valid.filter(v => streetKeywords.test(v) && /\d/.test(v)).length
  return addressCount / valid.length >= 0.4
}

// ---------------------------------------------------------------------------
// Core mapping function
// ---------------------------------------------------------------------------

export function autoMapColumns(
  headers: string[],
  sampleRows: Record<string, string>[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = []
  const usedFields = new Set<LeadField>()

  // Pass 1: Exact alias match
  for (const header of headers) {
    const norm = normalize(header)
    let matched: LeadField | null = null
    let confidence: Confidence = 'none'

    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [LeadField, string[]][]) {
      if (usedFields.has(field)) continue
      if (aliases.includes(norm)) {
        matched = field
        confidence = 'high'
        break
      }
    }

    // Pass 2: Substring / fuzzy match
    if (!matched) {
      for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [LeadField, string[]][]) {
        if (usedFields.has(field)) continue
        const found = aliases.some(alias => norm.includes(alias) || alias.includes(norm))
        if (found) {
          matched = field
          confidence = 'medium'
          break
        }
      }
    }

    // Pass 3: Content-based detection
    if (!matched) {
      const colValues = sampleRows.map(row => row[header] || '').slice(0, 10)
      if (!usedFields.has('email') && looksLikeEmail(colValues)) {
        matched = 'email'
        confidence = 'low'
      } else if (!usedFields.has('phone') && looksLikePhone(colValues)) {
        matched = 'phone'
        confidence = 'low'
      } else if (!usedFields.has('property_address') && looksLikeAddress(colValues)) {
        matched = 'property_address'
        confidence = 'low'
      }
    }

    const sampleValues = sampleRows.slice(0, 5).map(row => row[header] || '')

    if (matched) {
      usedFields.add(matched)
    }

    mappings.push({
      csvHeader: header,
      mappedField: matched,
      confidence,
      sampleValues,
    })
  }

  // Check for address sub-fields that can be merged
  const addressPartHeaders: Record<string, string> = {}
  for (const mapping of mappings) {
    const norm = normalize(mapping.csvHeader)
    for (const [part, aliases] of Object.entries(ADDRESS_PARTS)) {
      if (aliases.includes(norm)) {
        addressPartHeaders[part] = mapping.csvHeader
        // If this column was unmapped, mark it for address merging
        if (!mapping.mappedField) {
          mapping.mappedField = `_address_${part}` as LeadField
          mapping.confidence = 'medium'
        }
        break
      }
    }
  }

  return mappings
}

// ---------------------------------------------------------------------------
// Apply mapping to transform a CSV row into a lead record
// ---------------------------------------------------------------------------

export type MappedLead = {
  owner_name: string | null
  phone: string | null
  email: string | null
  property_address: string | null
  status: string
  notes: string | null
  contact_preference: string
  tags: string[]
  property_type: string | null
  property_interest: string | null
  budget_min: number | null
  budget_max: number | null
  location_preference: string | null
}

export function applyMapping(
  row: Record<string, string>,
  mapping: Record<string, string> // csvHeader → leadField
): MappedLead {
  const lead: MappedLead = {
    owner_name: null,
    phone: null,
    email: null,
    property_address: null,
    status: 'new',
    notes: null,
    contact_preference: 'sms',
    tags: [],
    property_type: null,
    property_interest: null,
    budget_min: null,
    budget_max: null,
    location_preference: null,
  }

  let firstName = ''
  let lastName = ''
  const addressParts: { street?: string; city?: string; state?: string; zip?: string } = {}

  for (const [csvHeader, field] of Object.entries(mapping)) {
    const value = (row[csvHeader] || '').trim()
    if (!value) continue

    switch (field) {
      case 'owner_name':
        lead.owner_name = value
        break
      case 'first_name':
        firstName = value
        break
      case 'last_name':
        lastName = value
        break
      case 'phone':
        lead.phone = value.replace(/[^0-9+\-() ]/g, '') || null
        break
      case 'email':
        lead.email = value
        break
      case 'property_address':
        lead.property_address = value
        break
      case 'status':
        lead.status = value.toLowerCase().replace(/\s+/g, '_')
        break
      case 'notes':
        lead.notes = value
        break
      case 'contact_preference':
        lead.contact_preference = value.toLowerCase()
        break
      case 'tags':
        lead.tags = value.split(/[,;|]/).map(t => t.trim()).filter(Boolean)
        break
      case 'property_type':
        lead.property_type = value
        break
      case 'property_interest':
        lead.property_interest = normalizeInterest(value)
        break
      case 'budget_min': {
        const num = parseFloat(value.replace(/[^0-9.]/g, ''))
        lead.budget_min = isNaN(num) ? null : num
        break
      }
      case 'budget_max': {
        const num = parseFloat(value.replace(/[^0-9.]/g, ''))
        lead.budget_max = isNaN(num) ? null : num
        break
      }
      case 'location_preference':
        lead.location_preference = value
        break
      // Address sub-fields
      case '_address_street':
        addressParts.street = value
        break
      case '_address_city':
        addressParts.city = value
        break
      case '_address_state':
        addressParts.state = value
        break
      case '_address_zip':
        addressParts.zip = value
        break
    }
  }

  // Merge first + last name if owner_name wasn't directly mapped
  if (!lead.owner_name && (firstName || lastName)) {
    lead.owner_name = [firstName, lastName].filter(Boolean).join(' ')
  }

  // Merge address parts if property_address wasn't directly mapped
  if (!lead.property_address) {
    const parts = [addressParts.street, addressParts.city, addressParts.state, addressParts.zip]
      .filter(Boolean)
    if (parts.length > 0) {
      lead.property_address = parts.join(', ')
    }
  }

  // Auto-detect property_interest from status, tags, and notes if not explicitly mapped
  if (!lead.property_interest) {
    lead.property_interest = inferInterest(lead)
  }

  return lead
}

// ---------------------------------------------------------------------------
// Interest normalization and inference
// ---------------------------------------------------------------------------

/**
 * Normalize raw interest values to standard categories.
 * Maps various CRM export values to: sell, buy, invest, rent, valuation, or the original.
 */
function normalizeInterest(raw: string): string {
  const lower = raw.toLowerCase().trim()

  // Seller signals
  if (/sell|listing|list|fsbo|for sale|motivated seller|pre-foreclosure|probate|absentee|vacant|expired/.test(lower)) return 'sell'

  // Buyer signals
  if (/buy|purchas|looking|search|seeking|want.*home|need.*property|first.*time.*buyer|relocat/.test(lower)) return 'buy'

  // Investor signals
  if (/invest|rental|cap rate|noi|portfolio|flip|wholesale|1031|exchange/.test(lower)) return 'invest'

  // Rent signals
  if (/rent|lease|tenant/.test(lower)) return 'rent'

  // Valuation signals
  if (/valuat|apprais|cma|market analysis|what.*worth|home.*value/.test(lower)) return 'valuation'

  return raw.toLowerCase()
}

/**
 * Infer buyer/seller intent from status, tags, and notes when no explicit interest field exists.
 */
function inferInterest(lead: MappedLead): string | null {
  const signals: string[] = []
  if (lead.status) signals.push(lead.status)
  if (lead.notes) signals.push(lead.notes)
  if (lead.tags.length) signals.push(lead.tags.join(' '))

  const combined = signals.join(' ').toLowerCase()
  if (!combined) return null

  // Check for seller signals
  if (/sell|listing|fsbo|for sale|motivated|pre-foreclosure|probate|absentee|vacant|expired|owner occupied/.test(combined)) return 'sell'

  // Check for buyer signals
  if (/buy|purchas|looking|search|seeking|relocat|first time|pre-approved|pre-qual/.test(combined)) return 'buy'

  // Check for investor signals
  if (/invest|rental|cap rate|noi|portfolio|flip|wholesale/.test(combined)) return 'invest'

  // Check for common FUB/CRM stage names
  if (/new lead|hot|warm|nurture|prospect|active/.test(combined)) return null // ambiguous — let AI figure it out

  return null
}
