begin;

alter table public.music_sheets add column song_id uuid;
alter table public.music_sheets add constraint music_sheets_song_band
  foreign key (song_id, band_id) references public.songs(id, band_id);
alter table public.music_sheets add constraint music_sheets_song_instrument
  check (song_id is null or length(trim(instrument)) > 0);
create unique index music_sheets_song_part on public.music_sheets (song_id, lower(trim(instrument)))
  where song_id is not null;

grant update (song_id, instrument) on public.music_sheets to authenticated;
create policy music_attach on public.music_sheets for update to authenticated
using (public.can_access_music(band_id))
with check (public.can_access_music(band_id));

commit;