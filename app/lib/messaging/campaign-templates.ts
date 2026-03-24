/**
 * Campaign Message Templates — based on KW MAPS / ERG Commercial scripts.
 *
 * Each template has variants for WhatsApp/SMS (short) and Email (longer).
 * Placeholders: {{firstName}}, {{address}}, {{area}}, {{agentName}}, {{brokerage}}
 */

export interface CampaignTemplate {
  id: string
  name: string
  category: 'prospecting' | 'follow_up' | 'expired' | 'fsbo' | 'investor' | 'reengagement' | 'referral' | 'valuation'
  description: string
  smsBody: string
  emailSubject: string
  emailBody: string
  tags: string[]
  bestFor: string
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  // ─── PROSPECTING (from ERG Commercial Scripts + Circle Prospecting) ───
  {
    id: 'commercial-prospecting',
    name: 'Commercial Prospecting',
    category: 'prospecting',
    description: 'Cold outreach to commercial property owners. Based on ERG/KW Commercial scripts.',
    smsBody: `Hi {{firstName}}, we recently sold a building near {{address}} for a premium and have an overflow of buyers from that sale. We're reaching out to local property owners to see if you're considering selling in the next 3-6 months. Is this something you'd have interest in exploring? - {{agentName}}, {{brokerage}}`,
    emailSubject: 'Quick question about {{address}}',
    emailBody: `Hi {{firstName}},

We recently closed a deal near your property at {{address}} and have an overflow of qualified buyers still looking in {{area}}.

I'm reaching out to see if you'd be open to exploring what your property could sell for in today's market. We're seeing strong demand, and the timing could work in your favor.

Would you be open to a brief 10-minute call this week?

Best,
{{agentName}}
{{brokerage}}`,
    tags: ['commercial', 'cold outreach', 'KW script'],
    bestFor: 'Commercial property owners you haven\'t spoken to before',
  },

  {
    id: 'circle-prospecting',
    name: 'Circle Prospecting (Neighborhood)',
    category: 'prospecting',
    description: 'Reach out to homeowners in a specific neighborhood. From KW MAPS Circle Prospecting script.',
    smsBody: `Hi {{firstName}}, there's been a lot of interest in the {{area}} area recently. I'm reaching out to local property owners — who do you know that might be thinking of making a move this year? And just out of curiosity, when do you plan on moving? - {{agentName}}`,
    emailSubject: 'Activity in your neighborhood — {{area}}',
    emailBody: `Hi {{firstName}},

There's been increased interest in the {{area}} area, and I wanted to connect with local property owners to share what's happening.

I'm wondering — do you know anyone in your neighborhood who might be thinking of making a move this year?

And just out of curiosity — when do you see yourself making your next real estate move? Even if it's years out, I'd love to keep you updated on what properties in your area are going for.

I send a brief monthly market update to neighbors who want to keep their finger on the pulse. Would you like to receive that? If so, just reply with your email.

Best,
{{agentName}}
{{brokerage}}`,
    tags: ['residential', 'neighborhood', 'referral ask'],
    bestFor: 'Homeowners in a target neighborhood',
  },

  // ─── EXPIRED LISTINGS (from Scripts & Objection Handlers) ───
  {
    id: 'expired-listing',
    name: 'Expired Listing Outreach',
    category: 'expired',
    description: 'Reach out to owners whose listing expired without selling. From KW MAPS Expired Listing script.',
    smsBody: `Hi {{firstName}}, I noticed your property at {{address}} was previously listed but didn't sell. Even the best properties don't always sell on the first go — it usually just takes a new approach. Would you be open to a quick conversation about a different strategy? - {{agentName}}`,
    emailSubject: 'A fresh approach for {{address}}',
    emailBody: `Hi {{firstName}},

I noticed your property at {{address}} was on the market but didn't sell. I specialize in working with properties that need a fresh approach — and I've had strong success getting them sold.

What do you think prevented it from selling last time? Sometimes it comes down to marketing strategy, pricing, or simply the agent's approach.

I'd love to share what we do differently — we don't just put it on MLS and wait. We proactively prospect for buyers, aggressively market the property, and cold-call potential buyers daily.

Would you be open to hearing how we'd approach selling {{address}}? No commitment — just a conversation.

Best,
{{agentName}}
{{brokerage}}`,
    tags: ['expired', 'relisting', 'second chance'],
    bestFor: 'Properties that were listed but didn\'t sell',
  },

