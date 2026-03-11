---
name: market-research
description: Market research workflows - competitor analysis, trend tracking, and feature gap identification for Estate AI
user_invocable: true
commands:
  competitors: Analyze competitor pricing, features, and positioning
  trends: Research AI-in-real-estate trends and new product launches
  gaps: Identify feature gaps between Estate AI and competitors
---

# Market Research Skills

## /market-research:competitors

Analyze top competitors in the AI real estate CRM space.

### Competitors to Track:
| Competitor | Focus | Price Range |
|------------|-------|-------------|
| Follow Up Boss | CRM + lead routing | $69-499/mo |
| kvCORE | All-in-one platform | $499+/mo |
| Lofty (Chime) | AI + IDX websites | $449+/mo |
| Sierra Interactive | IDX + CRM | $499+/mo |
| CINC | Lead gen + CRM | $900+/mo |
| Structurely | AI chat assistant | $179-499/mo |
| Ylopo | AI + ads + CRM | $295+/mo |

### Steps:
1. Use WebSearch to check each competitor's current pricing page
2. Compare feature sets against Estate AI's capabilities (32 routes, 3 channels, AI qualification)
3. Identify pricing advantages (Estate AI at $99-499 vs competitors at $179-900+)
4. Save findings to `research_findings` table with source='competitor_pricing'
5. Generate comparison matrix in `reports/market-research/competitors-YYYY-MM-DD.md`

## /market-research:trends

Track AI-in-real-estate industry trends.

### Steps:
1. WebSearch for "AI real estate CRM 2026", "AI lead nurturing real estate", "AI property matching"
2. Check Product Hunt for new AI+RE launches
3. Search Reddit r/realtors for pain points and tool discussions
4. Save findings with source='trend' to `research_findings` table
5. Generate trend report in `reports/market-research/trends-YYYY-MM-DD.md`

## /market-research:gaps

Identify feature gaps between Estate AI and competitors.

### Steps:
1. List Estate AI's current features from API routes and UI pages
2. Compare against competitor feature lists from latest research
3. Prioritize gaps by user impact and implementation effort
4. Save findings with finding_type='feature_gap' to `research_findings` table
5. Recommend top 3 gaps to close in next sprint

### Working Directory
Always operate from: `~/Desktop/realestate-ai/`
