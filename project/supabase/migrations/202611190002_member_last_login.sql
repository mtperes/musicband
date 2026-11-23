begin;

drop function public.get_workspace_members(uuid, integer);
drop function public.list_workspace_members(uuid, uuid, integer);

create function public.list_workspace_members(target_band uuid, actor uuid, page_start integer default 0)
returns table (
  user_id uuid, email text, roles text[], confirmed boolean, last_sign_in_at timestamp with time zone,
  profile_id uuid, submitted_at timestamp without time zone, name text, birth_date date,
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
      accounts.last_sign_in_at, profiles.id, profiles.submitted_at, profiles.name, profiles.birth_date,
      profiles.shirt_size, profiles.instrument, profiles.address, profiles.phone,
      profiles.emergency_contact, profiles.instagram, profiles.food_allergies,
      coalesce(accounts.active, false),
      coalesce(nullif(profiles.username, ''), case when accounts.email = 'mt.peresn@gmail.com' then 'admin'
        when accounts.email like '%@members.sardinhas-nomades.invalid' then split_part(accounts.email, '@', 1) else '' end)::text
    from (
      select members.user_id, members.band_id, users.email::text,
        members.roles, users.email_confirmed_at is not null as confirmed,
        users.last_sign_in_at, members.active
      from public.band_members as members join auth.users as users on users.id = members.user_id
      where members.band_id = target_band
    ) as accounts
    full join (
      select details.*, coalesce(details.user_id, matched_user.id) as linked_user_id
      from public.member_profiles as details
      left join auth.users as matched_user on lower(matched_user.email) = details.email
    ) as profiles on profiles.band_id = accounts.band_id and profiles.linked_user_id = accounts.user_id
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

notify pgrst, 'reload schema';
commit;