  // ─── FSBO (from FSBO Scripts) ───
  {
    id: 'fsbo-outreach',
    name: 'FSBO (For Sale By Owner)',
    category: 'fsbo',
    description: 'Reach out to FSBO sellers. From KW MAPS FSBO script.',
    smsBody: `Hi {{firstName}}, I saw your property at {{address}} is for sale by owner — is it still available? I work with buyers in the area and I'm building a list of all properties available, not just MLS. If you could keep doing what you're doing AND have an agent get you more money in less time, would you want to hear about it? - {{agentName}}`,
    emailSubject: 'Your FSBO listing at {{address}}',
    emailBody: `Hi {{firstName}},

I noticed your property at {{address}} is listed for sale by owner. Is it still available?

I work with buyers in {{area}} and I'm creating a list of all properties available — not just the ones listed on MLS. I'd love to add yours.

Here's the thing: if you could keep doing what you're doing AND have an aggressive agent on your side — and you knew I could get you more money in a shorter period of time — would you at least want to hear about it?

If I sell it for you, you have the option to take the offer. If you sell it on your own, you don't owe me anything. Zero risk.

Would you be open to a quick chat about how we could work together?

Best,
{{agentName}}
{{brokerage}}`,
    tags: ['fsbo', 'by owner', 'dual approach'],
    bestFor: 'Properties listed For Sale By Owner on Zillow, Craigslist, etc.',
  },

  // ─── INVESTOR (from Investment Pivot script) ───
  {
    id: 'investor-outreach',
    name: 'Investment Opportunity',
    category: 'investor',
    description: 'Reach out to potential investors. Based on KW investment pivot approach.',
    smsBody: `Hi {{firstName}}, I work with investors looking at properties in {{area}}. Values haven't reached peak pricing yet and we're seeing strong cap rates on a few deals right now. Would you be interested in hearing about some opportunities? - {{agentName}}`,
    emailSubject: 'Investment opportunities in {{area}}',
    emailBody: `Hi {{firstName}},

Have you thought about investing in real estate? Values in {{area}} haven't reached peak pricing yet, and it's still a great time to build wealth through investment properties.

We have a team looking for the best deals 7 days a week. If we find an amazing opportunity, would you be interested in hearing about it?

A few things I can share:
- Current cap rates in {{area}}
- Off-market deals before they hit MLS
- Properties with strong rental potential

Would you be open to a quick call to discuss what you're looking for?

Best,
{{agentName}}
{{brokerage}}`,
    tags: ['investor', 'cap rate', 'off-market'],
    bestFor: 'Potential investors or people who declined selling but might invest',
  },

  // ─── RE-ENGAGEMENT (from Old/Cold Leads script) ───
  {
    id: 'cold-reengagement',
    name: 'Cold Lead Re-engagement',
    category: 'reengagement',
    description: 'Reconnect with leads who went cold. From KW old/cold leads approach.',
    smsBody: `Hi {{firstName}}, it's {{agentName}} from {{brokerage}}. You reached out a while back about real estate. I wanted to check — did you end up buying or selling, or are you still in the market? Either way, I'd love to reconnect. - {{agentName}}`,
    emailSubject: 'Checking in — still in the market?',
    emailBody: `Hi {{firstName}},

It's {{agentName}} from {{brokerage}}. We connected a while back about real estate, and I wanted to check in.

Did you end up buying or selling? Or are you still exploring your options?

If you own property: We have buyers constantly searching in your area. If you're considering selling within the next 12 months, I can add you to our off-market exclusive inventory list — only available to our preferred buyers. If one matches your timeline, it makes life a lot easier.

If you're looking to buy: The market has shifted since we last spoke, and there are some great opportunities I'd love to show you.

Either way — what's the best email to send you some exclusive info about our preferred buyer/seller network?

Best,
{{agentName}}
{{brokerage}}`,
    tags: ['cold lead', 'nurture', 'check-in'],
    bestFor: 'Leads who inquired 3+ months ago and went silent',
  },

