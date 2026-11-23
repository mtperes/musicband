begin;

grant select on public.bands, public.band_members to service_role;
grant insert on public.band_members to service_role;

create table public.member_invite_limits (
  band_id uuid not null references public.bands(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  last_attempt timestamptz not null default now(),
  primary key (band_id, actor_id)
);
alter table public.member_invite_limits enable row level security;
revoke all on public.member_invite_limits from public, anon, authenticated;

create function public.assert_workspace_admin(target_band uuid, actor uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.band_members where band_id = target_band and user_id = actor
      and roles && array['owner', 'admin']::text[]
  ) then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
end;
$$;

create function public.find_invite_user(target_email text)
returns table (user_id uuid, confirmed boolean)
language sql security definer set search_path = ''
as $$
  select id, email_confirmed_at is not null from auth.users
  where lower(email) = lower(trim(target_email));
$$;

create function public.list_workspace_members(target_band uuid, actor uuid, page_start integer default 0)
returns table (user_id uuid, email text, roles text[], confirmed boolean)
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.assert_workspace_admin(target_band, actor);
  if page_start < 0 then raise exception 'Invalid offset'; end if;
  return query
    select members.user_id, users.email::text, members.roles, users.email_confirmed_at is not null
    from public.band_members as members join auth.users as users on users.id = members.user_id
    where members.band_id = target_band
    order by users.email, members.user_id limit 50 offset page_start;
end;
$$;

create function public.claim_member_invite(target_band uuid, actor uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare claimed boolean := false;
begin
  perform public.assert_workspace_admin(target_band, actor);
  insert into public.member_invite_limits as limits (band_id, actor_id, last_attempt)
  values (target_band, actor, now())
  on conflict (band_id, actor_id) do update set last_attempt = now()
  where limits.last_attempt <= now() - interval '60 seconds'
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

create function public.approve_music_member(target_band uuid, target_user uuid, actor uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.assert_workspace_admin(target_band, actor);
  insert into public.band_members as members (band_id, user_id, roles)
  values (target_band, target_user, array['musician']::text[])
  on conflict (band_id, user_id) do update
  set roles = array(select distinct unnest(members.roles || array['musician']::text[]));
end;
$$;

revoke all on function public.assert_workspace_admin(uuid, uuid) from public, anon, authenticated;
revoke all on function public.find_invite_user(text) from public, anon, authenticated;
revoke all on function public.list_workspace_members(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.claim_member_invite(uuid, uuid) from public, anon, authenticated;
revoke all on function public.approve_music_member(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.find_invite_user(text) to service_role;
grant execute on function public.list_workspace_members(uuid, uuid, integer) to service_role;
grant execute on function public.claim_member_invite(uuid, uuid) to service_role;
grant execute on function public.approve_music_member(uuid, uuid, uuid) to service_role;

commit;