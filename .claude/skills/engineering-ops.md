---
name: engineering-ops
description: Engineering operations workflows - health monitoring, test suite, and code auditing for Estate AI
user_invocable: true
commands:
  health: Run comprehensive system health check across Node.js and Python services
  tests: Run test suite and report coverage
  audit: Audit codebase for quality issues (oversized files, missing auth, hardcoded values)
---

# Engineering Operations Skills

## /engineering-ops:health

Comprehensive health check across all services.

### Steps:
1. Check Node.js health: `curl https://realestate-ai.app/api/health`
2. Check Python health: `curl https://realestate-ai-1.onrender.com/health`
3. Run system checks via `runSystemChecks()` logic (from `app/lib/system-checks.ts`)
4. Query `activity_logs` for 5xx errors in last 24h
5. Check message delivery rates per channel
6. Report results with severity indicators

### Health Targets:
- Uptime: 99.5%
- P95 response time: <500ms
- Error rate: <0.5%
- Webhook delivery: 99%

## /engineering-ops:tests

Run test suite and analyze results.

### Steps:
1. Run `npm test` from project root
2. Parse test output for pass/fail counts
3. Run `npm run test:coverage` if available
4. Report coverage percentage
5. List failing tests with file paths
6. Suggest fixes for common failures

## /engineering-ops:audit

Audit codebase for quality issues.

### Steps:
1. Find files > 400 lines (candidates for splitting)
2. Check for missing `withAuth()` guards on API routes
3. Search for hardcoded values (API keys, URLs, user IDs)
4. Verify all API routes have error handling
5. Check for TODO/FIXME comments that need resolution
6. Report findings sorted by severity

### Key Thresholds:
- File size: Warning at 400 lines, Critical at 800 lines
- Auth: Every `/api/` route except health/webhook should have auth
- Hardcoded: Zero tolerance for secrets, warn on hardcoded IDs

### Working Directory
Always operate from: `~/Desktop/realestate-ai/`
