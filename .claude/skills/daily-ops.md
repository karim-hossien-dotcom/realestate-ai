---
name: daily-ops
description: Orchestrate daily operations across all 5 departments. Use when running daily audits, checking department status, or executing the full daily operations pipeline.
user_invocable: true
commands:
  run: Execute full daily operations pipeline across all 5 departments
  status: Show current status of all departments from latest daily reports
  department: Run operations for a specific department (pass department name as argument)
---

# Daily Operations Orchestrator

## /daily-ops:run — Full Pipeline

Execute all 5 departments in order. Each department runs its daily checklist and writes results to `daily_reports` table.

### Execution Order (departments feed each other):
1. **Market Research** (10 min) — Gathers intelligence
2. **Finance Ops** (5 min) — Checks costs + revenue
3. **Legal Ops** (5 min) — Checks compliance
4. **Engineering Ops** (15 min) — Health + accepts findings + implements
5. **Marketing Ops** (10 min) — Content based on engineering state

### Steps:
1. Launch departments using parallel agents where possible (Market Research + Finance + Legal can run in parallel)
2. Wait for parallel batch to complete
3. Run Engineering (depends on Market Research findings)
4. Run Marketing (depends on Engineering status)
5. Aggregate all `daily_reports` entries for today
6. Generate summary in `reports/daily/YYYY-MM-DD.md`

### Agent Invocations:
```
Agent: market-research-ops → Run daily checklist
Agent: finance-ops → Run daily checklist
Agent: legal-ops → Run daily checklist
(wait)
Agent: engineering-ops → Run daily checklist + process research findings
(wait)
Agent: marketing-ops → Run daily checklist + content based on eng status
```

### Output:
- 5 entries in `daily_reports` table (one per department)
- Summary markdown in `reports/daily/YYYY-MM-DD.md`
- Console summary with department health indicators

## /daily-ops:status — Quick Status

1. Fetch latest `daily_reports` entries (today or most recent)
2. Display department health grid:
   - Green = all checks passed
   - Yellow = warnings found
   - Red = critical issues
3. Show key metrics: MRR, error count, message delivery rate, active subs
4. List any unresolved blockers

## /daily-ops:department [name] — Single Department

Run one department's daily checklist. Valid names:
- `market-research` → Invoke market-research-ops agent
- `engineering` → Invoke engineering-ops agent
- `marketing` → Invoke marketing-ops agent
- `legal` → Invoke legal-ops agent
- `finance` → Invoke finance-ops agent

### Working Directory
Always operate from: `~/Desktop/realestate-ai/`
