-- Run after seed-songs.sql. Existing setlists and later edits are preserved.
begin;

do $$
declare
  target_band uuid;
  saved_id uuid;
  titles text[] := array[
    'Emoriô',
    'Anunciação',
    'Ai que saudade D`ocê',
    'Eu só quero um xodó',
    'Asa Branca',
    'Carinito',
    'Lucro',
    'A Praieira',
    'Palco',
    'Água de Beber',
    'O Sol Nascerá',
    'Você Não entende Nada',
    'Prefixo de Verão',
    'A luz de Tieta',
    'Baile de Favela',
    'Rap da Felicidade',
    'Verdinha'
  ];
begin
  select id into target_band from public.bands where slug = 'sardinhas-nomades';
  if target_band is null then
    raise exception 'Apply the music library migrations first';
  end if;
  if exists (
    select 1 from unnest(titles) as requested(title)
    where not exists (select 1 from public.songs where band_id = target_band and title = requested.title)
  ) then
    raise exception 'Missing repertoire songs: run seed-songs.sql first';
  end if;

  insert into public.setlists (band_id, title)
  values (target_band, 'Brasilidades - Lavagem das Escadas de Sto Antonio 26')
  on conflict (band_id, title) do nothing returning id into saved_id;

  if saved_id is not null then
    insert into public.setlist_songs (setlist_id, band_id, song_id, position)
    select saved_id, target_band, songs.id, requested.position::integer
    from unnest(titles) with ordinality as requested(title, position)
    join public.songs on songs.band_id = target_band and songs.title = requested.title;
  end if;
end;
$$;

commit;