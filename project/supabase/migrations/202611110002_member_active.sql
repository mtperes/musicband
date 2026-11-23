begin;

alter table public.band_members add column active boolean not null default true;

create or replace function public.can_access_music(target_band uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.band_members
    where band_id = target_band and user_id = (select auth.uid()) and active
      and roles && array['owner', 'admin', 'musician']::text[]
  );
$$;

create or replace function public.assert_workspace_admin(target_band uuid, actor uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.band_members where band_id = target_band and user_id = actor and active
      and roles && array['owner', 'admin']::text[]
  ) then
    raise exception 'Active administrator access required' using errcode = '42501';
  end if;
end;
$$;

alter policy members_read_bands on public.bands
using (exists (
  select 1 from public.band_members where band_id = bands.id and user_id = (select auth.uid()) and active
));
alter policy admins_read_member_profiles on public.member_profiles
using (exists (
  select 1 from public.band_members where band_id = member_profiles.band_id
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin']::text[]
));
alter policy music_files_read on storage.objects
using (bucket_id = 'music-sheets' and exists (
  select 1 from public.band_members where band_id::text = (storage.foldername(name))[1]
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin', 'musician']::text[]
));
alter policy music_files_insert on storage.objects
with check (bucket_id = 'music-sheets' and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$' and exists (
  select 1 from public.band_members where band_id::text = (storage.foldername(name))[1]
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin', 'musician']::text[]
));
alter policy music_files_delete on storage.objects
using (bucket_id = 'music-sheets' and exists (
  select 1 from public.band_members where band_id::text = (storage.foldername(name))[1]
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin', 'musician']::text[]
));

drop function public.list_workspace_members(uuid, uuid, integer);
create function public.list_workspace_members(target_band uuid, actor uuid, page_start integer default 0)
returns table (
  user_id uuid, email text, roles text[], confirmed boolean, profile_id uuid,
  submitted_at timestamp without time zone, name text, birth_date date,
  shirt_size text, instrument text, address text, phone text,
  emergency_contact text, instagram text, food_allergies text, active boolean
)
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.assert_workspace_admin(target_band, actor);
  if page_start is null or page_start < 0 or page_start > 100000 then raise exception 'Invalid offset'; end if;
  return query
    select accounts.user_id, coalesce(profiles.email, accounts.email)::text,
      coalesce(accounts.roles, array[]::text[]), coalesce(accounts.confirmed, false),
      profiles.id, profiles.submitted_at, profiles.name, profiles.birth_date,
      profiles.shirt_size, profiles.instrument, profiles.address, profiles.phone,
      profiles.emergency_contact, profiles.instagram, profiles.food_allergies,
      coalesce(accounts.active, false)
    from (
      select members.user_id, members.band_id, users.email::text,
        members.roles, users.email_confirmed_at is not null as confirmed, members.active
      from public.band_members as members join auth.users as users on users.id = members.user_id
      where members.band_id = target_band
    ) as accounts
    full join public.member_profiles as profiles
      on profiles.band_id = accounts.band_id and profiles.email = lower(accounts.email)
    where coalesce(profiles.band_id, accounts.band_id) = target_band
    order by coalesce(profiles.name, profiles.email, accounts.email), coalesce(profiles.email, accounts.email)
    limit 50 offset page_start;
end;
$$;
revoke all on function public.list_workspace_members(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.list_workspace_members(uuid, uuid, integer) to service_role;

create function public.get_workspace_members(target_band uuid, page_start integer default 0)
returns jsonb language sql security definer set search_path = ''
as $$
  select jsonb_build_object(
    'members', coalesce(jsonb_agg(to_jsonb(members) order by coalesce(members.name, members.email), members.email), '[]'::jsonb),
    'has_more', count(*) = 50
  ) from public.list_workspace_members(target_band, (select auth.uid()), page_start) as members;
$$;
revoke all on function public.get_workspace_members(uuid, integer) from public, anon;
grant execute on function public.get_workspace_members(uuid, integer) to authenticated;

create function public.set_workspace_member_active(target_band uuid, target_user uuid, actor uuid, enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform 1 from public.bands where id = target_band for update;
  perform public.assert_workspace_admin(target_band, actor);
  if enabled is null then raise exception 'Active status is required'; end if;
  if target_user = actor and not enabled then
    raise exception 'You cannot deactivate your own membership' using errcode = '42501';
  end if;
  update public.band_members set active = enabled where band_id = target_band and user_id = target_user;
  if not found then raise exception 'Member not found in this band' using errcode = 'P0002'; end if;
end;
$$;
revoke all on function public.set_workspace_member_active(uuid, uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_workspace_member_active(uuid, uuid, uuid, boolean) to service_role;

create function public.update_workspace_member_active(target_band uuid, target_user uuid, enabled boolean)
returns void language sql security definer set search_path = ''
as $$
  select public.set_workspace_member_active(target_band, target_user, (select auth.uid()), enabled);
$$;
revoke all on function public.update_workspace_member_active(uuid, uuid, boolean) from public, anon;
grant execute on function public.update_workspace_member_active(uuid, uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;