---
name: finance-ops
description: Finance operations workflows - cost analysis, revenue tracking, and margin calculation for Estate AI
user_invocable: true
commands:
  costs: Analyze current vendor costs and project future expenses
  revenue: Track MRR, subscriber growth, and revenue projections
  margins: Calculate gross margins per plan tier and overall business health
---

# Finance Operations Skills

## /finance-ops:costs

Analyze vendor costs.

### Steps:
1. Check current vendor usage:
   - Supabase: storage size vs 500MB free limit
   - Render: service resource usage
   - OpenAI: message volume x $0.03/conversation
   - Twilio SMS: message count x $0.0079/msg
   - Resend: daily email count vs 100/day free limit
   - Meta WhatsApp: message count x $0.005-0.08/msg
   - Stripe: transaction count x (2.9% + $0.30)
2. Calculate total monthly cost estimate
3. Project 30/60/90 day costs based on growth rate
4. Flag vendors approaching threshold limits
5. Save report to `reports/finance/costs-YYYY-MM-DD.md`

## /finance-ops:revenue

Track revenue metrics.

### Steps:
1. Query `subscriptions` table for active subscriptions
2. Calculate MRR: sum of active plan prices
3. Track subscriber growth trend
4. Calculate ARPU (Average Revenue Per User)
5. Project revenue for 30/60/90 days
6. Compare against break-even target (15-20 Starter subs)
7. Update `project_tasks.metric_current` for finance tasks

## /finance-ops:margins

Calculate gross margins.

### Steps:
1. Get MRR from revenue calculation
2. Get total vendor costs from cost analysis
3. Calculate overall margin: (MRR - Costs) / MRR x 100
4. Calculate per-tier margins:
   - Starter $99: target 80%
   - Pro $249: target 83%
   - Agency $499: target 85%
5. Calculate unit economics:
   - Cost per lead managed
   - Cost per message sent
   - Cost per conversation (AI)
6. Flag if any margin drops below 75%
7. Generate financial health summary

### Working Directory
Always operate from: `~/Desktop/realestate-ai/`
