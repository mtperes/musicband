begin;

alter table public.band_site_settings add column contact_usernames text[] not null default '{}';
alter table public.band_site_settings add column published_contact_usernames text[] not null default '{}';

update public.band_site_settings set
  draft = jsonb_set(jsonb_set(draft, '{calendarUrl}', coalesce(draft->'calendarUrl', '"https://calendar.google.com/calendar/ical/1aa1550534d11c7cdfa85fbcbf1b0852806cdac52efb8e540d22ffdfbb3d6ea5%40group.calendar.google.com/public/basic.ics"'::jsonb)), '{identity,headingImagesVisible}', coalesce(draft->'identity'->'headingImagesVisible', 'true'::jsonb)),
  published = case when published is not null then jsonb_set(jsonb_set(published, '{calendarUrl}', coalesce(published->'calendarUrl', '"https://calendar.google.com/calendar/ical/1aa1550534d11c7cdfa85fbcbf1b0852806cdac52efb8e540d22ffdfbb3d6ea5%40group.calendar.google.com/public/basic.ics"'::jsonb)), '{identity,headingImagesVisible}', coalesce(published->'identity'->'headingImagesVisible', 'true'::jsonb)) end,
  revision = revision + 1;

alter function public.validate_band_site_content(uuid, jsonb, boolean) rename to validate_band_site_content_base;
create function public.validate_band_site_content(target_band uuid, content jsonb, publishing boolean)
returns void language plpgsql set search_path = ''
as $$
begin
  perform public.validate_band_site_content_base(target_band, content, publishing);
  if content ? 'calendarUrl' and (jsonb_typeof(content->'calendarUrl') is distinct from 'string'
    or (content->>'calendarUrl') !~ '^https://calendar\.google\.com/calendar/ical/[^/?#]+/public/basic\.ics$') then
    raise exception 'Use the public Google Calendar iCal address' using errcode = '22023';
  end if;
  if (content->'identity') ? 'headingImagesVisible' and jsonb_typeof(content->'identity'->'headingImagesVisible') is distinct from 'boolean' then
    raise exception 'Invalid title image visibility' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.validate_band_site_content(uuid, jsonb, boolean) from public, anon, authenticated;

alter function public.save_band_site(uuid, jsonb, integer, boolean) rename to save_band_site_content;
revoke all on function public.save_band_site_content(uuid, jsonb, integer, boolean) from public, anon, authenticated;

create function public.save_band_site(target_band uuid, content jsonb, expected_revision integer, publish boolean default false, recipient_usernames text[] default null)
returns public.band_site_settings language plpgsql security definer set search_path = ''
as $$
declare
  saved public.band_site_settings;
  normalized text[];
  requested text;
begin
  if not public.can_manage_band_site(target_band) then raise exception 'Band administrator access required' using errcode = '42501'; end if;
  if recipient_usernames is not null and (cardinality(recipient_usernames) > 30 or array_position(recipient_usernames, null) is not null) then
    raise exception 'Provide up to 30 valid recipient usernames' using errcode = '22023';
  end if;
  if recipient_usernames is null then
    select contact_usernames into normalized from public.band_site_settings where band_id = target_band;
    normalized := coalesce(normalized, '{}'::text[]);
  else
    normalized := array(select distinct lower(trim(value)) from unnest(recipient_usernames) as requested_name(value));
  end if;
  foreach requested in array normalized loop
    if requested !~ '^[a-z0-9][a-z0-9._-]{2,63}$' or not exists (
      select 1 from public.band_members members join auth.users users on users.id = members.user_id
      left join public.member_profiles profiles on profiles.band_id = members.band_id and profiles.user_id = members.user_id
      where members.band_id = target_band and members.active and users.email_confirmed_at is not null
        and users.email is not null and users.email not like '%.invalid'
        and requested = coalesce(nullif(profiles.username, ''), case when users.email = 'mt.peresn@gmail.com' then 'admin' end)
    ) then raise exception 'Recipient % must be an active band member with a confirmed email', requested using errcode = '22023'; end if;
  end loop;
  saved := public.save_band_site_content(target_band, content, expected_revision, publish);
  update public.band_site_settings set contact_usernames = normalized,
    published_contact_usernames = case when publish then normalized else published_contact_usernames end
    where band_id = target_band returning * into saved;
  return saved;
end;
$$;
revoke all on function public.save_band_site(uuid, jsonb, integer, boolean, text[]) from public, anon;
grant execute on function public.save_band_site(uuid, jsonb, integer, boolean, text[]) to authenticated;

create or replace function public.contact_email_recipients()
returns table (email text) language sql stable security definer set search_path = ''
as $$
  select distinct lower(users.email)::text
  from public.band_members members join public.bands bands on bands.id = members.band_id
  join auth.users users on users.id = members.user_id
  left join public.band_site_settings settings on settings.band_id = members.band_id
  left join public.member_profiles profiles on profiles.band_id = members.band_id and profiles.user_id = members.user_id
  where bands.slug = 'sardinhas-nomades' and members.active and users.email_confirmed_at is not null
    and users.email is not null and users.email not like '%.invalid'
    and case when coalesce(cardinality(settings.published_contact_usernames), 0) > 0 then
      coalesce(nullif(profiles.username, ''), case when users.email = 'mt.peresn@gmail.com' then 'admin' end) = any(settings.published_contact_usernames)
    else members.roles && array['owner', 'admin', 'production', 'receive_mail']::text[] end;
$$;
revoke all on function public.contact_email_recipients() from public, anon, authenticated;
grant execute on function public.contact_email_recipients() to service_role;

notify pgrst, 'reload schema';
commit;