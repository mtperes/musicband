import { PGlite } from '@electric-sql/pglite';

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
    await db.query('insert into auth.users values ($1, $2, now()), ($3, $4, now()), ($5, $6, now()), ($7, $8, now())',
      [admin, 'mt.peresn@gmail.com', musician, 'musician@example.com', outsider, 'outsider@example.com', finance, 'finance@example.com']);
    const bootstrap = await Deno.readTextFile(new URL('../bootstrap-admin.sql', import.meta.url));
    await db.exec(bootstrap);
    await db.exec(bootstrap);
    const { rows: bands } = await db.query<{ id: string }>("select id from public.bands where slug = 'sardinhas-nomades'");
    const firstBand = bands[0].id;
    await db.query('insert into public.bands (id, name, slug) values ($1, $2, $3)', [otherBand, 'Other band', 'other-band']);
    await db.query('insert into public.band_members values ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)',
      [firstBand, musician, ['musician'], otherBand, outsider, ['admin'], firstBand, finance, ['finance_manager']]);
    for (const [band, id, owner] of [[firstBand, firstSheet, admin], [otherBand, otherSheet, outsider]]) {
      await db.query('insert into public.music_sheets (id, band_id, title, file_name, file_size, storage_path, uploaded_by) values ($1, $2, $3, $4, $5, $6, $7)',
        [id, band, 'Test PDF', 'test.pdf', 100, `${band}/${id}.pdf`, owner]);
      await db.query("insert into storage.objects (bucket_id, name) values ('music-sheets', $1)", [`${band}/${id}.pdf`]);
    }
    await db.exec('set role anon');
    await denied('select * from public.music_sheets');
    await db.exec('reset role; set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [musician]);
    const { rows: sheets } = await db.query<{ band_id: string }>('select * from public.music_sheets');
    const { rows: objects } = await db.query<{ name: string }>('select * from storage.objects');
    if (sheets.length !== 1 || sheets[0].band_id !== firstBand || objects.length !== 1 || !objects[0].name.startsWith(firstBand)) throw new Error('Cross-band data leaked');
    await denied('insert into public.band_members values ($1, $2, $3)', [otherBand, musician, ['admin']]);
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
    await denied('select * from public.list_workspace_members($1, $2, 0)', [firstBand, outsider]);
    await denied('select public.approve_music_member($1, $2, $3)', [firstBand, outsider, musician]);
    const { rows: initialClaim } = await db.query<{ allowed: boolean }>('select public.claim_member_invite($1, $2) as allowed', [firstBand, admin]);
    const { rows: repeatClaim } = await db.query<{ allowed: boolean }>('select public.claim_member_invite($1, $2) as allowed', [firstBand, admin]);
    if (!initialClaim[0].allowed || repeatClaim[0].allowed) throw new Error('Invite throttling failed');
    await db.query('select public.approve_music_member($1, $2, $3)', [firstBand, finance, admin]);
    const { rows: combined } = await db.query<{ roles: string[] }>('select roles from public.band_members where band_id = $1 and user_id = $2', [firstBand, finance]);
    if (!combined[0].roles.includes('finance_manager') || !combined[0].roles.includes('musician')) throw new Error('Existing roles were not preserved');
    await db.exec('reset role');
    await db.query('delete from public.band_members where band_id = $1 and user_id = $2', [firstBand, musician]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [musician]);
    if ((await db.query('select * from public.music_sheets')).rows.length || (await db.query('select * from storage.objects')).rows.length) throw new Error('Removed member retained data access');
  } finally { await db.close(); }
});