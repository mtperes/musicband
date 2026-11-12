import { createMembersHandler } from './handler.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { workspaceEmail, workspaceUsername } from '../../../src/utils/workspaceIdentity.ts';

const bandId = '11111111-1111-4111-8111-111111111111';
const settings = { url: 'https://example.supabase.co', publicKey: 'public-test', secretKey: 'secret-test', siteUrl: 'https://band.example', origins: ['https://band.example'] };

function fixture(options: { role?: string; active?: boolean; authenticated?: boolean; existing?: boolean; unconfirmed?: boolean; limit?: boolean; approvalFails?: boolean; creationFails?: boolean; profileFails?: boolean } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let privileged = false;
  const factory = (_url: string, key: string) => {
    if (key === settings.secretKey) privileged = true;
    const client = {
      auth: {
        getUser: () => Promise.resolve({ data: { user: options.authenticated === false ? null : { id: 'actor' } }, error: null }),
        admin: { createUser: (args: Record<string, unknown>) => { calls.push({ name: 'create', args }); return Promise.resolve({ data: { user: options.creationFails ? null : { id: 'new-user' } }, error: options.creationFails ? { message: 'Rejected' } : null }); } },
      },
      from: () => {
        const query = { select: () => query, eq: () => query, maybeSingle: () => Promise.resolve({ data: options.role === 'none' ? null : { roles: [options.role ?? 'admin'], active: options.active !== false }, error: null }), upsert: (args: Record<string, unknown>) => { calls.push({ name: 'save-profile', args }); return Promise.resolve({ error: options.profileFails ? { message: 'Rejected' } : null }); } };
        return query;
      },
      rpc: (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        const data = name === 'claim_member_invite' ? options.limit !== false
          : name === 'find_invite_user' ? options.existing ? [{ user_id: 'existing-user', confirmed: !options.unconfirmed }] : []
          : name === 'list_workspace_members' ? [{ user_id: 'member', email: 'member@example.com', roles: ['musician'], confirmed: true }] : null;
        return Promise.resolve({ data, error: name === 'approve_music_member' && options.approvalFails ? { code: 'XX000' } : null });
      },
    };
    return client as unknown as SupabaseClient;
  };
  return { handler: createMembersHandler(settings, factory), calls, isPrivileged: () => privileged };
}

function request(body: object, authenticated = true) {
  return new Request('https://function.example', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: settings.siteUrl, ...(authenticated ? { Authorization: 'Bearer test-jwt' } : {}) }, body: JSON.stringify(body) });
}

