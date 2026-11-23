begin;

create function public.set_workspace_member_roles(target_band uuid, target_user uuid, actor uuid, new_roles text[])
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor_roles text[];
  old_roles text[];
begin
  perform 1 from public.bands where id = target_band for update;
  perform public.assert_workspace_admin(target_band, actor);
  if new_roles is null or cardinality(new_roles) = 0
    or not new_roles <@ array['owner', 'admin', 'musician', 'finance_manager', 'production', 'receive_mail']::text[] then
    raise exception 'Invalid roles' using errcode = '22023';
  end if;
  new_roles := array(select distinct unnest(new_roles));
  select roles into actor_roles from public.band_members where band_id = target_band and user_id = actor;
  select roles into old_roles from public.band_members where band_id = target_band and user_id = target_user;
  if old_roles is null then raise exception 'Member not found in this band' using errcode = 'P0002'; end if;
  if (('owner' = any(new_roles)) <> ('owner' = any(old_roles))) and not ('owner' = any(actor_roles)) then
    raise exception 'Only an owner can change owner access' using errcode = '42501';
  end if;
  if target_user = actor and not (new_roles && array['owner', 'admin']::text[]) then
    raise exception 'You cannot remove your own administrator access' using errcode = '42501';
  end if;
  if 'owner' = any(old_roles) and not ('owner' = any(new_roles)) and not exists (
    select 1 from public.band_members
    where band_id = target_band and user_id <> target_user and active and 'owner' = any(roles)
  ) then
    raise exception 'The band must keep at least one owner' using errcode = '42501';
  end if;
  update public.band_members set roles = new_roles where band_id = target_band and user_id = target_user;
end;
$$;
revoke all on function public.set_workspace_member_roles(uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.set_workspace_member_roles(uuid, uuid, uuid, text[]) to service_role;

create function public.update_workspace_member_roles(target_band uuid, target_user uuid, new_roles text[])
returns void language sql security definer set search_path = ''
as $$
  select public.set_workspace_member_roles(target_band, target_user, (select auth.uid()), new_roles);
$$;
revoke all on function public.update_workspace_member_roles(uuid, uuid, text[]) from public, anon;
grant execute on function public.update_workspace_member_roles(uuid, uuid, text[]) to authenticated;

notify pgrst, 'reload schema';

commit;
