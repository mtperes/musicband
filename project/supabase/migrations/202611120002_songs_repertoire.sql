begin;

create table public.songs (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  sort_order integer not null default 0,
  rhythm text not null default '' check (length(rhythm) <= 100),
  title text not null check (length(trim(title)) between 1 and 160),
  artist text not null default '' check (length(artist) <= 160),
  key_c text not null default '' check (length(key_c) <= 40),
  key_eb text not null default '' check (length(key_eb) <= 40),
  video_url text not null default '' check (video_url = '' or video_url ~ '^https://'),
  audio_url text not null default '' check (audio_url = '' or audio_url ~ '^https://'),
  created_at timestamptz not null default now(),
  unique (band_id, title)
);

create table public.song_parts (
  song_id uuid not null references public.songs(id) on delete cascade,
  instrument text not null check (instrument in ('Sax Alto', 'Trompete', 'Trombone', 'Sax Tenor')),
  url text not null check (url ~ '^https://'),
  primary key (song_id, instrument)
);

alter table public.songs enable row level security;
alter table public.song_parts enable row level security;
revoke all on public.songs, public.song_parts from anon, authenticated;
grant select on public.songs, public.song_parts to authenticated;

create policy songs_read on public.songs for select to authenticated
using (public.can_access_music(band_id));
create policy song_parts_read on public.song_parts for select to authenticated
using (exists (select 1 from public.songs where songs.id = song_parts.song_id and public.can_access_music(songs.band_id)));

commit;
