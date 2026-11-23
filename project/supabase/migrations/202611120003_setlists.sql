begin;

alter table public.songs add constraint songs_id_band_unique unique (id, band_id);

create table public.setlists (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  created_at timestamptz not null default now(),
  unique (band_id, title),
  unique (id, band_id)
);

create table public.setlist_songs (
  setlist_id uuid not null,
  band_id uuid not null,
  song_id uuid not null,
  position integer not null check (position between 1 and 200),
  primary key (setlist_id, position),
  foreign key (setlist_id, band_id) references public.setlists(id, band_id) on delete cascade,
  foreign key (song_id, band_id) references public.songs(id, band_id) on delete cascade
);
create index setlist_songs_song on public.setlist_songs (song_id, band_id);

alter table public.setlists enable row level security;
alter table public.setlist_songs enable row level security;
revoke all on public.setlists, public.setlist_songs from anon, authenticated;
grant select, delete on public.setlists to authenticated;
grant select on public.setlist_songs to authenticated;

create policy setlists_read on public.setlists for select to authenticated
using (public.can_access_music(band_id));
create policy setlists_delete on public.setlists for delete to authenticated
using (public.can_access_music(band_id));
create policy setlist_songs_read on public.setlist_songs for select to authenticated
using (public.can_access_music(band_id));

create function public.save_setlist(target_band uuid, target_setlist uuid, setlist_title text, song_ids uuid[])
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  saved_id uuid;
begin
  if not public.can_access_music(target_band) then
    raise exception 'Music access required' using errcode = '42501';
  end if;
  if setlist_title is null or length(trim(setlist_title)) not between 1 and 160
    or song_ids is null or cardinality(song_ids) not between 1 and 200 then
    raise exception 'A title and 1 to 200 songs are required' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(song_ids) as requested(song_id)
    where not exists (select 1 from public.songs where id = requested.song_id and band_id = target_band)
  ) then
    raise exception 'All songs must belong to this band' using errcode = '22023';
  end if;

  if target_setlist is null then
    insert into public.setlists (band_id, title) values (target_band, trim(setlist_title)) returning id into saved_id;
  else
    update public.setlists set title = trim(setlist_title)
    where id = target_setlist and band_id = target_band returning id into saved_id;
    if saved_id is null then
      raise exception 'Setlist not found' using errcode = '22023';
    end if;
    delete from public.setlist_songs where setlist_id = saved_id;
  end if;

  insert into public.setlist_songs (setlist_id, band_id, song_id, position)
  select saved_id, target_band, requested.song_id, requested.position::integer
  from unnest(song_ids) with ordinality as requested(song_id, position);
  return saved_id;
end;
$$;
revoke all on function public.save_setlist(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.save_setlist(uuid, uuid, text, uuid[]) to authenticated;

commit;