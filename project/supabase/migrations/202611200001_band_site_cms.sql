begin;

create function public.can_manage_band_site(target_band uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.band_members where band_id = target_band
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin']::text[]);
$$;
revoke all on function public.can_manage_band_site(uuid) from public, anon;
grant execute on function public.can_manage_band_site(uuid) to authenticated;

create table public.band_site_settings (
  band_id uuid primary key references public.bands(id) on delete cascade,
  draft jsonb not null check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) < 1048576),
  published jsonb check (jsonb_typeof(published) = 'object' and octet_length(published::text) < 1048576),
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.band_site_settings enable row level security;
revoke all on public.band_site_settings from anon, authenticated;
grant select on public.band_site_settings to authenticated;
grant all on public.band_site_settings to service_role;
create policy band_site_admin_read on public.band_site_settings for select to authenticated
using (public.can_manage_band_site(band_id));

create function public.validate_band_site_content(target_band uuid, content jsonb, publishing boolean)
returns void language plpgsql set search_path = ''
as $$
declare
  section_key text;
  section_value jsonb;
  type_key text;
  event_value jsonb;
  asset jsonb;
  assets jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(content) is distinct from 'object' or octet_length(content::text) >= 1048576
    or jsonb_typeof(content->'name') is distinct from 'string' or length(trim(content->>'name')) not between 1 and 160
    or jsonb_typeof(content->'identity') is distinct from 'object'
    or jsonb_typeof(content->'typography') is distinct from 'object'
    or jsonb_typeof(content->'sections') is distinct from 'object'
    or (content->'identity'->>'backgroundMode') is null
    or (content->'identity'->>'backgroundMode') not in ('color', 'image', 'video') then
    raise exception 'Invalid website configuration' using errcode = '22023';
  end if;
  foreach type_key in array array['titles', 'subtitles', 'text'] loop
    if (content->'typography'->type_key->>'font') is null
      or (content->'typography'->type_key->>'font') not in ('Cubano', 'Rubik', 'Barrio', 'Limelight', 'Electrolize', 'Funnel Display')
      or coalesce(content->'typography'->type_key->>'color', '') !~ '^#[0-9a-fA-F]{6}$' then
      raise exception 'Invalid typeface' using errcode = '22023';
    end if;
  end loop;
  if coalesce(content->'identity'->>'backgroundColor', '') !~ '^#[0-9a-fA-F]{6}$'
    or coalesce(content->'identity'->>'logoBackground', '') !~ '^#[0-9a-fA-F]{6}$' then
    raise exception 'Invalid background color' using errcode = '22023';
  end if;
  foreach section_key in array array['home', 'bio', 'calendar', 'socials', 'events', 'contact'] loop
    section_value := content->'sections'->section_key;
    if jsonb_typeof(section_value) is distinct from 'object'
      or jsonb_typeof(section_value->'visible') is distinct from 'boolean'
      or jsonb_typeof(section_value->'label') is distinct from 'string' or length(trim(section_value->>'label')) not between 1 and 100
      or jsonb_typeof(section_value->'title') is distinct from 'string' or length(trim(section_value->>'title')) not between 1 and 160
      or jsonb_typeof(section_value->'text') is distinct from 'string' or length(section_value->>'text') > 20000
      or (section_value ? 'subtitle' and (jsonb_typeof(section_value->'subtitle') is distinct from 'string' or length(section_value->>'subtitle') > 500))
      or jsonb_typeof(section_value->'media') is distinct from 'array' then
      raise exception 'Invalid website section' using errcode = '22023';
    end if;
    if jsonb_array_length(section_value->'media') > 50 then raise exception 'Too many images' using errcode = '22023'; end if;
    assets := assets || (section_value->'media');
  end loop;
  if jsonb_typeof(content->'events') is distinct from 'array' then raise exception 'Invalid events' using errcode = '22023'; end if;
  if jsonb_array_length(content->'events') > 50 then raise exception 'Too many events' using errcode = '22023'; end if;
  for event_value in select value from jsonb_array_elements(content->'events') loop
    if jsonb_typeof(event_value->'id') is distinct from 'string'
      or jsonb_typeof(event_value->'title') is distinct from 'string' or length(trim(event_value->>'title')) not between 1 and 160
      or jsonb_typeof(event_value->'text') is distinct from 'string' or length(event_value->>'text') > 20000 then
      raise exception 'Invalid event' using errcode = '22023';
    end if;
    if event_value->'image' is distinct from 'null'::jsonb and event_value ? 'image' then assets := assets || jsonb_build_array(event_value->'image'); end if;
  end loop;
  if jsonb_typeof(content->'instagramUrl') is distinct from 'string'
    or ((content->>'instagramUrl') <> '' and (content->>'instagramUrl') !~ '^https://')
    or jsonb_typeof(content->'instagramLabel') is distinct from 'string' or length(content->>'instagramLabel') > 160
    or jsonb_typeof(content->'footerText') is distinct from 'string' or length(content->>'footerText') > 2000 then
    raise exception 'Invalid website links' using errcode = '22023';
  end if;
  assets := assets || jsonb_build_array(content->'identity'->'logo', content->'identity'->'headingStart', content->'identity'->'headingEnd');
  foreach type_key in array array['backgroundImage', 'backgroundVideo'] loop
    if content->'identity'->type_key is distinct from 'null'::jsonb and (content->'identity') ? type_key then
      assets := assets || jsonb_build_array(content->'identity'->type_key);
    end if;
  end loop;
  for asset in select value from jsonb_array_elements(assets) loop
    if jsonb_typeof(asset) is distinct from 'object' or jsonb_typeof(asset->'url') is distinct from 'string'
      or (asset->>'url') !~ '^(https://|/[^/])' or jsonb_typeof(asset->'alt') is distinct from 'string' or length(asset->>'alt') > 500 then
      raise exception 'Invalid website asset' using errcode = '22023';
    end if;
    if asset ? 'bucket' then
      if (asset->>'bucket') not in ('band-site-media', 'band-site-drafts') or (asset->>'bucket') is null
        or (publishing and (asset->>'bucket') <> 'band-site-media')
        or coalesce(asset->>'path', '') !~ ('^' || target_band::text || '/[a-zA-Z0-9._-]+$')
        or not exists (select 1 from storage.objects where bucket_id = asset->>'bucket' and name = asset->>'path') then
        raise exception 'Asset must belong to this band and exist in storage' using errcode = '22023';
      end if;
    end if;
  end loop;
