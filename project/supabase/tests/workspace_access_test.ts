import { PGlite } from '@electric-sql/pglite';

Deno.test('band CMS isolates drafts, enforces administrator access and publishes with revision checks', async () => {
  const db = new PGlite();
  const band = '11111111-1111-4111-8111-111111111111';
  const otherBand = '22222222-2222-4222-8222-222222222222';
  const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const reader = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const content = JSON.parse(await Deno.readTextFile(new URL('../../src/utils/siteDefaults.json', import.meta.url)));
  async function denied(sql: string, args: unknown[] = []) {
    let failed = false;
    try { await db.query(sql, args); } catch { failed = true; }
    if (!failed) throw new Error('Expected denied CMS operation: ' + sql);
  }
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.bands (id uuid primary key, slug text unique);
      create table public.band_members (band_id uuid, user_id uuid, active boolean, roles text[]);
      create table public.member_profiles (band_id uuid, user_id uuid, username text);
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (bucket_id text, name text);
      create function storage.foldername(path text) returns text[] language sql as $$ select string_to_array(path, '/') $$;
      alter table storage.objects enable row level security;
      grant usage on schema auth, storage to authenticated;
      grant select on public.band_members to authenticated;
      grant select, insert on storage.objects to authenticated;
    `);
    await db.query('insert into auth.users values ($1, $2, now()), ($3, $4, now())', [admin, 'mt.peresn@gmail.com', reader, 'reader@example.com']);
    await db.query('insert into public.bands values ($1, $2), ($3, $4)', [band, 'sardinhas-nomades', otherBand, 'other-band']);
    await db.query('insert into public.band_members values ($1, $2, true, $3), ($1, $4, true, $5)', [band, admin, ['owner'], reader, ['viewer']]);
    await db.query('insert into public.member_profiles values ($1, $2, $3)', [band, reader, 'reader']);
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611200001_band_site_cms.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611200002_site_calendar_forwarding.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611200003_site_video_gallery.sql', import.meta.url)));
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
    await db.query('select public.save_band_site($1, $2, 0, false)', [band, content]);
    await denied('select public.save_band_site($1, $2, 0, false)', [band, content]);
    await denied('select public.save_band_site($1, $2, 1, true)', [otherBand, content]);
    const privatePath = `${band}/draft.png`;
    await db.query("insert into storage.objects values ('band-site-drafts', $1)", [privatePath]);
    content.identity.logo = { url: `/draft/${privatePath}`, path: privatePath, bucket: 'band-site-drafts', alt: 'Draft logo' };
    await db.query('select public.save_band_site($1, $2, 1, false)', [band, content]);
    await denied('select public.save_band_site($1, $2, 2, true)', [band, content]);
    await denied("insert into storage.objects values ('band-site-drafts', $1)", [`${otherBand}/foreign.png`]);
    await db.exec('reset role; set role anon');
    await denied('select draft from public.band_site_settings');
    const unpublished = await db.query<{ content: unknown }>('select public.get_published_band_site($1) as content', ['sardinhas-nomades']);
    if (unpublished.rows[0].content !== null) throw new Error('Draft was exposed publicly');
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [reader]);
    if ((await db.query('select * from public.band_site_settings')).rows.length) throw new Error('Viewer read drafts');
    if ((await db.query('select * from storage.objects')).rows.length) throw new Error('Viewer read draft files');
    await denied('select public.save_band_site($1, $2, 2, false)', [band, content]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
    await db.query("insert into storage.objects values ('band-site-media', $1)", [privatePath]);
    content.identity.logo.bucket = 'band-site-media';
    content.identity.logo.url = `https://example.supabase.co/storage/v1/object/public/band-site-media/${privatePath}`;
    await db.query('select public.save_band_site($1, $2, 2, true)', [band, content]);
    await denied('select public.save_band_site($1, $2, 2, false)', [band, content]);
    const foreign = structuredClone(content);
    foreign.identity.logo.path = `${otherBand}/foreign.png`;
    await denied('select public.save_band_site($1, $2, 3, true)', [band, foreign]);
    const invalid = structuredClone(content);
    delete invalid.typography.titles.font;
    await denied('select public.save_band_site($1, $2, 3, false)', [band, invalid]);
    const invalidCalendar = structuredClone(content);
    invalidCalendar.calendarUrl = 'https://calendar.google.com/calendar/ical/test/private-secret/basic.ics';
    await denied('select public.save_band_site($1, $2, 3, false)', [band, invalidCalendar]);
    const invalidVideos = structuredClone(content);
    invalidVideos.videos.links = ['https://example.com/video'];
    await denied('select public.save_band_site($1, $2, 3, false)', [band, invalidVideos]);
    await denied('select public.save_band_site($1, $2, 3, false, $3)', [band, content, ['missing-user']]);
    await db.query('select public.save_band_site($1, $2, 3, false, $3)', [band, content, ['reader']]);
    await db.exec('reset role; set role service_role');
    const draftRecipients = await db.query<{ email: string }>('select * from public.contact_email_recipients()');
    if (draftRecipients.rows.length !== 1 || draftRecipients.rows[0].email !== 'mt.peresn@gmail.com') throw new Error('Draft changed live email forwarding');
    await db.exec('reset role; set role authenticated');
    await db.query('select public.save_band_site($1, $2, 4, true, $3)', [band, content, ['reader']]);
    await db.exec('reset role; set role service_role');
    const liveRecipients = await db.query<{ email: string }>('select * from public.contact_email_recipients()');
    if (liveRecipients.rows.length !== 1 || liveRecipients.rows[0].email !== 'reader@example.com') throw new Error('Published recipient usernames were not resolved privately');
    await db.exec('reset role; set role anon');
    await denied('select public.contact_email_recipients()');
    const published = await db.query<{ content: { name: string } }>('select public.get_published_band_site($1) as content', ['sardinhas-nomades']);
    if (published.rows[0].content.name !== 'Sardinhas Nômades') throw new Error('Published content unavailable');
    if (JSON.stringify(published.rows[0].content).includes('reader@example.com') || JSON.stringify(published.rows[0].content).includes('contact_usernames')) throw new Error('Private forwarding data leaked publicly');
    await db.exec('reset role');
    const videoContent = structuredClone(content);
    videoContent.videos.links = ['https://www.youtube.com/watch?v=M7lc1UVf-VE'];
    await db.exec('set role authenticated');
    await db.query('select public.save_band_site($1, $2, 5, true)', [band, videoContent]);
    await db.exec('reset role; set role anon');
    const gallery = await db.query<{ content: { videos: { links: string[] }; sections: { bio: { title: string; text: string } } } }>('select public.get_published_band_site($1) as content', ['sardinhas-nomades']);
    if (gallery.rows[0].content.videos.links[0] !== videoContent.videos.links[0] || gallery.rows[0].content.sections.bio.title !== content.sections.bio.title || gallery.rows[0].content.sections.bio.text !== content.sections.bio.text) throw new Error('Video publishing changed the biography or lost the video links');
    await db.exec('reset role');
    await db.query('update public.band_members set active = false where user_id = $1', [admin]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
    await denied('select public.save_band_site($1, $2, 3, false)', [band, content]);
  } finally { await db.close(); }
});

