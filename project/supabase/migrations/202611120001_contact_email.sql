begin;

alter table public.band_members drop constraint if exists band_members_roles_check;
alter table public.band_members add constraint band_members_roles_check
check (cardinality(roles) > 0 and roles <@ array['owner', 'admin', 'musician', 'finance_manager', 'production', 'receive_mail']::text[]);

create function public.contact_email_recipients()
returns table (email text) language sql stable security definer set search_path = ''
as $$
  select distinct lower(users.email)::text
  from public.band_members as members
  join public.bands as bands on bands.id = members.band_id
  join auth.users as users on users.id = members.user_id
  where bands.slug = 'sardinhas-nomades' and members.active
    and members.roles && array['owner', 'admin', 'production', 'receive_mail']::text[]
    and users.email_confirmed_at is not null
    and users.email is not null and users.email not like '%.invalid';
$$;
revoke all on function public.contact_email_recipients() from public, anon, authenticated;
grant execute on function public.contact_email_recipients() to service_role;

create table public.contact_email_limits (
  key text primary key,
  window_start timestamptz not null,
  attempts integer not null default 1
);
alter table public.contact_email_limits enable row level security;
revoke all on public.contact_email_limits from public, anon, authenticated;

create function public.claim_contact_email(client_key text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  claimed boolean := false;
  today timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if client_key is null or client_key !~ '^[0-9a-f]{64}$' then raise exception 'Invalid rate-limit key'; end if;
  insert into public.contact_email_limits as limits (key, window_start)
  values (client_key, now())
  on conflict (key) do update set window_start = now(), attempts = 1
  where limits.window_start <= now() - interval '60 seconds'
  returning true into claimed;
  if not coalesce(claimed, false) then return false; end if;
  claimed := false;
  insert into public.contact_email_limits as limits (key, window_start)
  values ('daily', today)
  on conflict (key) do update
    set window_start = today,
      attempts = case when limits.window_start < today then 1 else limits.attempts + 1 end
  where limits.window_start < today or limits.attempts < 50
  returning true into claimed;
  delete from public.contact_email_limits where key <> 'daily' and window_start < now() - interval '1 day';
  return coalesce(claimed, false);
end;
$$;
revoke all on function public.claim_contact_email(text) from public, anon, authenticated;
grant execute on function public.claim_contact_email(text) to service_role;

notify pgrst, 'reload schema';
commit;