  // ─── VALUATION (from Objection Handler scripts) ───
  {
    id: 'free-valuation',
    name: 'Free Property Valuation',
    category: 'valuation',
    description: 'Offer a free market analysis / CMA. Strong lead magnet.',
    smsBody: `Hi {{firstName}}, I'm offering complimentary market valuations for properties in {{area}} this month. Curious what {{address}} could sell for in today's market? I can put together a detailed analysis — no obligation. Interested? - {{agentName}}`,
    emailSubject: 'What is {{address}} worth today?',
    emailBody: `Hi {{firstName}},

Curious what your property at {{address}} could sell for in today's market?

I'm offering complimentary market valuations for properties in {{area}} this month. It's a thorough analysis — not just an online estimate — based on recent comparable sales, current market conditions, and your property's unique features.

No obligation, no pressure. Just real numbers you can use to make informed decisions, whether you're thinking about selling now or in the future.

Want me to put one together for you? Just reply "yes" and I'll get started.

Best,
{{agentName}}
{{brokerage}}`,
    tags: ['valuation', 'CMA', 'lead magnet'],
    bestFor: 'Any property owner — great for generating warm conversations',
  },

  // ─── REFERRAL ASK ───
  {
    id: 'referral-ask',
    name: 'Referral Request',
    category: 'referral',
    description: 'Ask past contacts for referrals. From KW MAPS referral approach.',
    smsBody: `Hi {{firstName}}, hope you're doing well! Quick question — do you know anyone in your circle who's been thinking about buying, selling, or investing in real estate? I'd love to help them out. Thanks! - {{agentName}}`,
    emailSubject: 'Know anyone looking to buy or sell?',
    emailBody: `Hi {{firstName}},

Hope you're doing well! I wanted to reach out with a quick question.

Do you have any friends, family, or neighbors who have mentioned they might be thinking about buying, selling, or investing in real estate?

I'd love to help them out — and I always make sure anyone you refer gets my full attention and best service.

No pressure at all — just thought I'd ask since you know a lot of great people. Thanks for thinking of me!

Best,
{{agentName}}
{{brokerage}}`,
    tags: ['referral', 'sphere', 'past clients'],
    bestFor: 'Past clients, sphere of influence, anyone you\'ve worked with',
  },

  // ─── COMMERCIAL FOLLOW-UP (from ERG Lead Follow-Up script) ───
  {
    id: 'commercial-followup',
    name: 'Commercial Platform Inquiry Follow-Up',
    category: 'follow_up',
    description: 'Follow up with leads from LoopNet, Crexi, CoStar, or MLS. From ERG scripts.',
    smsBody: `Hi {{firstName}}, this is {{agentName}} with {{brokerage}}. I saw you viewed a property on one of our commercial platforms. Did you have a chance to look at the details? Any questions I can help answer? Would you be interested in scheduling a tour? - {{agentName}}`,
    emailSubject: 'Following up on the commercial property you viewed',
    emailBody: `Hi {{firstName}},

This is {{agentName}} with {{brokerage}}. I noticed you viewed a commercial property listing recently.

Did you have a chance to look at the brochure? I'd be happy to answer any questions about the property.

A few things I can help with:
- Schedule a tour at a time that works for you
- Send you the full offering memorandum
- Share comparable recent sales in the area
- Discuss financing options

If this particular property doesn't work, I'd love to learn more about what you're looking for — we track inventory across the market and may have something that's a better fit.

What two dates and times work best for a tour or call?

Best,
{{agentName}}
{{brokerage}}`,
    tags: ['commercial', 'follow-up', 'LoopNet', 'Crexi'],
    bestFor: 'Leads who viewed commercial listings on LoopNet, Crexi, CoStar',
  },
]

/**
 * Get templates filtered by category
 */
export function getTemplatesByCategory(category: CampaignTemplate['category']): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter(t => t.category === category)
}

/**
 * Fill template placeholders with actual values
 */
export function fillTemplate(
  template: string,
  values: {
    firstName?: string
    address?: string
    area?: string
    agentName?: string
    brokerage?: string
  }
): string {
  return template
    .replace(/\{\{firstName\}\}/g, values.firstName || 'there')
    .replace(/\{\{address\}\}/g, values.address || 'your property')
    .replace(/\{\{area\}\}/g, values.area || 'your area')
    .replace(/\{\{agentName\}\}/g, values.agentName || 'Your Agent')
    .replace(/\{\{brokerage\}\}/g, values.brokerage || 'Our Team')
}