Deno.test('viewer reads music without writes, usernames resolve privately and passwords stay in Auth', async () => {
  const db = new PGlite();
  const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const viewer = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const newMember = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const song = '11111111-1111-4111-8111-111111111111';
  const sheet = '22222222-2222-4222-8222-222222222222';
  const setlist = '33333333-3333-4333-8333-333333333333';
  async function denied(sql: string, args: unknown[] = []) {
    let failed = false;
    try { await db.query(sql, args); } catch { failed = true; }
    if (!failed) throw new Error('Expected denied query: ' + sql);
  }
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key, email text unique, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, storage to authenticated, service_role;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      create function storage.foldername(path text) returns text[] language sql as $$ select string_to_array(path, '/') $$;
      alter table storage.objects enable row level security;
      grant select, insert, delete on storage.objects to authenticated;
    `);
    for (const migration of ['202611100001_music_library', '202611100002_member_invites', '202611110001_member_profiles', '202611110002_member_active', '202611120001_contact_email', '202611120002_songs_repertoire', '202611120003_setlists', '202611120004_song_sheets', '202611120005_member_roles', '202611130001_member_profile_roles', '202611130002_viewer_role']) {
      await db.exec(await Deno.readTextFile(new URL(`../migrations/${migration}.sql`, import.meta.url)));
    }
    const band = (await db.query<{ id: string }>('select id from public.bands limit 1')).rows[0].id;
    await db.query('insert into auth.users values ($1, $2, now()), ($3, $4, now()), ($5, $6, now())', [admin, 'mt.peresn@gmail.com', viewer, 'reader@example.com', newMember, 'new@example.com']);
    await db.query('insert into public.band_members (band_id, user_id, roles) values ($1, $2, $3), ($1, $4, $5)', [band, admin, ['owner', 'admin'], viewer, ['viewer']]);
    await db.query('insert into public.member_profiles (band_id, email, name) values ($1, $2, $3)', [band, 'reader@example.com', 'Reader']);
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611130003_member_usernames.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611130004_member_identity_listing.sql', import.meta.url)));
    await db.query("update public.member_profiles set username = 'reader.one' where email = 'reader@example.com'");
    const identityRoster = await db.query<{ username: string; email: string }>('select * from public.list_workspace_members($1, $2, 0)', [band, admin]);
    if (!identityRoster.rows.some(member => member.username === 'reader.one' && member.email === 'reader@example.com')) throw new Error('Member identity listing lost separate email or username');
    await db.query('insert into public.songs (id, band_id, title) values ($1, $2, $3)', [song, band, 'Viewer song']);
    await db.query('insert into public.song_parts values ($1, $2, $3)', [song, 'Sax Alto', 'https://example.com/score']);
    await db.query('insert into public.music_sheets (id, band_id, title, instrument, file_name, file_size, storage_path, uploaded_by) values ($1, $2, $3, $4, $5, 100, $6, $7)', [sheet, band, 'Read-only score', 'Sax Alto', 'score.pdf', `${band}/${sheet}.pdf`, admin]);
    await db.query("insert into storage.objects (bucket_id, name) values ('music-sheets', $1)", [`${band}/${sheet}.pdf`]);
    await db.query('insert into public.setlists (id, band_id, title) values ($1, $2, $3)', [setlist, band, 'Viewer setlist']);
    await db.query('insert into public.setlist_songs values ($1, $2, $3, 1)', [setlist, band, song]);
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611190001_rhythm_presets.sql', import.meta.url)));
    await db.query("update public.songs set rhythm = 'Samba' where id = $1", [song]);
    const pattern = JSON.stringify({ pulse: [true, true, true, true], kick: [false, false, false, false], snare: [false, false, false, false], hat: [false, false, false, false] });
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
    await db.query("insert into public.rhythm_presets (band_id, rhythm, bpm, beats, subdivision, volume, kit, drums, pattern) values ($1, 'Samba', 100, 4, 1, 0.5, 'wood', false, $2)", [band, pattern]);
    await db.exec('reset role');
    if ((await db.query("select column_name from information_schema.columns where table_schema = 'public' and table_name in ('member_profiles', 'band_members') and column_name like '%password%'")).rows.length) throw new Error('Password stored in a public member table');
    await db.exec('set role service_role');
    const login = await db.query<{ email: string }>('select public.resolve_workspace_login($1) as email', ['reader.one']);
    if (login.rows[0].email !== 'reader@example.com') throw new Error('Separate username did not resolve Auth email');
    await db.query('select public.provision_workspace_member($1, $2, $3, $4)', [band, newMember, admin, ['viewer']]);
    await db.exec('reset role; set role anon');
    await denied('select * from public.rhythm_presets');
    await denied('select public.resolve_workspace_login($1)', ['reader.one']);
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [viewer]);
    for (const table of ['songs', 'song_parts', 'music_sheets', 'setlists', 'setlist_songs', 'storage.objects', 'rhythm_presets']) {
      if ((await db.query(`select * from ${table}`)).rows.length !== 1) throw new Error('Viewer cannot read ' + table);
    }
    if ((await db.query('select * from public.member_profiles')).rows.length) throw new Error('Viewer read private member data');
    if ((await db.query('update public.rhythm_presets set bpm = 120 returning *')).rows.length) throw new Error('Viewer changed shared rhythm');
    await denied("insert into public.rhythm_presets (band_id, rhythm, bpm, beats, subdivision, volume, kit, drums, pattern) values ($1, 'Samba', 120, 4, 1, 0.5, 'wood', false, $2)", [band, pattern]);
    await denied('select public.resolve_workspace_login($1)', ['reader.one']);
    await denied('select public.save_setlist($1, $2, $3, $4)', [band, setlist, 'Forbidden', [song]]);
    await denied('select public.provision_workspace_member($1, $2, $3, $4)', [band, newMember, admin, ['admin']]);
    await denied('select public.set_workspace_member_roles($1, $2, $3, $4)', [band, viewer, admin, ['admin']]);
    await denied('select public.update_workspace_member_roles($1, $2, $3)', [band, viewer, ['admin']]);
    await denied("insert into storage.objects (bucket_id, name) values ('music-sheets', $1)", [`${band}/${newMember}.pdf`]);
    await denied('insert into public.music_sheets (band_id, title, file_name, file_size, storage_path, uploaded_by) values ($1, $2, $3, 100, $4, $5)', [band, 'Forbidden', 'score.pdf', `${band}/${newMember}.pdf`, viewer]);
    if ((await db.query('update public.music_sheets set song_id = $1 where id = $2 returning id', [song, sheet])).rows.length) throw new Error('Viewer associated a score');
    for (const table of ['music_sheets', 'setlists', 'storage.objects']) {
      if ((await db.query(`delete from ${table} returning *`)).rows.length) throw new Error('Viewer deleted from ' + table);
    }
    await db.exec('reset role');
    await db.query('update public.band_members set roles = $1 where band_id = $2 and user_id = $3', [['viewer', 'musician'], band, viewer]);
    await db.exec('set role authenticated');
    if (!(await db.query<{ allowed: boolean }>('select public.can_edit_music($1) as allowed', [band])).rows[0].allowed) throw new Error('Additive musician role lost editing access');
    const updatedRhythms = await db.query<{ bpm: number }>("insert into public.rhythm_presets (band_id, rhythm, bpm, beats, subdivision, volume, kit, drums, pattern) values ($1, 'Samba', 128, 4, 1, 0.5, 'wood', false, $2) on conflict (band_id, rhythm) do update set bpm = excluded.bpm returning bpm", [band, pattern]);
    if (updatedRhythms.rows[0]?.bpm !== 128) throw new Error('Musician could not consolidate rhythm configuration');
    await denied('update public.rhythm_presets set bpm = 300');
    await denied("update public.rhythm_presets set pattern = jsonb_set(pattern, '{kick}', '[true]'::jsonb)");
    await denied("update public.rhythm_presets set pattern = jsonb_set(pattern, '{kick}', '[true, false, 1, false]'::jsonb)");
    await db.exec('reset role');
    await db.query('update public.band_members set active = false where band_id = $1 and user_id = $2', [band, viewer]);
    await db.exec('set role authenticated');
    if ((await db.query('select * from public.music_sheets')).rows.length) throw new Error('Inactive viewer retained music access');
    if ((await db.query('select * from public.rhythm_presets')).rows.length) throw new Error('Inactive member retained rhythm access');
  } finally { await db.close(); }
});

Deno.test('migrations enforce private music and service-only administration', async () => {
  const db = new PGlite();
  const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const musician = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const finance = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const otherBand = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const firstSheet = '11111111-1111-4111-8111-111111111111';
  const otherSheet = '22222222-2222-4222-8222-222222222222';
  async function denied(sql: string, args: unknown[] = []) {
    let failed = false;
    try { await db.query(sql, args); } catch { failed = true; }
    if (!failed) throw new Error('Expected denied query: ' + sql);
  }
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key, email text unique, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, storage to authenticated, service_role;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      create function storage.foldername(path text) returns text[] language sql as $$ select string_to_array(path, '/') $$;
      alter table storage.objects enable row level security;
      grant select, insert, delete on storage.objects to authenticated;
    `);
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611100001_music_library.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611100002_member_invites.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611110001_member_profiles.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611110002_member_active.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611120005_member_roles.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611130001_member_profile_roles.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611120001_contact_email.sql', import.meta.url)));
    await db.query('insert into auth.users values ($1, $2, now()), ($3, $4, now()), ($5, $6, now()), ($7, $8, now())',
      [admin, 'mt.peresn@gmail.com', musician, 'musician@example.com', outsider, 'outsider@example.com', finance, 'finance@example.com']);
    const bootstrap = await Deno.readTextFile(new URL('../bootstrap-admin.sql', import.meta.url));
    await db.exec(bootstrap);
    await db.exec(bootstrap);
    const { rows: bands } = await db.query<{ id: string }>("select id from public.bands where slug = 'sardinhas-nomades'");
    const firstBand = bands[0].id;
    let seed: string;
    try { seed = await Deno.readTextFile(new URL('../seed-members.sql', import.meta.url)); }
    catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
      seed = `insert into public.member_profiles (band_id, email, name, birth_date, phone)
        select bands.id, profiles.email, profiles.name, profiles.birth_date, profiles.phone
        from public.bands as bands cross join (values
          ('mt.peresn@gmail.com', 'Admin profile', date '2000-01-02', '001234'),
          ('one@example.com', 'Member one', date '2000-02-03', '001235'),
          ('two@example.com', 'Member two', date '2000-03-04', '001236'),
          ('three@example.com', 'Member three', date '2000-04-05', '001237')
        ) as profiles(email, name, birth_date, phone)
        where bands.slug = 'sardinhas-nomades'
        on conflict (band_id, email) do nothing;`;
    }
    await db.exec(seed);
    await db.exec(seed);
    const { rows: profiles } = await db.query<{ count: number }>('select count(*)::integer as count from public.member_profiles');
    if (profiles[0].count !== 4) throw new Error('Member seed is not idempotent');
    const { rows: matt } = await db.query<{ birth_date: string; name: string; phone: string }>("select birth_date::text, name, phone from public.member_profiles where email = 'mt.peresn@gmail.com'");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(matt[0].birth_date) || !matt[0].name || !matt[0].phone) throw new Error('Imported member fields were lost');
    await db.query('insert into public.bands (id, name, slug) values ($1, $2, $3)', [otherBand, 'Other band', 'other-band']);
    await db.query('insert into public.band_members (band_id, user_id, roles) values ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)',
      [firstBand, musician, ['musician'], otherBand, outsider, ['admin'], firstBand, finance, ['finance_manager']]);
    for (const [band, id, owner] of [[firstBand, firstSheet, admin], [otherBand, otherSheet, outsider]]) {
      await db.query('insert into public.music_sheets (id, band_id, title, file_name, file_size, storage_path, uploaded_by) values ($1, $2, $3, $4, $5, $6, $7)',
        [id, band, 'Test PDF', 'test.pdf', 100, `${band}/${id}.pdf`, owner]);
      await db.query("insert into storage.objects (bucket_id, name) values ('music-sheets', $1)", [`${band}/${id}.pdf`]);
    }
    await db.exec('set role anon');
    await denied('select * from public.music_sheets');
    await denied('select * from public.member_profiles');
    await denied('select public.get_workspace_members($1, 0)', [firstBand]);
    await denied('select public.update_workspace_member_active($1, $2, false)', [firstBand, musician]);
    await denied('select * from public.contact_email_recipients()');
    await denied('select public.claim_contact_email($1)', ['a'.repeat(64)]);
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [musician]);
    const { rows: sheets } = await db.query<{ band_id: string }>('select * from public.music_sheets');
    const { rows: objects } = await db.query<{ name: string }>('select * from storage.objects');
    if (sheets.length !== 1 || sheets[0].band_id !== firstBand || objects.length !== 1 || !objects[0].name.startsWith(firstBand)) throw new Error('Cross-band data leaked');
    if ((await db.query('select * from public.member_profiles')).rows.length) throw new Error('Musician read private member profiles');
    await denied('insert into public.band_members (band_id, user_id, roles) values ($1, $2, $3)', [otherBand, musician, ['admin']]);
    await denied('select public.get_workspace_members($1, 0)', [firstBand]);
    await denied('select public.update_workspace_member_active($1, $2, false)', [firstBand, admin]);
    await denied('update public.band_members set active = true where user_id = $1', [musician]);
    await denied('select * from public.find_invite_user($1)', ['mt.peresn@gmail.com']);
    await denied('select public.approve_music_member($1, $2, $3)', [otherBand, musician, outsider]);
    await denied("insert into storage.objects (bucket_id, name) values ('music-sheets', $1)", [`${otherBand}/33333333-3333-4333-8333-333333333333.pdf`]);
    await denied('insert into public.music_sheets (id, band_id, title, file_name, file_size, storage_path, uploaded_by) values ($1, $2, $3, $4, $5, $6, $7)',
      ['33333333-3333-4333-8333-333333333333', otherBand, 'Denied', 'test.pdf', 100, `${otherBand}/33333333-3333-4333-8333-333333333333.pdf`, musician]);
    const deleted = await db.query('delete from public.music_sheets where band_id = $1 returning id', [otherBand]);
    if (deleted.rows.length) throw new Error('Cross-band delete succeeded');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [finance]);
    if ((await db.query('select * from public.music_sheets')).rows.length || (await db.query('select * from storage.objects')).rows.length) throw new Error('Finance-only account read music');
    await db.exec('reset role; set role service_role');
    const { rows: mailAdmins } = await db.query<{ email: string }>('select * from public.contact_email_recipients()');
    if (mailAdmins.length !== 1 || mailAdmins[0].email !== 'mt.peresn@gmail.com') throw new Error('Contact recipients were not band-scoped');
    await db.exec('reset role');
    await db.query("update public.band_members set roles = roles || array['receive_mail']::text[] where band_id = $1 and user_id = $2", [firstBand, musician]);
    await db.query("update public.band_members set roles = roles || array['production']::text[] where band_id = $1 and user_id = $2", [firstBand, finance]);
    await db.exec('set role service_role');
    if ((await db.query('select * from public.contact_email_recipients()')).rows.length !== 3) throw new Error('Email recipient roles were ignored');
    const { rows: contactClaim } = await db.query<{ allowed: boolean }>('select public.claim_contact_email($1) as allowed', ['a'.repeat(64)]);
    const { rows: repeatContact } = await db.query<{ allowed: boolean }>('select public.claim_contact_email($1) as allowed', ['a'.repeat(64)]);
    if (!contactClaim[0].allowed || repeatContact[0].allowed) throw new Error('Contact send cooldown failed');
    for (let index = 0; index < 49; index += 1) {
      const { rows } = await db.query<{ allowed: boolean }>('select public.claim_contact_email($1) as allowed', [String(index).padStart(64, '0')]);
      if (!rows[0].allowed) throw new Error('Daily limit rejected an allowed message');
    }
    const { rows: cappedContact } = await db.query<{ allowed: boolean }>('select public.claim_contact_email($1) as allowed', ['b'.repeat(64)]);
    if (cappedContact[0].allowed) throw new Error('Daily contact send cap was bypassed');
    const { rows: roster } = await db.query<{ email: string; user_id: string | null; name: string | null }>('select * from public.list_workspace_members($1, $2, 0)', [firstBand, admin]);
    if (roster.length !== 6 || roster.filter((member) => member.email === 'mt.peresn@gmail.com').length !== 1 || roster.filter((member) => member.user_id === null).length !== 3) throw new Error('Member profiles did not join account list correctly');
    const profileOnly = roster.find((member) => member.user_id === null)!;
    await db.query('update public.member_profiles set roles = $1 where band_id = $2 and email = $3', [['musician', 'production'], firstBand, profileOnly.email]);
    await denied('update public.member_profiles set roles = $1 where band_id = $2 and email = $3', [['invalid'], firstBand, profileOnly.email]);
    await denied('update public.member_profiles set roles = $1 where band_id = $2 and email = $3', [[null], firstBand, profileOnly.email]);
    const { rows: taggedRoster } = await db.query<{ email: string; user_id: string | null; roles: string[]; active: boolean }>('select * from public.list_workspace_members($1, $2, 0)', [firstBand, admin]);
    const tagged = taggedRoster.find((member) => member.email === profileOnly.email)!;
    if (JSON.stringify(tagged.roles) !== JSON.stringify(['musician', 'production']) || tagged.user_id !== null || tagged.active) throw new Error('Profile role tags were lost or granted account access');
    await db.query('select public.set_workspace_member_roles($1, $2, $3, $4)', [firstBand, musician, admin, ['musician', 'production', 'receive_mail']]);
    const { rows: multiRole } = await db.query<{ roles: string[] }>('select roles from public.band_members where band_id = $1 and user_id = $2', [firstBand, musician]);
    if (!multiRole[0].roles.includes('musician') || !multiRole[0].roles.includes('production')) throw new Error('Account role tags were treated as an exclusive selection');
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
    if ((await db.query('select * from public.member_profiles')).rows.length !== 4) throw new Error('Admin cannot read imported profiles');
    const { rows: directRoster } = await db.query<{ result: { members: { active: boolean }[] } }>('select public.get_workspace_members($1, 0) as result', [firstBand]);
    if (directRoster[0].result.members.length !== 6) throw new Error('Authenticated admin cannot list members');
    await denied('select public.update_workspace_member_active($1, $2, false)', [firstBand, admin]);
    await denied('select public.update_workspace_member_active($1, $2, false)', [otherBand, outsider]);
    await db.query('select public.update_workspace_member_active($1, $2, false)', [firstBand, musician]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [musician]);
    if ((await db.query('select * from public.music_sheets')).rows.length || (await db.query('select * from storage.objects')).rows.length || (await db.query('select * from public.bands')).rows.length) throw new Error('Inactive member retained data access');
    await denied("insert into storage.objects (bucket_id, name) values ('music-sheets', $1)", [`${firstBand}/33333333-3333-4333-8333-333333333333.pdf`]);
    await denied('insert into public.music_sheets (id, band_id, title, file_name, file_size, storage_path, uploaded_by) values ($1, $2, $3, $4, $5, $6, $7)',
      ['33333333-3333-4333-8333-333333333333', firstBand, 'Denied', 'test.pdf', 100, `${firstBand}/33333333-3333-4333-8333-333333333333.pdf`, musician]);
    if ((await db.query('delete from public.music_sheets where id = $1 returning id', [firstSheet])).rows.length) throw new Error('Inactive member deleted a sheet');
    if ((await db.query('delete from storage.objects returning id')).rows.length) throw new Error('Inactive member deleted storage');
    await db.exec('reset role; set role service_role');
    await db.query('select public.approve_music_member($1, $2, $3)', [firstBand, musician, admin]);
    const { rows: inactive } = await db.query<{ active: boolean }>('select active from public.band_members where band_id = $1 and user_id = $2', [firstBand, musician]);
    if (inactive[0].active) throw new Error('Account approval silently reactivated a disabled member');
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [admin]);
    await db.query('select public.update_workspace_member_active($1, $2, true)', [firstBand, musician]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [musician]);
    if ((await db.query('select * from public.music_sheets')).rows.length !== 1) throw new Error('Reactivated member did not regain access');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [outsider]);
    if ((await db.query('select * from public.member_profiles')).rows.length) throw new Error('Another band admin read private profiles');
    await denied('select public.get_workspace_members($1, 0)', [firstBand]);
    await denied('select public.update_workspace_member_active($1, $2, false)', [firstBand, musician]);
    await db.exec('reset role; set role service_role');
    await denied('select * from public.list_workspace_members($1, $2, 0)', [firstBand, outsider]);
    await denied('select public.approve_music_member($1, $2, $3)', [firstBand, outsider, musician]);
    const { rows: initialClaim } = await db.query<{ allowed: boolean }>('select public.claim_member_invite($1, $2) as allowed', [firstBand, admin]);
    const { rows: repeatClaim } = await db.query<{ allowed: boolean }>('select public.claim_member_invite($1, $2) as allowed', [firstBand, admin]);
    if (!initialClaim[0].allowed || repeatClaim[0].allowed) throw new Error('Invite throttling failed');
    await db.query('select public.approve_music_member($1, $2, $3)', [firstBand, finance, admin]);
    const { rows: combined } = await db.query<{ roles: string[] }>('select roles from public.band_members where band_id = $1 and user_id = $2', [firstBand, finance]);
    if (!combined[0].roles.includes('finance_manager') || !combined[0].roles.includes('musician')) throw new Error('Existing roles were not preserved');
    await db.exec('reset role');
    await db.query("update public.band_members set active = false, roles = roles || array['admin']::text[] where band_id = $1 and user_id = $2", [firstBand, finance]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [finance]);
    await denied('select public.get_workspace_members($1, 0)', [firstBand]);
    await denied('select public.update_workspace_member_active($1, $2, true)', [firstBand, finance]);
    if ((await db.query('select * from public.member_profiles')).rows.length) throw new Error('Inactive admin read private profiles');
    await db.exec('reset role; set role service_role');
    if ((await db.query('select * from public.contact_email_recipients()')).rows.length !== 2) throw new Error('Inactive member still receives contact mail');
    await denied('select public.approve_music_member($1, $2, $3)', [firstBand, outsider, finance]);
    await db.exec('reset role');
    await db.query('delete from public.band_members where band_id = $1 and user_id = $2', [firstBand, musician]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [musician]);
    if ((await db.query('select * from public.music_sheets')).rows.length || (await db.query('select * from storage.objects')).rows.length) throw new Error('Removed member retained data access');
  } finally { await db.close(); }
});

