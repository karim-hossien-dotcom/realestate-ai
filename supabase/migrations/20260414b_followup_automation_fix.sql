-- Corrective migration: previous migration had default 'auto_approved' on automation_mode
-- but the CHECK constraint only allows full_auto/approval_required/manual.
-- 'auto_approved' belongs on approval_status, not automation_mode.

-- Step 1: Drop the broken constraint if it was partially applied
ALTER TABLE follow_ups DROP CONSTRAINT IF EXISTS follow_ups_automation_mode_check;

-- Step 2: Backfill any rows that have invalid automation_mode (NULL or 'auto_approved')
UPDATE follow_ups
SET automation_mode = 'full_auto'
WHERE automation_mode IS NULL
   OR automation_mode NOT IN ('full_auto', 'approval_required', 'manual');

-- Step 3: Re-add the CHECK constraint now that all rows are valid
ALTER TABLE follow_ups
  ADD CONSTRAINT follow_ups_automation_mode_check
  CHECK (automation_mode IN ('full_auto', 'approval_required', 'manual'));

-- Step 4: Set the correct default for new rows
ALTER TABLE follow_ups
  ALTER COLUMN automation_mode SET DEFAULT 'full_auto';
