begin;

alter table public.band_members drop constraint band_members_roles_check;
alter table public.band_members add constraint band_members_roles_check
  check (cardinality(roles) > 0 and array_position(roles, null) is null and roles <@ array['owner', 'admin', 'musician', 'viewer', 'finance_manager', 'production', 'receive_mail']::text[]);
alter table public.member_profiles drop constraint member_profiles_roles_check;
alter table public.member_profiles add constraint member_profiles_roles_check
  check (array_position(roles, null) is null and roles <@ array['owner', 'admin', 'musician', 'viewer', 'finance_manager', 'production', 'receive_mail']::text[]);

create function public.can_edit_music(target_band uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.band_members where band_id = target_band
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin', 'musician']::text[]);
$$;
revoke all on function public.can_edit_music(uuid) from public, anon;
grant execute on function public.can_edit_music(uuid) to authenticated;

create or replace function public.can_access_music(target_band uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.band_members where band_id = target_band
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin', 'musician', 'viewer']::text[]);
$$;

alter policy music_insert on public.music_sheets with check (public.can_edit_music(band_id) and uploaded_by = (select auth.uid()));
alter policy music_delete on public.music_sheets using (public.can_edit_music(band_id));
alter policy music_attach on public.music_sheets using (public.can_edit_music(band_id)) with check (public.can_edit_music(band_id));
alter policy setlists_delete on public.setlists using (public.can_edit_music(band_id));
alter policy music_files_read on storage.objects using (bucket_id = 'music-sheets' and exists (
  select 1 from public.band_members where band_id::text = (storage.foldername(name))[1]
    and user_id = (select auth.uid()) and active and roles && array['owner', 'admin', 'musician', 'viewer']::text[]));

create or replace function public.set_workspace_member_roles(target_band uuid, target_user uuid, actor uuid, new_roles text[])
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor_roles text[];
  old_roles text[];
begin
  perform 1 from public.bands where id = target_band for update;
  perform public.assert_workspace_admin(target_band, actor);
  if new_roles is null or cardinality(new_roles) = 0 or array_position(new_roles, null) is not null
    or not new_roles <@ array['owner', 'admin', 'musician', 'viewer', 'finance_manager', 'production', 'receive_mail']::text[] then
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
    select 1 from public.band_members where band_id = target_band and user_id <> target_user and active and 'owner' = any(roles)
  ) then raise exception 'The band must keep at least one owner' using errcode = '42501'; end if;
  update public.band_members set roles = new_roles where band_id = target_band and user_id = target_user;
end;
$$;
revoke all on function public.set_workspace_member_roles(uuid, uuid, uuid, text[]) from public, anon, authenticated;
grant execute on function public.set_workspace_member_roles(uuid, uuid, uuid, text[]) to service_role;

create or replace function public.save_setlist(target_band uuid, target_setlist uuid, setlist_title text, song_ids uuid[])
returns uuid language plpgsql security definer set search_path = ''
as $$
declare saved_id uuid;
begin
  if not public.can_edit_music(target_band) then raise exception 'Music editing access required' using errcode = '42501'; end if;
  if setlist_title is null or length(trim(setlist_title)) not between 1 and 160
    or song_ids is null or cardinality(song_ids) not between 1 and 200 then
    raise exception 'A title and 1 to 200 songs are required' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(song_ids) as requested(song_id)
    where not exists (select 1 from public.songs where id = requested.song_id and band_id = target_band)) then
    raise exception 'All songs must belong to this band' using errcode = '22023';
  end if;
  if target_setlist is null then
    insert into public.setlists (band_id, title) values (target_band, trim(setlist_title)) returning id into saved_id;
  else
    update public.setlists set title = trim(setlist_title) where id = target_setlist and band_id = target_band returning id into saved_id;
    if saved_id is null then raise exception 'Setlist not found' using errcode = '22023'; end if;
    delete from public.setlist_songs where setlist_id = saved_id;
  end if;
  insert into public.setlist_songs (setlist_id, band_id, song_id, position)
    select saved_id, target_band, requested.song_id, requested.position::integer from unnest(song_ids) with ordinality as requested(song_id, position);
  return saved_id;
end;
$$;
revoke all on function public.save_setlist(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.save_setlist(uuid, uuid, text, uuid[]) to authenticated;

notify pgrst, 'reload schema';
commit;