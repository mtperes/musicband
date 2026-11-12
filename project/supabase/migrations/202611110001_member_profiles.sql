begin;

create table public.member_profiles (
  id uuid primary key default gen_random_uuid(),
  band_id uuid not null references public.bands(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  submitted_at timestamp without time zone default (now() at time zone 'UTC'),
  name text not null check (length(trim(name)) between 1 and 160),
  birth_date date,
  shirt_size text not null default '',
  instrument text not null default '',
  address text not null default '',
  phone text not null default '',
  emergency_contact text not null default '',
  instagram text not null default '',
  food_allergies text not null default '',
  unique (band_id, email)
);

alter table public.member_profiles enable row level security;
revoke all on public.member_profiles from public, anon, authenticated;
grant select on public.member_profiles to authenticated;
grant select, insert, update on public.member_profiles to service_role;
create policy admins_read_member_profiles on public.member_profiles for select to authenticated
using (exists (
  select 1 from public.band_members
  where band_id = member_profiles.band_id and user_id = (select auth.uid())
    and roles && array['owner', 'admin']::text[]
));

drop function public.list_workspace_members(uuid, uuid, integer);
create function public.list_workspace_members(target_band uuid, actor uuid, page_start integer default 0)
returns table (
  user_id uuid, email text, roles text[], confirmed boolean, profile_id uuid,
  submitted_at timestamp without time zone, name text, birth_date date,
  shirt_size text, instrument text, address text, phone text,
  emergency_contact text, instagram text, food_allergies text
)
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.assert_workspace_admin(target_band, actor);
  if page_start < 0 then raise exception 'Invalid offset'; end if;
  return query
    select accounts.user_id, coalesce(profiles.email, accounts.email)::text,
      coalesce(accounts.roles, array[]::text[]), coalesce(accounts.confirmed, false),
      profiles.id, profiles.submitted_at, profiles.name, profiles.birth_date,
      profiles.shirt_size, profiles.instrument, profiles.address, profiles.phone,
      profiles.emergency_contact, profiles.instagram, profiles.food_allergies
    from (
      select members.user_id, members.band_id, users.email::text,
        members.roles, users.email_confirmed_at is not null as confirmed
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

commit;