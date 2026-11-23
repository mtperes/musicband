begin;

alter function public.validate_band_site_content(uuid, jsonb, boolean) rename to validate_band_site_content_without_videos;

create function public.validate_band_site_content(target_band uuid, content jsonb, publishing boolean)
returns void language plpgsql set search_path = ''
as $$
declare
  gallery jsonb;
  link jsonb;
begin
  perform public.validate_band_site_content_without_videos(target_band, content, publishing);
  if not (content ? 'videos') then return; end if;
  gallery := content->'videos';
  if jsonb_typeof(gallery) is distinct from 'object'
    or jsonb_typeof(gallery->'visible') is distinct from 'boolean'
    or jsonb_typeof(gallery->'label') is distinct from 'string' or length(trim(gallery->>'label')) not between 1 and 100
    or jsonb_typeof(gallery->'title') is distinct from 'string' or length(trim(gallery->>'title')) not between 1 and 160
    or jsonb_typeof(gallery->'text') is distinct from 'string' or length(gallery->>'text') > 20000
    or jsonb_typeof(gallery->'links') is distinct from 'array' then
    raise exception 'Invalid video gallery' using errcode = '22023';
  end if;
  if jsonb_array_length(gallery->'links') > 20 then raise exception 'Maximum of 20 videos' using errcode = '22023'; end if;
  for link in select value from jsonb_array_elements(gallery->'links') loop
    if jsonb_typeof(link) is distinct from 'string' or (link #>> '{}') !~ '^https://www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}$' then
      raise exception 'A canonical YouTube video link is required' using errcode = '22023';
    end if;
  end loop;
end;
$$;
revoke all on function public.validate_band_site_content(uuid, jsonb, boolean) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;