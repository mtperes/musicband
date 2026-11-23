begin;

create table public.rhythm_presets (
  band_id uuid not null references public.bands(id) on delete cascade,
  rhythm text not null check (length(rhythm) between 1 and 100 and rhythm = btrim(rhythm)),
  bpm integer not null check (bpm between 30 and 240),
  beats integer not null check (beats in (2, 3, 4, 6, 7)),
  subdivision integer not null check (subdivision in (1, 2, 4)),
  volume double precision not null check (volume between 0 and 1),
  kit text not null check (kit in ('wood', 'electronic', 'studio')),
  drums boolean not null,
  muted text[] not null default '{}' check (
    array_position(muted, null) is null and muted <@ array['pulse', 'kick', 'snare', 'hat']::text[]
  ),
  pattern jsonb not null check (
    jsonb_typeof(pattern) = 'object'
    and pattern ?& array['pulse', 'kick', 'snare', 'hat']
    and pattern - 'pulse' - 'kick' - 'snare' - 'hat' = '{}'::jsonb
    and jsonb_typeof(pattern->'pulse') = 'array'
    and jsonb_typeof(pattern->'kick') = 'array'
    and jsonb_typeof(pattern->'snare') = 'array'
    and jsonb_typeof(pattern->'hat') = 'array'
    and jsonb_array_length(pattern->'pulse') = beats * subdivision
    and jsonb_array_length(pattern->'kick') = beats * subdivision
    and jsonb_array_length(pattern->'snare') = beats * subdivision
    and jsonb_array_length(pattern->'hat') = beats * subdivision
    and not jsonb_path_exists(pattern, '$.*[*] ? (@.type() != "boolean")')
  ),
  primary key (band_id, rhythm)
);

alter table public.rhythm_presets enable row level security;
revoke all on public.rhythm_presets from anon, authenticated;
grant select, insert, update on public.rhythm_presets to authenticated;

create policy rhythm_presets_read on public.rhythm_presets for select to authenticated
using (public.can_access_music(band_id));

create policy rhythm_presets_insert on public.rhythm_presets for insert to authenticated
with check (public.can_edit_music(band_id) and exists (
  select 1 from public.songs where songs.band_id = rhythm_presets.band_id and btrim(songs.rhythm) = rhythm_presets.rhythm
));

create policy rhythm_presets_update on public.rhythm_presets for update to authenticated
using (public.can_edit_music(band_id))
with check (public.can_edit_music(band_id) and exists (
  select 1 from public.songs where songs.band_id = rhythm_presets.band_id and btrim(songs.rhythm) = rhythm_presets.rhythm
));

notify pgrst, 'reload schema';
commit;