for (const role of ['musician', 'finance_manager', 'none']) {
  Deno.test(`${role} cannot use privileged member operations`, async () => {
    const test = fixture({ role });
    const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123' }));
    if (response.status !== 403 || test.isPrivileged()) throw new Error('Unauthorized member reached privileged client');
  });
}
Deno.test('missing or invalid session cannot list members', async () => {
  for (const authenticated of [false, true]) {
    const test = fixture({ authenticated: false });
    const response = await test.handler(request({ action: 'list', band_id: bandId }, authenticated));
    if (response.status !== 401 || test.isPrivileged()) throw new Error('Invalid session reached privileged client');
  }
});
Deno.test('admin listing is scoped to requested band and verified actor', async () => {
  const test = fixture();
  const response = await test.handler(request({ action: 'list', band_id: bandId, offset: 50 }));
  const call = test.calls[0];
  if (response.status !== 200 || call.args.target_band !== bandId || call.args.actor !== 'actor' || call.args.page_start !== 50) throw new Error('Unscoped list');
});
Deno.test('existing account is reused without replacing its password', async () => {
  const test = fixture({ existing: true });
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: ' MEMBER@EXAMPLE.COM ', password: 'member123' }));
  if (response.status !== 200 || test.calls.some((call) => call.name === 'create') || test.calls.at(-1)?.args.target_user !== 'existing-user' || (await response.json()).account_created !== false) throw new Error('Existing account was not preserved');
});
Deno.test('new password account is confirmed without email and approves returned user ID', async () => {
  const test = fixture();
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: ' MEMBER@EXAMPLE.COM ', password: 'member123' }));
  const creation = test.calls.find((call) => call.name === 'create');
  if (response.status !== 200 || creation?.args.email !== 'member@example.com' || creation.args.password !== 'member123' || creation.args.email_confirm !== true || test.calls.at(-1)?.args.target_user !== 'new-user' || (await response.json()).account_created !== true) throw new Error('Invalid password account flow');
});
Deno.test('rate limit blocks account creation and lookup', async () => {
  const test = fixture({ limit: false });
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123' }));
  if (response.status !== 429 || test.calls.length !== 1) throw new Error('Rate limit bypassed');
});
Deno.test('client cannot choose administrator roles', async () => {
  const test = fixture();
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123', roles: ['admin'] }));
  if (response.status !== 400 || test.isPrivileged()) throw new Error('Role injection accepted');
});
Deno.test('partial approval failure is not reported as success', async () => {
  const test = fixture({ approvalFails: true });
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123' }));
  if (response.status !== 503 || !(await response.json()).error) throw new Error('Partial failure hidden');
});
Deno.test('invalid origin and oversized body are rejected', async () => {
  const test = fixture();
  const origin = new Request('https://function.example', { method: 'POST', headers: { Origin: 'https://other.example' }, body: '{}' });
  if ((await test.handler(origin)).status !== 403) throw new Error('Origin accepted');
  const large = request({ action: 'create', band_id: bandId, email: 'a'.repeat(5000), password: 'member123' });
  if ((await test.handler(large)).status !== 400 || test.isPrivileged()) throw new Error('Oversized body accepted');
});
Deno.test('invalid passwords are rejected before privileged operations', async () => {
  for (const password of [undefined, '', 'short', 'x'.repeat(129), 12345678]) {
    const test = fixture();
    const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password }));
    if (response.status !== 400 || test.isPrivileged()) throw new Error('Invalid password accepted');
  }
});
Deno.test('unconfirmed existing account is not approved or overwritten', async () => {
  const test = fixture({ existing: true, unconfirmed: true });
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123' }));
  if (response.status !== 409 || test.calls.some((call) => ['create', 'approve_music_member'].includes(call.name))) throw new Error('Existing unconfirmed account was changed');
});
Deno.test('failed account creation grants no membership', async () => {
  const test = fixture({ creationFails: true });
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123' }));
  if (response.status !== 502 || test.calls.some((call) => call.name === 'approve_music_member')) throw new Error('Failed account creation granted access');
});
Deno.test('username mapping preserves email logins and reserves the admin alias', () => {
  if (workspaceEmail(' ADMIN ') !== 'mt.peresn@gmail.com' || workspaceUsername('mt.peresn@gmail.com') !== 'admin') throw new Error('Admin alias changed');
  if (workspaceEmail(' MEMBER@EXAMPLE.COM ') !== 'member@example.com') throw new Error('Existing email login changed');
  const address = workspaceEmail(' Musician.One ');
  if (address !== 'musician.one@members.sardinhas-nomades.invalid' || workspaceUsername(address) !== 'musician.one') throw new Error('Username did not round trip');
  for (const username of ['', 'ab', 'with spaces', 'x'.repeat(65)]) {
    let rejected = false;
    try { workspaceEmail(username); } catch { rejected = true; }
    if (!rejected) throw new Error('Invalid username accepted');
  }
});
Deno.test('password authentication does not require email redirect configuration', async () => {
  const handler = createMembersHandler({ ...settings, siteUrl: '' }, () => {
    throw new Error('Expected authentication to be attempted');
  });
  const response = await handler(request({ action: 'list', band_id: bandId }));
  if (response.status !== 503 || (await response.json()).error !== 'Member service unavailable. Try again later.') throw new Error('Email redirect configuration still required');
});
Deno.test('profile save is scoped to the verified band and ignores injected fields', async () => {
  const test = fixture();
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123', profile: { name: ' Member ', birth_date: '1990-04-17', phone: '001234', band_id: 'other-band', email: 'other@example.com', roles: ['admin'] } }));
  const saved = test.calls.find((call) => call.name === 'save-profile');
  if (response.status !== 200 || saved?.args.band_id !== bandId || saved.args.email !== 'member@example.com' || saved.args.name !== 'Member' || saved.args.phone !== '001234' || saved.args.roles !== undefined) throw new Error('Profile identity or permissions changed');
});
Deno.test('invalid profile dates and names are rejected before privileged operations', async () => {
  for (const profile of [{ name: '' }, { name: 'Member', birth_date: '1990-02-30' }, { name: 'Member', birth_date: '17/04/1990' }, { name: 'Member', phone: 123 }]) {
    const test = fixture();
    const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123', profile }));
    if (response.status !== 400 || test.isPrivileged()) throw new Error('Invalid profile accepted');
  }
});
Deno.test('profile failure reports already-approved access without claiming complete success', async () => {
  const test = fixture({ profileFails: true });
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123', profile: { name: 'Member' } }));
  if (response.status !== 503 || !(await response.json()).error.includes('access was approved')) throw new Error('Partial profile failure was hidden');
});
Deno.test('empty optional fields do not overwrite an imported profile during account approval', async () => {
  const test = fixture({ existing: true });
  const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123', profile: { name: 'Member', birth_date: null, address: '', phone: '' } }));
  const saved = test.calls.find((call) => call.name === 'save-profile');
  if (response.status !== 200 || !saved || ['birth_date', 'address', 'phone'].some((field) => field in saved.args)) throw new Error('Blank fields overwrote imported data');
});
Deno.test('inactive administrators cannot use privileged account operations', async () => {
  for (const role of ['admin', 'owner']) {
    const test = fixture({ role, active: false });
    const response = await test.handler(request({ action: 'create', band_id: bandId, email: 'member@example.com', password: 'member123' }));
    if (response.status !== 403 || test.isPrivileged()) throw new Error('Inactive administrator reached privileged client');
  }
});
Deno.test('configured localhost preflight is allowed only for exact origins', async () => {
  const handler = createMembersHandler({ ...settings, origins: ['http://localhost:5181', 'http://127.0.0.1:5181'] });
  for (const origin of ['http://localhost:5181', 'http://127.0.0.1:5181']) {
    const response = await handler(new Request('https://function.example', { method: 'OPTIONS', headers: { Origin: origin } }));
    if (response.status !== 200 || response.headers.get('Access-Control-Allow-Origin') !== origin) throw new Error('Configured preflight denied');
  }
  if ((await handler(new Request('https://function.example', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5182' } }))).status !== 403) throw new Error('Unconfigured localhost origin accepted');
});