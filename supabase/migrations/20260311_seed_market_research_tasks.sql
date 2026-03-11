-- ============================================
-- Seed market research department tasks
-- Uses same user_id as existing task seeds
-- ============================================

-- First, add 'market_research' to the department CHECK constraint
-- The original constraint only allows: legal, engineering, marketing, finance
ALTER TABLE project_tasks
  DROP CONSTRAINT IF EXISTS project_tasks_department_check;

ALTER TABLE project_tasks
  ADD CONSTRAINT project_tasks_department_check
  CHECK (department IN ('legal', 'engineering', 'marketing', 'finance', 'market_research'));

-- Seed 6 market research tasks
INSERT INTO project_tasks (id, user_id, department, priority, status, title, description, is_blocker, is_automatable, week_label) VALUES
(
  gen_random_uuid(),
  '45435140-9a0a-49aa-a95e-5ace7657f61a',
  'market_research',
  'P1',
  'pending',
  'Competitor pricing audit — top 7 CRMs',
  'Compare current pricing for Follow Up Boss, kvCORE, Lofty, Sierra, CINC, Structurely, Ylopo. Document tier features and pricing changes since last check.',
  false,
  true,
  'W1'
),
(
  gen_random_uuid(),
  '45435140-9a0a-49aa-a95e-5ace7657f61a',
  'market_research',
  'P1',
  'pending',
  'Feature gap analysis vs top 5 competitors',
  'Map our 32 API routes + 3 channels against competitor feature lists. Identify top 5 missing features by user impact.',
  false,
  true,
  'W1'
),
(
  gen_random_uuid(),
  '45435140-9a0a-49aa-a95e-5ace7657f61a',
  'market_research',
  'P2',
  'pending',
  'AI-in-real-estate trend report Q1 2026',
  'Research current AI adoption trends in real estate. Check Product Hunt, G2, industry blogs for new entrants and feature trends.',
  false,
  true,
  'W1'
),
(
  gen_random_uuid(),
  '45435140-9a0a-49aa-a95e-5ace7657f61a',
  'market_research',
  'P2',
  'pending',
  'User customization preference research',
  'Survey competitors for AI script customization features. Document what tone/language/personality options top CRMs offer their users.',
  false,
  true,
  'W2'
),
(
  gen_random_uuid(),
  '45435140-9a0a-49aa-a95e-5ace7657f61a',
  'market_research',
  'P2',
  'pending',
  'Reddit + G2 sentiment analysis for RE CRMs',
  'Analyze r/realtors, G2 reviews, and Capterra reviews for top pain points with existing CRM tools. Feed insights to product roadmap.',
  false,
  true,
  'W2'
),
(
  gen_random_uuid(),
  '45435140-9a0a-49aa-a95e-5ace7657f61a',
  'market_research',
  'P3',
  'pending',
  'Geographic calendar scheduling research',
  'Research how competitors handle appointment scheduling with travel time awareness. Document best practices for Phase 4 smart calendar.',
  false,
  true,
  'W3'
);
