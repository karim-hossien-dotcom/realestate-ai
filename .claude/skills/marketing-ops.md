---
name: marketing-ops
description: Marketing operations workflows - content creation, campaign analysis, and landing page optimization for Estate AI
user_invocable: true
commands:
  content: Draft marketing content (LinkedIn posts, email templates, blog outlines)
  campaigns: Analyze campaign delivery rates and engagement metrics
  landing-page: Audit landing page for SEO, conversion, and performance
---

# Marketing Operations Skills

## /marketing-ops:content

Draft marketing content for various channels.

### Steps:
1. Check latest engineering updates (new features, improvements)
2. Review market research findings for content angles
3. Draft content based on content calendar:
   - **LinkedIn:** Professional, value-driven posts about AI in real estate
   - **Email:** Newsletter with product updates + industry insights
   - **Blog:** Long-form thought leadership
4. Save drafts to `reports/marketing/` with format: `{type}-YYYY-MM-DD.md`
5. Include CTA linking to realestate-ai.app

### Brand Voice:
- Professional but approachable
- Data-driven claims (cite specific features)
- Focus on agent time savings and lead conversion
- Avoid hype words ("revolutionary", "game-changing")

## /marketing-ops:campaigns

Analyze campaign performance.

### Steps:
1. Query `campaigns` table for active campaigns
2. Query `campaign_leads` for delivery + response metrics
3. Calculate: delivery rate, open rate (email), response rate, conversion rate
4. Compare against benchmarks: 95% delivery, 25% open, 5% response
5. Flag underperforming campaigns
6. Recommend optimizations

## /marketing-ops:landing-page

Audit the main landing page.

### Steps:
1. Read `app/page.tsx` for current landing page implementation
2. Check meta tags, OG tags, structured data
3. Verify mobile responsiveness indicators in CSS
4. Check page load performance considerations
5. Review CTA placement and conversion flow
6. Suggest A/B test ideas
7. Save audit to `reports/marketing/landing-page-audit-YYYY-MM-DD.md`

### Working Directory
Always operate from: `~/Desktop/realestate-ai/`
