# Monthly UX Review Process

Run on the 1st of each month. Takes ~30 minutes.

## Checklist

### 1. Core Flows (test each in browser)
- [ ] Sign up → onboarding wizard → dashboard (new user path)
- [ ] Import CSV → field mapping → leads appear
- [ ] Create campaign → select template → send to 1 test lead
- [ ] Conversations → send message → see in thread
- [ ] Settings → update profile → verify AI uses new name
- [ ] Billing → view plan → (don't actually checkout)

### 2. Mobile Responsiveness (test at 375px width)
- [ ] Landing page readable and CTAs visible
- [ ] Dashboard cards stack properly
- [ ] Leads table scrolls horizontally
- [ ] Campaign steps work on mobile
- [ ] Settings tabs accessible

### 3. Dark Mode
- [ ] All pages render correctly in dark mode
- [ ] No white flash on page load
- [ ] Text contrast passes 4.5:1 (use browser DevTools audit)
- [ ] Charts and graphs readable

### 4. Performance
- [ ] Landing page loads in <3s (check Lighthouse)
- [ ] Dashboard loads in <5s
- [ ] No console errors on any page
- [ ] No broken images or icons

### 5. Error States
- [ ] What happens with 0 leads? (empty states shown?)
- [ ] What happens with no subscription? (upgrade prompt?)
- [ ] What happens when API fails? (error messages helpful?)

### 6. AI Conversation Quality
- [ ] Send a test WhatsApp message
- [ ] Check AI response quality (natural? correct context?)
- [ ] Run `python tools/test_ai_conversations.py` for automated test

## After Review
1. Log findings in Command Center → Engineering tab
2. Create tasks for any issues found
3. Compare with previous month's review
