-- AnkiConnect live sync (one-way Anki → Dory; desktop/sync/). The .apkg importer keeps
-- no link back to Anki, so re-imports duplicate. Live sync needs a stable identity:
--   cards.anki_note_id   — Anki note id (ms epoch, unique per collection file)
--   cards.anki_note_mod  — Anki note mod time (s epoch) at last sync → incremental re-sync
--   collections.anki_deck_id — Anki deck id → deck rename in Anki updates the Dory deck
-- Additive + nullable: apkg/paste/AI cards simply leave these null.
alter table cards add column if not exists anki_note_id bigint;
alter table cards add column if not exists anki_note_mod bigint;
alter table collections add column if not exists anki_deck_id bigint;

-- One Dory card per (user, Anki note). Partial: only sync-created cards participate.
create unique index if not exists cards_user_anki_note_uidx
  on cards(user_id, anki_note_id) where anki_note_id is not null;
create index if not exists collections_user_anki_deck_idx
  on collections(user_id, anki_deck_id) where anki_deck_id is not null;
