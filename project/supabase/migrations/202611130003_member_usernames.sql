begin;

alter table public.member_profiles add column username text not null default ''
  check (username = '' or username ~ '^[a-z0-9][a-z0-9._-]{2,63}$');
alter table public.member_profiles add column user_id uuid references auth.users(id) on delete set null;
create unique index member_profiles_username on public.member_profiles (username) where username <> '';
create unique index member_profiles_account on public.member_profiles (band_id, user_id) where user_id is not null;
update public.member_profiles as profiles set user_id = users.id from auth.users as users where profiles.email = lower(users.email);

create function public.resolve_workspace_login(login_username text)
returns text language sql stable security definer set search_path = ''
as $$
  select users.email::text from auth.users as users
  where users.email = case when login_username = 'admin' then 'mt.peresn@gmail.com'
    else login_username || '@members.sardinhas-nomades.invalid' end
    or exists (select 1 from public.member_profiles as profiles where profiles.user_id = users.id and profiles.username = login_username)
  order by (users.email = case when login_username = 'admin' then 'mt.peresn@gmail.com'
    else login_username || '@members.sardinhas-nomades.invalid' end) desc
  limit 1;
$$;
revoke all on function public.resolve_workspace_login(text) from public, anon, authenticated;
grant execute on function public.resolve_workspace_login(text) to service_role;

create function public.workspace_username_available(target_username text, target_profile uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.member_profiles where username = target_username
    and (target_profile is null or id <> target_profile));
$$;
revoke all on function public.workspace_username_available(text, uuid) from public, anon, authenticated;
grant execute on function public.workspace_username_available(text, uuid) to service_role;

create function public.provision_workspace_member(target_band uuid, target_user uuid, actor uuid, new_roles text[])
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform public.assert_workspace_admin(target_band, actor);
  insert into public.band_members (band_id, user_id, roles) values (target_band, target_user, array['viewer']::text[]);
  perform public.set_workspace_member_roles(target_band, target_user, actor, new_roles);
end;
$$;
revoke all on function public.provision_workspace_member(uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.provision_workspace_member(uuid, uuid, uuid, text[]) to service_role;

drop function public.list_workspace_members(uuid, uuid, integer);
create function public.list_workspace_members(target_band uuid, actor uuid, page_start integer default 0)
returns table (
  user_id uuid, email text, roles text[], confirmed boolean, profile_id uuid,
  submitted_at timestamp without time zone, name text, birth_date date,
  shirt_size text, instrument text, address text, phone text,
  emergency_contact text, instagram text, food_allergies text, active boolean, username text
)
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.assert_workspace_admin(target_band, actor);
  if page_start is null or page_start < 0 or page_start > 100000 then raise exception 'Invalid offset'; end if;
  return query
    select accounts.user_id, coalesce(profiles.email, accounts.email)::text,
      coalesce(accounts.roles, profiles.roles, array[]::text[]), coalesce(accounts.confirmed, false),
      profiles.id, profiles.submitted_at, profiles.name, profiles.birth_date,
      profiles.shirt_size, profiles.instrument, profiles.address, profiles.phone,
      profiles.emergency_contact, profiles.instagram, profiles.food_allergies,
      coalesce(accounts.active, false),
      coalesce(nullif(profiles.username, ''), case when accounts.email = 'mt.peresn@gmail.com' then 'admin'
        when accounts.email like '%@members.sardinhas-nomades.invalid' then split_part(accounts.email, '@', 1) else '' end)::text
    from (
      select members.user_id, members.band_id, users.email::text,
        members.roles, users.email_confirmed_at is not null as confirmed, members.active
      from public.band_members as members join auth.users as users on users.id = members.user_id
      where members.band_id = target_band
    ) as accounts
    full join public.member_profiles as profiles on profiles.band_id = accounts.band_id
      and (profiles.user_id = accounts.user_id or (profiles.user_id is null and profiles.email = lower(accounts.email)))
    where coalesce(profiles.band_id, accounts.band_id) = target_band
    order by coalesce(profiles.name, profiles.email, accounts.email), coalesce(profiles.email, accounts.email)
    limit 50 offset page_start;
end;
$$;
revoke all on function public.list_workspace_members(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.list_workspace_members(uuid, uuid, integer) to service_role;

notify pgrst, 'reload schema';
commit;