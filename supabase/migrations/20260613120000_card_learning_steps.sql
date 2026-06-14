-- Anki-style learning steps (docs/SCHEDULING.md: "copies modern Anki").
-- FSRS tracks which short-term (re)learning step a card is on; we must persist it
-- so a card graduates correctly across sessions (otherwise it re-enters step 0 every
-- session and never leaves learning). Additive, default 0 — safe for existing rows
-- and ignored by the currently-deployed code until the new build ships.
alter table cards add column if not exists learning_steps int not null default 0;
