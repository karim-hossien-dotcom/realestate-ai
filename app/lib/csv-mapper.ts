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
  { value: 'budget_min', label: 'Budget Min' },
  { value: 'budget_max', label: 'Budget Max' },
  { value: 'location_preference', label: 'Location Preference' },
]

// ---------------------------------------------------------------------------
// Alias dictionary — maps normalized header names to lead fields
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<LeadField, string[]> = {
  phone: [
    'phone', 'phone number', 'phone_number', 'mobile', 'cell', 'tel',
    'telephone', 'contact number', 'primary phone', 'cell phone',
    'mobile phone', 'home phone', 'work phone',
  ],
  email: [
    'email', 'email address', 'email_address', 'e-mail', 'e_mail',
    'contact email', 'primary email',
  ],
  owner_name: [
    'name', 'full name', 'full_name', 'owner name', 'owner_name',
    'contact name', 'contact_name', 'lead name', 'client name', 'client',
  ],
  first_name: [
    'first name', 'first_name', 'firstname', 'first', 'given name',
  ],
  last_name: [
    'last name', 'last_name', 'lastname', 'last', 'surname', 'family name',
  ],
  property_address: [
    'address', 'property address', 'property_address', 'street address',
    'street', 'full address', 'mailing address', 'home address', 'location',
  ],
  status: [
    'status', 'lead status', 'lead_status', 'stage', 'disposition',
  ],
  notes: [
    'notes', 'note', 'comments', 'comment', 'description', 'remarks',
  ],
  contact_preference: [
    'contact preference', 'contact_preference', 'preferred channel',
    'channel', 'contact method',
  ],
  tags: [
    'tags', 'tag', 'labels', 'label', 'categories', 'category',
  ],
  property_type: [
    'property type', 'property_type', 'type', 'listing type',
  ],
  budget_min: [
    'budget min', 'budget_min', 'min budget', 'min price', 'price min',
  ],
  budget_max: [
    'budget max', 'budget_max', 'max budget', 'max price', 'price max',
  ],
  location_preference: [
    'location', 'location preference', 'preferred location', 'area',
    'neighborhood', 'city',
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

  return lead
}