Deno.test('setlists preserve concert order, save atomically and enforce band access', async () => {
  const db = new PGlite();
  const musician = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const outsider = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const finance = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const otherBand = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  async function denied(sql: string, args: unknown[] = []) {
    let failed = false;
    try { await db.query(sql, args); } catch { failed = true; }
    if (!failed) throw new Error('Expected denied query: ' + sql);
  }
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, storage to authenticated;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (bucket_id text, name text);
      create function storage.foldername(path text) returns text[] language sql as $$ select string_to_array(path, '/') $$;
      alter table storage.objects enable row level security;
    `);
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611100001_music_library.sql', import.meta.url)));
    await db.exec(`
      alter table public.band_members add column active boolean not null default true;
      create or replace function public.can_access_music(target_band uuid)
      returns boolean language sql stable security definer set search_path = '' as $$
        select exists (select 1 from public.band_members where band_id = target_band
          and user_id = (select auth.uid()) and active and roles && array['owner', 'admin', 'musician']::text[]);
      $$;
    `);
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611120002_songs_repertoire.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611120003_setlists.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../migrations/202611120004_song_sheets.sql', import.meta.url)));
    await db.exec(await Deno.readTextFile(new URL('../seed-songs.sql', import.meta.url)));
    const seed = await Deno.readTextFile(new URL('../seed-setlists.sql', import.meta.url));
    await db.exec(seed);
    await db.exec(seed);
    const { rows: lists } = await db.query<{ id: string; band_id: string; title: string }>('select * from public.setlists');
    if (lists.length !== 1 || lists[0].title !== 'Brasilidades - Lavagem das Escadas de Sto Antonio 26') throw new Error('Setlist seed duplicated or title changed');
    const setlist = lists[0];
    const { rows: ordered } = await db.query<{ id: string; title: string; position: number }>(`
      select songs.id, songs.title, entries.position from public.setlist_songs entries
      join public.songs on songs.id = entries.song_id where setlist_id = $1 order by position`, [setlist.id]);
    const expected = ['Emoriô', 'Anunciação', 'Ai que saudade D`ocê', 'Eu só quero um xodó', 'Asa Branca', 'Carinito', 'Lucro', 'A Praieira', 'Palco', 'Água de Beber', 'O Sol Nascerá', 'Você Não entende Nada', 'Prefixo de Verão', 'A luz de Tieta', 'Baile de Favela', 'Rap da Felicidade', 'Verdinha'];
    if (JSON.stringify(ordered.map((song) => song.title)) !== JSON.stringify(expected) || ordered.some((song, index) => song.position !== index + 1)) throw new Error('Concert order changed');
    await db.query('insert into auth.users values ($1), ($2), ($3)', [musician, outsider, finance]);
    await db.query("insert into public.bands (id, name, slug) values ($1, 'Other', 'other')", [otherBand]);
    await db.query('insert into public.band_members (band_id, user_id, roles) values ($1, $2, $3), ($4, $5, $6), ($1, $7, $8)',
      [setlist.band_id, musician, ['musician'], otherBand, outsider, ['admin'], finance, ['finance_manager']]);
    const { rows: otherSongs } = await db.query<{ id: string }>("insert into public.songs (band_id, title) values ($1, 'Other song') returning id", [otherBand]);
    await denied('insert into public.setlist_songs values ($1, $2, $3, 18)', [setlist.id, setlist.band_id, otherSongs[0].id]);
    await db.exec('set role anon');
    await denied('select * from public.setlists');
    await denied('select public.save_setlist($1, null, $2, $3)', [setlist.band_id, 'Denied', [ordered[0].id]]);
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [musician]);
    if ((await db.query('select * from public.setlist_songs')).rows.length !== 17) throw new Error('Musician cannot read setlist');
    const sheetId = '11111111-1111-4111-8111-111111111111';
    const secondSheet = '22222222-2222-4222-8222-222222222222';
    for (const id of [sheetId, secondSheet]) {
      await db.query('insert into public.music_sheets (id, band_id, title, instrument, file_name, file_size, storage_path, uploaded_by) values ($1, $2, $3, $4, $5, 100, $6, $7)',
        [id, setlist.band_id, 'Test score', 'Sax Alto', 'score.pdf', `${setlist.band_id}/${id}.pdf`, musician]);
    }
    await db.query('update public.music_sheets set song_id = $1 where id = $2', [ordered[0].id, sheetId]);
    if ((await db.query<{ song_id: string }>('select song_id from public.music_sheets where id = $1', [sheetId])).rows[0].song_id !== ordered[0].id) throw new Error('Sheet attachment not saved');
    await denied('update public.music_sheets set song_id = $1 where id = $2', [otherSongs[0].id, sheetId]);
    await denied("update public.music_sheets set instrument = '' where id = $1", [sheetId]);
    await denied('update public.music_sheets set song_id = $1 where id = $2', [ordered[0].id, secondSheet]);
    await denied("update public.music_sheets set title = 'Forbidden' where id = $1", [sheetId]);
    await db.query('update public.music_sheets set song_id = null where id = $1', [sheetId]);
    await db.query('update public.music_sheets set song_id = $1 where id = $2', [ordered[0].id, sheetId]);
    await denied('select public.save_setlist($1, $2, $3, $4)', [setlist.band_id, setlist.id, setlist.title, [otherSongs[0].id]]);
    if ((await db.query('select * from public.setlist_songs')).rows.length !== 17) throw new Error('Invalid save damaged setlist');
    await denied('select public.save_setlist($1, null, $2, $3)', [setlist.band_id, 'Empty', []]);
    await denied('select public.save_setlist($1, null, $2, $3)', [setlist.band_id, 'Null song', [null]]);
    await denied('insert into public.setlist_songs values ($1, $2, $3, 18)', [setlist.id, setlist.band_id, ordered[0].id]);
    const { rows: saved } = await db.query<{ id: string }>('select public.save_setlist($1, null, $2, $3) as id', [setlist.band_id, 'Test', [ordered[0].id, ordered[1].id]]);
    await db.query('select public.save_setlist($1, $2, $3, $4)', [setlist.band_id, saved[0].id, 'Renamed', [ordered[1].id, ordered[0].id, ordered[1].id]]);
    const { rows: edited } = await db.query<{ song_id: string }>('select song_id from public.setlist_songs where setlist_id = $1 order by position', [saved[0].id]);
    if (JSON.stringify(edited.map((song) => song.song_id)) !== JSON.stringify([ordered[1].id, ordered[0].id, ordered[1].id])) throw new Error('Reorder or repeated songs were lost');
    await db.query('select public.save_setlist($1, $2, $3, $4)', [setlist.band_id, setlist.id, setlist.title, [ordered[1].id]]);
    await db.exec('reset role');
    await db.exec(seed);
    if ((await db.query('select * from public.setlist_songs where setlist_id = $1', [setlist.id])).rows.length !== 1) throw new Error('Seed overwrote later edits');
    await db.exec('set role authenticated');
    for (const user of [outsider, finance]) {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user]);
      if ((await db.query('select * from public.setlists')).rows.length || (await db.query('select * from public.setlist_songs')).rows.length) throw new Error('Setlists leaked');
      await denied('select public.save_setlist($1, $2, $3, $4)', [setlist.band_id, setlist.id, 'Denied', [ordered[0].id]]);
      if ((await db.query('delete from public.setlists where id = $1 returning id', [setlist.id])).rows.length) throw new Error('Unauthorized delete succeeded');
      if ((await db.query('update public.music_sheets set song_id = null where id = $1 returning id', [sheetId])).rows.length) throw new Error('Unauthorized sheet relink succeeded');
    }
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [outsider]);
    await denied('select public.save_setlist($1, $2, $3, $4)', [otherBand, setlist.id, 'Wrong band', [otherSongs[0].id]]);
    await db.exec('reset role');
    await db.query('update public.band_members set active = false where user_id = $1', [musician]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [musician]);
    if ((await db.query('select * from public.setlists')).rows.length) throw new Error('Inactive musician retained setlist access');
    if ((await db.query('update public.music_sheets set song_id = null where id = $1 returning id', [sheetId])).rows.length) throw new Error('Inactive member changed sheet attachment');
    await denied('select public.save_setlist($1, $2, $3, $4)', [setlist.band_id, setlist.id, 'Denied', [ordered[0].id]]);
    await db.exec('reset role');
    await db.query('update public.band_members set active = true where user_id = $1', [musician]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [musician]);
    await db.query('delete from public.setlists where id = $1', [saved[0].id]);
    if ((await db.query('select * from public.setlist_songs where setlist_id = $1', [saved[0].id])).rows.length) throw new Error('Delete left orphaned entries');
    if ((await db.query('select * from public.songs')).rows.length !== 50) throw new Error('Deleting a setlist removed songs');
  } finally { await db.close(); }
});