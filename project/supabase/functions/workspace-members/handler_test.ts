import { createMembersHandler } from './handler.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const bandId = '11111111-1111-4111-8111-111111111111';
const settings = { url: 'https://example.supabase.co', publicKey: 'public-test', secretKey: 'secret-test', siteUrl: 'https://band.example', origins: ['https://band.example'] };

function fixture(options: { role?: string; authenticated?: boolean; existing?: boolean; limit?: boolean; approvalFails?: boolean } = {}) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  let privileged = false;
  const factory = (_url: string, key: string) => {
    if (key === settings.secretKey) privileged = true;
    const client = {
      auth: {
        getUser: () => Promise.resolve({ data: { user: options.authenticated === false ? null : { id: 'actor' } }, error: null }),
        admin: { inviteUserByEmail: (email: string) => { calls.push({ name: 'invite', args: { email } }); return Promise.resolve({ data: { user: { id: 'new-user' } }, error: null }); } },
      },
      from: () => {
        const query = { select: () => query, eq: () => query, maybeSingle: () => Promise.resolve({ data: options.role === 'none' ? null : { roles: [options.role ?? 'admin'] }, error: null }) };
        return query;
      },
      rpc: (name: string, args: Record<string, unknown>) => {
        calls.push({ name, args });
        const data = name === 'claim_member_invite' ? options.limit !== false
          : name === 'find_invite_user' ? options.existing ? [{ user_id: 'existing-user', confirmed: true }] : []
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
    const response = await test.handler(request({ action: 'invite', band_id: bandId, email: 'member@example.com' }));
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
Deno.test('existing account is reused without sending another invitation', async () => {
  const test = fixture({ existing: true });
  const response = await test.handler(request({ action: 'invite', band_id: bandId, email: ' MEMBER@EXAMPLE.COM ' }));
  if (response.status !== 200 || test.calls.some((call) => call.name === 'invite') || test.calls.at(-1)?.args.target_user !== 'existing-user') throw new Error('Existing account was not preserved');
});
Deno.test('new invitation normalizes email and approves returned user ID', async () => {
  const test = fixture();
  const response = await test.handler(request({ action: 'invite', band_id: bandId, email: ' MEMBER@EXAMPLE.COM ' }));
  if (response.status !== 200 || test.calls.find((call) => call.name === 'invite')?.args.email !== 'member@example.com' || test.calls.at(-1)?.args.target_user !== 'new-user') throw new Error('Invalid invite flow');
});
Deno.test('rate limit blocks invitation and account lookup', async () => {
  const test = fixture({ limit: false });
  const response = await test.handler(request({ action: 'invite', band_id: bandId, email: 'member@example.com' }));
  if (response.status !== 429 || test.calls.length !== 1) throw new Error('Rate limit bypassed');
});
Deno.test('client cannot choose administrator roles', async () => {
  const test = fixture();
  const response = await test.handler(request({ action: 'invite', band_id: bandId, email: 'member@example.com', roles: ['admin'] }));
  if (response.status !== 400 || test.isPrivileged()) throw new Error('Role injection accepted');
});
Deno.test('partial approval failure is not reported as success', async () => {
  const test = fixture({ approvalFails: true });
  const response = await test.handler(request({ action: 'invite', band_id: bandId, email: 'member@example.com' }));
  if (response.status !== 503 || !(await response.json()).error) throw new Error('Partial failure hidden');
});
Deno.test('invalid origin and oversized body are rejected', async () => {
  const test = fixture();
  const origin = new Request('https://function.example', { method: 'POST', headers: { Origin: 'https://other.example' }, body: '{}' });
  if ((await test.handler(origin)).status !== 403) throw new Error('Origin accepted');
  const large = request({ action: 'invite', band_id: bandId, email: 'a'.repeat(5000) });
  if ((await test.handler(large)).status !== 400 || test.isPrivileged()) throw new Error('Oversized body accepted');
});