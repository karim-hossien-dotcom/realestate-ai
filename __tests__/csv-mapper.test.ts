import { describe, it, expect } from 'vitest'
import { autoMapColumns, applyMapping } from '@/app/lib/csv-mapper'

describe('autoMapColumns()', () => {
  describe('Pass 1: exact alias match (high confidence)', () => {
    it('maps "Phone Number" to phone', () => {
      const result = autoMapColumns(['Phone Number'], [{ 'Phone Number': '555-1234' }])
      expect(result[0].mappedField).toBe('phone')
      expect(result[0].confidence).toBe('high')
    })

    it('maps "email" to email', () => {
      const result = autoMapColumns(['email'], [{ email: 'test@example.com' }])
      expect(result[0].mappedField).toBe('email')
      expect(result[0].confidence).toBe('high')
    })

    it('maps "Full Name" to owner_name', () => {
      const result = autoMapColumns(['Full Name'], [{ 'Full Name': 'John Doe' }])
      expect(result[0].mappedField).toBe('owner_name')
      expect(result[0].confidence).toBe('high')
    })

    it('maps "First Name" and "Last Name"', () => {
      const result = autoMapColumns(['First Name', 'Last Name'], [{ 'First Name': 'John', 'Last Name': 'Doe' }])
      expect(result[0].mappedField).toBe('first_name')
      expect(result[1].mappedField).toBe('last_name')
    })

    it('maps "property_address" to property_address', () => {
      const result = autoMapColumns(['property_address'], [{ property_address: '123 Main St' }])
      expect(result[0].mappedField).toBe('property_address')
      expect(result[0].confidence).toBe('high')
    })

    it('maps "Lead Status" to status', () => {
      const result = autoMapColumns(['Lead Status'], [{ 'Lead Status': 'new' }])
      expect(result[0].mappedField).toBe('status')
      expect(result[0].confidence).toBe('high')
    })

    it('maps "notes" to notes', () => {
      const result = autoMapColumns(['notes'], [{ notes: 'some notes' }])
      expect(result[0].mappedField).toBe('notes')
      expect(result[0].confidence).toBe('high')
    })

    it('maps "tags" to tags', () => {
      const result = autoMapColumns(['tags'], [{ tags: 'hot,seller' }])
      expect(result[0].mappedField).toBe('tags')
      expect(result[0].confidence).toBe('high')
    })
  })

  describe('Pass 2: substring/fuzzy match (medium confidence)', () => {
    it('maps header containing alias as substring', () => {
      const result = autoMapColumns(['Contact Phone Number'], [{ 'Contact Phone Number': '555-1234' }])
      expect(result[0].mappedField).toBe('phone')
      expect(result[0].confidence).toBe('medium')
    })
  })

  describe('Pass 3: content-based detection (low confidence)', () => {
    it('detects email from content with @ and .', () => {
      const rows = [
        { 'Col A': 'user1@gmail.com' },
        { 'Col A': 'user2@yahoo.com' },
        { 'Col A': 'user3@test.com' },
      ]
      const result = autoMapColumns(['Col A'], rows)
      expect(result[0].mappedField).toBe('email')
      expect(result[0].confidence).toBe('low')
    })

    it('detects phone from content with 7-15 digits', () => {
      const rows = [
        { 'Col B': '(555) 123-4567' },
        { 'Col B': '555-987-6543' },
        { 'Col B': '+1 555-111-2222' },
      ]
      const result = autoMapColumns(['Col B'], rows)
      expect(result[0].mappedField).toBe('phone')
      expect(result[0].confidence).toBe('low')
    })

    it('detects address from content with street keywords + numbers', () => {
      const rows = [
        { 'Col C': '123 Main Street' },
        { 'Col C': '456 Oak Avenue' },
        { 'Col C': '789 Elm Drive' },
      ]
      const result = autoMapColumns(['Col C'], rows)
      expect(result[0].mappedField).toBe('property_address')
      expect(result[0].confidence).toBe('low')
    })

    it('does not detect email when < 50% match', () => {
      const rows = [
        { 'Col D': 'user@gmail.com' },
        { 'Col D': 'not an email' },
        { 'Col D': 'also not' },
        { 'Col D': 'nope' },
      ]
      const result = autoMapColumns(['Col D'], rows)
      expect(result[0].mappedField).toBeNull()
    })
  })

  describe('each field used only once', () => {
    it('does not double-map phone', () => {
      const result = autoMapColumns(['phone', 'cell'], [{ phone: '555-1234', cell: '555-5678' }])
      expect(result[0].mappedField).toBe('phone')
      // cell should not be phone again
      expect(result[1].mappedField).not.toBe('phone')
    })
  })

  describe('address sub-fields', () => {
    it('detects street as property_address (alias match takes priority)', () => {
      // "street" is an exact alias for property_address, so it matches first
      const result = autoMapColumns(
        ['street', 'city', 'zip'],
        [{ street: '123 Main', city: 'Hoboken', zip: '07030' }]
      )
      expect(result[0].mappedField).toBe('property_address')
      expect(result[0].confidence).toBe('high')
    })

    it('city maps to location_preference (alias match), not address sub-field', () => {
      // "city" is an alias for location_preference in HEADER_ALIASES
      // so it matches as a main field before sub-field detection
      const result = autoMapColumns(
        ['street address', 'city', 'zip code'],
        [{ 'street address': '123 Main', city: 'Hoboken', 'zip code': '07030' }]
      )
      expect(result[0].mappedField).toBe('property_address')
      expect(result[1].mappedField).toBe('location_preference')
      // zip code doesn't match any main field alias, gets sub-field tag
      expect(result[2].mappedField).toBe('_address_zip')
    })
  })

  describe('sample values', () => {
    it('includes up to 5 sample values', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({ name: `Person ${i}` }))
      const result = autoMapColumns(['name'], rows)
      expect(result[0].sampleValues).toHaveLength(5)
      expect(result[0].sampleValues[0]).toBe('Person 0')
    })
  })

  describe('unmapped columns', () => {
    it('returns null for unrecognized headers with no content match', () => {
      const result = autoMapColumns(['Random Col'], [{ 'Random Col': 'abc' }])
      expect(result[0].mappedField).toBeNull()
      expect(result[0].confidence).toBe('none')
    })
  })
})

