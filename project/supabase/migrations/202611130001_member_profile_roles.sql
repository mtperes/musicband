begin;

alter table public.member_profiles add column roles text[] not null default array[]::text[]
  check (array_position(roles, null) is null and roles <@ array['owner', 'admin', 'musician', 'finance_manager', 'production', 'receive_mail']::text[]);

create or replace function public.list_workspace_members(target_band uuid, actor uuid, page_start integer default 0)
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
      coalesce(accounts.roles, profiles.roles, array[]::text[]), coalesce(accounts.confirmed, false),
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

notify pgrst, 'reload schema';
commit;