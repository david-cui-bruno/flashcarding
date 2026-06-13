-- Add interval_days to study_reviews so we can log the FSRS-computed interval
-- after each grade. NULL for older rows (before this migration).
alter table study_reviews
  add column if not exists interval_days integer;
