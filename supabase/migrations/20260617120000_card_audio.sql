-- Audio support for imported decks (e.g. Anki .apkg with sentence/word audio).
-- Language-learning import is a new card type (Chinese sentence + pinyin + audio) that
-- BYPASSES the AI generation pipeline (no quality gate / grounding / review). Cards point
-- at an object in the private `card-audio` bucket; path is <user_id>/<card_id>.mp3, owner-only,
-- mirroring the existing `card-images` bucket. Additive + nullable — safe for existing rows,
-- ignored by the currently-deployed code until the new build ships.
alter table cards add column if not exists audio_path text;

-- Private bucket for card audio, owner-scoped exactly like card-images.
insert into storage.buckets (id, name, public) values ('card-audio', 'card-audio', false)
  on conflict (id) do nothing;

drop policy if exists "card_audio_select_own" on storage.objects;
drop policy if exists "card_audio_insert_own" on storage.objects;
drop policy if exists "card_audio_update_own" on storage.objects;
drop policy if exists "card_audio_delete_own" on storage.objects;

create policy "card_audio_select_own" on storage.objects for select
  using (bucket_id = 'card-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "card_audio_insert_own" on storage.objects for insert
  with check (bucket_id = 'card-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "card_audio_update_own" on storage.objects for update
  using (bucket_id = 'card-audio' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "card_audio_delete_own" on storage.objects for delete
  using (bucket_id = 'card-audio' and (storage.foldername(name))[1] = auth.uid()::text);