describe('applyMapping()', () => {
  describe('basic field mapping', () => {
    it('maps owner_name directly', () => {
      const lead = applyMapping(
        { 'Name': 'John Doe' },
        { 'Name': 'owner_name' }
      )
      expect(lead.owner_name).toBe('John Doe')
    })

    it('maps phone with sanitization', () => {
      const lead = applyMapping(
        { 'Phone': '(555) 123-4567' },
        { 'Phone': 'phone' }
      )
      expect(lead.phone).toBe('(555) 123-4567')
    })

    it('strips non-phone characters', () => {
      const lead = applyMapping(
        { 'Phone': 'Call: 555-1234 ext' },
        { 'Phone': 'phone' }
      )
      // Only keeps 0-9, +, -, (, ), space
      expect(lead.phone).toBe(' 555-1234 ')
    })

    it('maps email', () => {
      const lead = applyMapping(
        { 'Email': 'test@example.com' },
        { 'Email': 'email' }
      )
      expect(lead.email).toBe('test@example.com')
    })

    it('maps property_address', () => {
      const lead = applyMapping(
        { 'Address': '123 Main St, Hoboken, NJ' },
        { 'Address': 'property_address' }
      )
      expect(lead.property_address).toBe('123 Main St, Hoboken, NJ')
    })
  })

  describe('name merging', () => {
    it('merges first_name + last_name when no owner_name', () => {
      const lead = applyMapping(
        { 'First': 'John', 'Last': 'Doe' },
        { 'First': 'first_name', 'Last': 'last_name' }
      )
      expect(lead.owner_name).toBe('John Doe')
    })

    it('uses only first_name when last_name empty', () => {
      const lead = applyMapping(
        { 'First': 'John', 'Last': '' },
        { 'First': 'first_name', 'Last': 'last_name' }
      )
      expect(lead.owner_name).toBe('John')
    })

    it('prefers direct owner_name over first+last', () => {
      const lead = applyMapping(
        { 'Name': 'Jane Smith', 'First': 'John', 'Last': 'Doe' },
        { 'Name': 'owner_name', 'First': 'first_name', 'Last': 'last_name' }
      )
      expect(lead.owner_name).toBe('Jane Smith')
    })
  })

  describe('address merging', () => {
    it('merges street + city + state + zip', () => {
      const lead = applyMapping(
        { 'Street': '123 Main', 'City': 'Hoboken', 'State': 'NJ', 'Zip': '07030' },
        { 'Street': '_address_street', 'City': '_address_city', 'State': '_address_state', 'Zip': '_address_zip' }
      )
      expect(lead.property_address).toBe('123 Main, Hoboken, NJ, 07030')
    })

    it('merges partial address (street + city only)', () => {
      const lead = applyMapping(
        { 'Street': '123 Main', 'City': 'Hoboken' },
        { 'Street': '_address_street', 'City': '_address_city' }
      )
      expect(lead.property_address).toBe('123 Main, Hoboken')
    })

    it('prefers direct property_address over parts', () => {
      const lead = applyMapping(
        { 'Addr': '789 Full Addr', 'Street': '123 Main' },
        { 'Addr': 'property_address', 'Street': '_address_street' }
      )
      expect(lead.property_address).toBe('789 Full Addr')
    })
  })

  describe('status normalization', () => {
    it('lowercases and replaces spaces with underscores', () => {
      const lead = applyMapping(
        { 'Status': 'Hot Lead' },
        { 'Status': 'status' }
      )
      expect(lead.status).toBe('hot_lead')
    })
  })

  describe('tags splitting', () => {
    it('splits by comma', () => {
      const lead = applyMapping(
        { 'Tags': 'hot,seller,commercial' },
        { 'Tags': 'tags' }
      )
      expect(lead.tags).toEqual(['hot', 'seller', 'commercial'])
    })

    it('splits by semicolon', () => {
      const lead = applyMapping(
        { 'Tags': 'hot;seller' },
        { 'Tags': 'tags' }
      )
      expect(lead.tags).toEqual(['hot', 'seller'])
    })

    it('splits by pipe', () => {
      const lead = applyMapping(
        { 'Tags': 'hot|seller' },
        { 'Tags': 'tags' }
      )
      expect(lead.tags).toEqual(['hot', 'seller'])
    })

    it('trims whitespace from tags', () => {
      const lead = applyMapping(
        { 'Tags': ' hot , seller , commercial ' },
        { 'Tags': 'tags' }
      )
      expect(lead.tags).toEqual(['hot', 'seller', 'commercial'])
    })
  })

  describe('budget parsing', () => {
    it('parses dollar amounts', () => {
      const lead = applyMapping(
        { 'Min': '$500,000', 'Max': '$1,200,000' },
        { 'Min': 'budget_min', 'Max': 'budget_max' }
      )
      expect(lead.budget_min).toBe(500000)
      expect(lead.budget_max).toBe(1200000)
    })

    it('returns null for non-numeric budget', () => {
      const lead = applyMapping(
        { 'Min': 'TBD' },
        { 'Min': 'budget_min' }
      )
      expect(lead.budget_min).toBeNull()
    })

    it('parses plain numbers', () => {
      const lead = applyMapping(
        { 'Max': '750000' },
        { 'Max': 'budget_max' }
      )
      expect(lead.budget_max).toBe(750000)
    })
  })

  describe('defaults', () => {
    it('has correct defaults for empty mapping', () => {
      const lead = applyMapping({}, {})
      expect(lead.status).toBe('new')
      expect(lead.contact_preference).toBe('sms')
      expect(lead.tags).toEqual([])
      expect(lead.owner_name).toBeNull()
      expect(lead.phone).toBeNull()
      expect(lead.email).toBeNull()
      expect(lead.property_address).toBeNull()
      expect(lead.property_type).toBeNull()
      expect(lead.budget_min).toBeNull()
      expect(lead.budget_max).toBeNull()
      expect(lead.location_preference).toBeNull()
      expect(lead.notes).toBeNull()
    })
  })

  describe('empty values skipped', () => {
    it('does not map empty string values', () => {
      const lead = applyMapping(
        { 'Name': '', 'Phone': '' },
        { 'Name': 'owner_name', 'Phone': 'phone' }
      )
      expect(lead.owner_name).toBeNull()
      expect(lead.phone).toBeNull()
    })
  })
})
