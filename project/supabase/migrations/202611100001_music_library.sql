begin;

create table public.bands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table public.band_members (
  band_id uuid not null references public.bands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  roles text[] not null default '{musician}',
  primary key (band_id, user_id),
  check (cardinality(roles) > 0 and roles <@ array['owner', 'admin', 'musician', 'finance_manager']::text[])
);

create function public.can_access_music(target_band uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.band_members
    where band_id = target_band and user_id = (select auth.uid())
      and roles && array['owner', 'admin', 'musician']::text[]
  );
$$;
revoke all on function public.can_access_music(uuid) from public, anon;
grant execute on function public.can_access_music(uuid) to authenticated;

create table public.music_sheets (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  instrument text not null default '' check (length(instrument) <= 100),
  file_name text not null check (length(file_name) between 1 and 255 and lower(file_name) like '%.pdf'),
  file_size integer not null check (file_size between 5 and 20971520),
  storage_path text not null unique,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (storage_path = band_id::text || '/' || id::text || '.pdf')
);
create index music_sheets_band_title on public.music_sheets (band_id, title);
create index band_members_user on public.band_members (user_id);

alter table public.bands enable row level security;
alter table public.band_members enable row level security;
alter table public.music_sheets enable row level security;
revoke all on public.bands, public.band_members, public.music_sheets from anon, authenticated;
grant select on public.bands, public.band_members, public.music_sheets to authenticated;
grant insert, delete on public.music_sheets to authenticated;

create policy members_read_self on public.band_members for select to authenticated
using (user_id = (select auth.uid()));
create policy members_read_bands on public.bands for select to authenticated
using (exists (select 1 from public.band_members where band_id = bands.id and user_id = (select auth.uid())));
create policy music_read on public.music_sheets for select to authenticated
using (public.can_access_music(band_id));
create policy music_insert on public.music_sheets for insert to authenticated
with check (public.can_access_music(band_id) and uploaded_by = (select auth.uid()));
create policy music_delete on public.music_sheets for delete to authenticated
using (public.can_access_music(band_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('music-sheets', 'music-sheets', false, 20971520, array['application/pdf']);

create policy music_files_read on storage.objects for select to authenticated
using (bucket_id = 'music-sheets' and exists (
  select 1 from public.band_members where band_id::text = (storage.foldername(name))[1]
    and user_id = (select auth.uid()) and roles && array['owner', 'admin', 'musician']::text[]
));
create policy music_files_insert on storage.objects for insert to authenticated
with check (bucket_id = 'music-sheets' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' and exists (
  select 1 from public.band_members where band_id::text = (storage.foldername(name))[1]
    and user_id = (select auth.uid()) and roles && array['owner', 'admin', 'musician']::text[]
));
create policy music_files_delete on storage.objects for delete to authenticated
using (bucket_id = 'music-sheets' and exists (
  select 1 from public.band_members where band_id::text = (storage.foldername(name))[1]
    and user_id = (select auth.uid()) and roles && array['owner', 'admin', 'musician']::text[]
));

insert into public.bands (name, slug) values ('Sardinhas Nômades', 'sardinhas-nomades');

commit;