end;
$$;
revoke all on function public.validate_band_site_content(uuid, jsonb, boolean) from public, anon, authenticated;

create function public.save_band_site(target_band uuid, content jsonb, expected_revision integer, publish boolean default false)
returns public.band_site_settings language plpgsql security definer set search_path = ''
as $$
declare saved public.band_site_settings;
begin
  if not public.can_manage_band_site(target_band) then raise exception 'Band administrator access required' using errcode = '42501'; end if;
  perform 1 from public.bands where id = target_band for update;
  perform public.validate_band_site_content(target_band, content, publish);
  if expected_revision = 0 then
    if exists (select 1 from public.band_site_settings where band_id = target_band) then
      raise exception 'Site changed in another session. Reload before saving.' using errcode = '40001';
    end if;
    insert into public.band_site_settings (band_id, draft, published, published_at, updated_by)
      values (target_band, content, case when publish then content end, case when publish then now() end, (select auth.uid())) returning * into saved;
  else
    update public.band_site_settings set draft = content, revision = revision + 1, updated_at = now(), updated_by = (select auth.uid()),
      published = case when publish then content else published end,
      published_at = case when publish then now() else published_at end
      where band_id = target_band and revision = expected_revision returning * into saved;
    if not found then raise exception 'Site changed in another session. Reload before saving.' using errcode = '40001'; end if;
  end if;
  return saved;
end;
$$;
revoke all on function public.save_band_site(uuid, jsonb, integer, boolean) from public, anon;
grant execute on function public.save_band_site(uuid, jsonb, integer, boolean) to authenticated;

create function public.get_published_band_site(band_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select settings.published from public.band_site_settings settings
    join public.bands band on band.id = settings.band_id where band.slug = band_slug;
$$;
revoke all on function public.get_published_band_site(text) from public;
grant execute on function public.get_published_band_site(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('band-site-media', 'band-site-media', true, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml', 'video/mp4', 'video/webm']),
  ('band-site-drafts', 'band-site-drafts', false, 104857600, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/webm']);

create policy band_site_assets_read on storage.objects for select to authenticated
using (bucket_id in ('band-site-media', 'band-site-drafts') and exists (
  select 1 from public.band_members where band_id::text = (storage.foldername(name))[1]
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin']::text[]));
create policy band_site_assets_insert on storage.objects for insert to authenticated
with check (bucket_id in ('band-site-media', 'band-site-drafts') and name ~ '^[0-9a-f-]{36}/[a-zA-Z0-9._-]+$' and exists (
  select 1 from public.band_members where band_id::text = (storage.foldername(name))[1]
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin']::text[]));

notify pgrst, 'reload schema';
commit;