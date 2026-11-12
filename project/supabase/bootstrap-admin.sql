begin;
do $$
declare
  admin_id uuid;
  first_band uuid;
begin
  select id into strict admin_id from auth.users where lower(email) = 'mt.peresn@gmail.com';
  select id into strict first_band from public.bands where slug = 'sardinhas-nomades';
  insert into public.band_members as members (band_id, user_id, roles)
  values (first_band, admin_id, array['admin']::text[])
  on conflict (band_id, user_id) do update
  set roles = array(select distinct unnest(members.roles || array['admin']::text[]));
end;
$$;
commit;