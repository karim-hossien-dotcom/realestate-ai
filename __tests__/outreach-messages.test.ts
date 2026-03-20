import { describe, it, expect } from 'vitest'
import { generateOutreachMessage } from '@/app/lib/messaging/outreach-messages'

const base = { agentName: 'Nadine Khalil' }

describe('generateOutreachMessage()', () => {
  describe('intent detection from propertyInterest', () => {
    it('detects seller from "sell"', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: 'John', propertyInterest: 'Looking to sell', propertyAddress: '123 Main St, Hoboken, NJ' })
      expect(msg).toContain('high demand')
      expect(msg).toContain('Hi John')
    })

    it('detects seller from "listing"', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: 'Jane', propertyInterest: 'New listing', propertyAddress: '456 Oak Ave' })
      expect(msg).toContain('Hi Jane')
    })

    it('detects buyer from "buy"', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: 'Alice', propertyInterest: 'Want to buy' })
      expect(msg).toContain('listings that match')
    })

    it('detects buyer from "purchasing"', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: 'Bob', propertyInterest: 'Purchasing commercial' })
      expect(msg).toContain('Hi Bob')
    })

    it('detects buyer from "looking"', () => {
      const msg = generateOutreachMessage({ ...base, propertyInterest: 'Looking for space' })
      expect(msg).toContain('Hi there')
    })

    it('detects investor from "invest"', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: 'Carol', propertyInterest: 'Investment property' })
      expect(msg).toContain('cap rates')
    })
  })

  describe('intent detection from notes', () => {
    it('detects seller from "motivated seller"', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: 'Dave', notes: 'Motivated seller, wants fast close', propertyAddress: '789 Elm Dr, Newark, NJ' })
      expect(msg).toContain('Hi Dave')
      expect(msg).toContain('high demand')
    })

    it('detects seller from "pre-foreclosure"', () => {
      const msg = generateOutreachMessage({ ...base, notes: 'In pre-foreclosure' })
      expect(msg).not.toContain('cap rates')
    })

    it('detects seller from "fsbo"', () => {
      const msg = generateOutreachMessage({ ...base, notes: 'Listed as FSBO on Zillow' })
      expect(msg).toContain('Hi there')
    })

    it('detects expired from "expired listing"', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: 'Eve', notes: 'Expired listing from 2024', propertyAddress: '100 Park Ave' })
      expect(msg).toContain('fresh approach')
    })

    it('detects expired from "didn\'t sell"', () => {
      const msg = generateOutreachMessage({ ...base, notes: "Property didn't sell last year" })
      expect(msg).toContain('fresh approach')
    })

    it('detects buyer from "looking to buy"', () => {
      const msg = generateOutreachMessage({ ...base, notes: 'Looking to buy in downtown' })
      expect(msg).toContain('listings')
    })

    it('detects investor from "rental"', () => {
      const msg = generateOutreachMessage({ ...base, notes: 'Interested in rental properties' })
      expect(msg).toContain('cap rates')
    })

    it('detects investor from "cap rate"', () => {
      const msg = generateOutreachMessage({ ...base, notes: 'Wants 7% cap rate minimum' })
      expect(msg).toContain('cap rates')
    })

    it('detects investor from "portfolio"', () => {
      const msg = generateOutreachMessage({ ...base, notes: 'Building a portfolio' })
      expect(msg).toContain('cap rates')
    })
  })

  describe('intent detection from tags', () => {
    it('detects seller from seller tag', () => {
      const msg = generateOutreachMessage({ ...base, tags: ['seller', 'commercial'] })
      expect(msg).not.toContain('cap rates')
      expect(msg).not.toContain('fresh approach')
    })

    it('detects buyer from buyer tag', () => {
      const msg = generateOutreachMessage({ ...base, tags: ['buyer'] })
      expect(msg).toContain('listings')
    })

    it('detects investor from investor tag', () => {
      const msg = generateOutreachMessage({ ...base, tags: ['investor'] })
      expect(msg).toContain('cap rates')
    })

    it('detects expired from expired tag', () => {
      const msg = generateOutreachMessage({ ...base, tags: ['expired'] })
      expect(msg).toContain('fresh approach')
    })
  })

  describe('intent detection from status', () => {
    it('detects seller from "hot" status', () => {
      const msg = generateOutreachMessage({ ...base, status: 'hot', propertyAddress: '1 Broadway, Manhattan, NY' })
      expect(msg).toContain('Hi there')
    })

    it('detects seller from "warm" status', () => {
      const msg = generateOutreachMessage({ ...base, status: 'warm' })
      expect(msg).not.toContain('cap rates')
      expect(msg).not.toContain('fresh approach')
    })

    it('falls back to cold for unknown status', () => {
      const msg = generateOutreachMessage({ ...base, status: 'new' })
      expect(msg).toContain('noticed your property')
    })
  })

  describe('commercial vs residential branching', () => {
    it('seller + commercial + area mentions "high demand"', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: 'Frank', propertyInterest: 'selling', propertyType: 'Commercial Office', propertyAddress: '500 Main St, Hoboken, NJ' })
      expect(msg).toContain('high demand in Hoboken')
      expect(msg).toContain('overflow of buyers')
    })

    it('seller + commercial + no area mentions "sold a building"', () => {
      const msg = generateOutreachMessage({ ...base, propertyInterest: 'sell', propertyType: 'commercial', propertyAddress: '500 Main St' })
      expect(msg).toContain('sold a building near')
    })

    it('buyer + commercial mentions "commercial space"', () => {
      const msg = generateOutreachMessage({ ...base, propertyInterest: 'buy', propertyType: 'Commercial' })
      expect(msg).toContain('commercial space')
    })

    it('buyer + residential mentions "listings that match"', () => {
      const msg = generateOutreachMessage({ ...base, propertyInterest: 'buying' })
      expect(msg).toContain('listings that match')
    })
  })

  describe('area extraction', () => {
    it('extracts city from full address', () => {
      const msg = generateOutreachMessage({ ...base, status: 'hot', propertyAddress: '789 Elm Dr, Hoboken, NJ 07030' })
      expect(msg).toContain('Hoboken')
    })

    it('returns null area from address without city', () => {
      const msg = generateOutreachMessage({ ...base, status: 'hot', propertyAddress: '123 Main St' })
      // No area → should use address-only variant
      expect(msg).toContain('123 Main St')
    })
  })

  describe('missing ownerName', () => {
    it('uses "there" when ownerName is null', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: null })
      expect(msg).toContain('Hi there')
    })

    it('uses "there" when ownerName is undefined', () => {
      const msg = generateOutreachMessage({ ...base })
      expect(msg).toContain('Hi there')
    })

    it('uses first name only', () => {
      const msg = generateOutreachMessage({ ...base, ownerName: 'John Smith' })
      expect(msg).toContain('Hi John')
      expect(msg).not.toContain('Smith')
    })
  })

  describe('locationPreference for buyer/investor', () => {
    it('buyer uses locationPreference over area', () => {
      const msg = generateOutreachMessage({ ...base, propertyInterest: 'buy', locationPreference: 'Downtown Newark', propertyAddress: '123 Main, Hoboken, NJ' })
      expect(msg).toContain('Downtown Newark')
    })

    it('investor uses locationPreference', () => {
      const msg = generateOutreachMessage({ ...base, propertyInterest: 'invest', locationPreference: 'Jersey City waterfront' })
      expect(msg).toContain('Jersey City waterfront')
    })
  })

  describe('cold/default messages', () => {
    it('cold with area mentions market', () => {
      const msg = generateOutreachMessage({ ...base, propertyAddress: '100 1st Ave, Hoboken, NJ' })
      expect(msg).toContain('Hoboken market')
    })

    it('cold without area is generic', () => {
      const msg = generateOutreachMessage({ ...base, propertyAddress: '100 1st Ave' })
      expect(msg).toContain('noticed your property')
    })

    it('cold with no address uses "your property"', () => {
      const msg = generateOutreachMessage({ ...base })
      expect(msg).toContain('your property')
    })
  })

  describe('priority ordering', () => {
    it('propertyInterest takes priority over notes', () => {
      const msg = generateOutreachMessage({ ...base, propertyInterest: 'invest', notes: 'motivated seller' })
      expect(msg).toContain('cap rates')
    })

    it('notes take priority over tags', () => {
      const msg = generateOutreachMessage({ ...base, notes: 'expired listing', tags: ['buyer'] })
      expect(msg).toContain('fresh approach')
    })

    it('tags take priority over status', () => {
      const msg = generateOutreachMessage({ ...base, tags: ['investor'], status: 'hot' })
      expect(msg).toContain('cap rates')
    })
  })
})
