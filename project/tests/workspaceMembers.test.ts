import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMembersHandler } from '../supabase/functions/workspace-members/handler.ts';

const band = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const actor = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const member = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const settings = { url: 'https://example.com', publicKey: 'public', secretKey: 'secret', siteUrl: '', origins: ['http://localhost:5182'] };

function fixture(options: { actorRoles?: string[]; active?: boolean; targetRoles?: string[]; missing?: boolean; rolesDenied?: boolean; passwordDenied?: boolean; loginEmail?: string; loginDenied?: boolean } = {}) {
  const calls: { kind: string; value: unknown }[] = [];
  const factory = (_url: string, key: string) => ({
    auth: {
      getUser: async () => ({ data: { user: { id: actor } }, error: null }),
      signInWithPassword: async (value: unknown) => { calls.push({ kind: 'sign_in', value }); return { data: { session: options.loginDenied ? null : { access_token: 'test-access', refresh_token: 'test-refresh' } }, error: options.loginDenied ? { status: 400 } : null }; },
      admin: {
        createUser: async (value: unknown) => { calls.push({ kind: 'create', value }); return { data: { user: { id: member } }, error: null }; },
        getUserById: async () => ({ data: { user: { id: member, email: 'member@example.com' } }, error: null }),
        updateUserById: async (id: string, value: unknown) => { calls.push({ kind: 'password', value: { id, value } }); return { error: options.passwordDenied ? { message: 'Policy' } : null }; },
      },
    },
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const query = {
        select() { return query; },
        eq(column: string, value: unknown) { filters[column] = value; return query; },
        async maybeSingle() {
          calls.push({ kind: 'lookup', value: { table, filters } });
          return { data: key === 'public' ? { active: options.active ?? true, roles: options.actorRoles ?? ['owner'] } : options.missing ? null : table === 'member_profiles' ? { email: 'profile@example.com' } : { roles: options.targetRoles ?? ['musician'] }, error: null };
        },
        async upsert(value: unknown) { calls.push({ kind: 'profile', value }); return { error: null }; },
      };
      return query;
    },
    async rpc(name: string, value: unknown) {
      calls.push({ kind: name, value });
      return { data: name === 'find_invite_user' ? [] : ['claim_member_invite', 'workspace_username_available'].includes(name) ? true : name === 'resolve_workspace_login' ? options.loginEmail ?? null : null, error: options.rolesDenied && name === 'set_workspace_member_roles' ? { code: '42501' } : null };
    },
  }) as unknown as SupabaseClient;
  const handler = createMembersHandler(settings, factory);
  const send = (changes: Record<string, unknown> = {}, authenticated = true) => handler(new Request('https://example.com/members', {
    method: 'POST', headers: { ...(authenticated ? { authorization: 'Bearer test-session' } : {}), origin: settings.origins[0], 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'update', band_id: band, user_id: member, password: '', roles: ['musician', 'production'], profile: { name: 'Member', phone: '', birth_date: '' }, ...changes }),
  }));
  return { calls, send };
}

test('save updates roles and cleared profile fields without touching an empty password', async () => {
  const { send, calls } = fixture();
  assert.equal((await send()).status, 200);
  assert.deepEqual(calls.find((call) => call.kind === 'set_workspace_member_roles')?.value, { target_band: band, target_user: member, actor, new_roles: ['musician', 'production'] });
  const profile = calls.find((call) => call.kind === 'profile')?.value as Record<string, unknown>;
  assert.equal(profile.email, 'member@example.com');
  assert.equal(profile.phone, '');
  assert.equal(profile.birth_date, null);
  assert.equal(calls.some((call) => call.kind === 'password'), false);
  assert.ok(calls.filter((call) => call.kind === 'lookup').every((call) => (call.value as { filters: Record<string, unknown> }).filters.band_id === band));
});

test('save sets an explicitly supplied password through the admin API', async () => {
  const { send, calls } = fixture();
  assert.equal((await send({ password: 'new-password-123' })).status, 200);
  assert.deepEqual(calls.find((call) => call.kind === 'password')?.value, { id: member, value: { password: 'new-password-123', email_confirm: true } });
});

test('rejects unauthorized actors, cross-band targets and protected role changes before writes', async () => {
  for (const [options, status] of [
    [{ actorRoles: ['musician'] }, 403], [{ active: false }, 403], [{ missing: true }, 404],
    [{ actorRoles: ['admin'], targetRoles: ['owner'] }, 403], [{ rolesDenied: true }, 403],
  ] as const) {
    const { send, calls } = fixture({ ...options, actorRoles: 'actorRoles' in options ? [...options.actorRoles] : undefined, targetRoles: 'targetRoles' in options ? [...options.targetRoles] : undefined });
    assert.equal((await send({ password: 'new-password-123' })).status, status);
    assert.equal(calls.some((call) => ['profile', 'password'].includes(call.kind)), false);
  }
});

test('validates password, roles and profile before contacting Supabase', async () => {
  for (const changes of [{ password: 'short' }, { roles: [] }, { roles: ['invalid'] }, { profile: { name: 'Member', birth_date: '2026-02-30' } }]) {
    const { send, calls } = fixture();
    assert.equal((await send(changes)).status, 400);
    assert.equal(calls.length, 0);
  }
});

test('profile-only members can be edited without granting login access', async () => {
  const { send, calls } = fixture();
  assert.equal((await send({ user_id: null, profile_id: member, roles: ['musician', 'production', 'musician'] })).status, 200);
  assert.deepEqual((calls.find((call) => call.kind === 'profile')?.value as Record<string, unknown>).roles, ['musician', 'production']);
  assert.equal(calls.some((call) => ['password', 'set_workspace_member_roles'].includes(call.kind)), false);
});

test('profile-only role tags can be removed but invalid tags and passwords are rejected', async () => {
  const { send, calls } = fixture();
  assert.equal((await send({ user_id: null, profile_id: member, roles: [] })).status, 200);
  assert.deepEqual((calls.find((call) => call.kind === 'profile')?.value as Record<string, unknown>).roles, []);
  for (const changes of [{ roles: ['invalid'] }, { password: 'test-password-123' }]) {
    const isolated = fixture();
    assert.equal((await isolated.send({ user_id: null, profile_id: member, ...changes })).status, 400);
    assert.equal(isolated.calls.length, 0);
  }
});

test('password policy failure reports that profile and roles were already saved', async () => {
  const { send } = fixture({ passwordDenied: true });
  const response = await send({ password: 'new-password-123' });
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Profile and roles saved/);
});

test('username login resolves the account privately and returns tokens only after Auth accepts the password', async () => {
  const { send, calls } = fixture({ loginEmail: 'member@example.com' });
  const response = await send({ action: 'sign_in', username: ' Member.One ', password: 'test-password-123' });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.find((call) => call.kind === 'resolve_workspace_login')?.value, { login_username: 'member.one' });
  assert.deepEqual(calls.find((call) => call.kind === 'sign_in')?.value, { email: 'member@example.com', password: 'test-password-123' });
  assert.deepEqual(await response.json(), { session: { access_token: 'test-access', refresh_token: 'test-refresh' } });
  const denied = fixture({ loginDenied: true });
  const failed = await denied.send({ action: 'sign_in', username: 'unknown', password: 'test-password-123' });
  assert.equal(failed.status, 401);
  assert.equal((await failed.json()).session, undefined);
});

test('signed-out clients can authenticate but cannot access member administration', async () => {
  const { send } = fixture({ loginEmail: 'member@example.com' });
  const login = await send({ action: 'sign_in', username: 'admin', password: 'test-password-123' }, false);
  assert.equal(login.status, 200);
  assert.ok((await login.json()).session.access_token);
  for (const action of ['list', 'create', 'update']) {
    const isolated = fixture();
    assert.equal((await isolated.send({ action }, false)).status, 401);
    assert.equal(isolated.calls.length, 0);
  }
  const denied = fixture({ loginDenied: true });
  assert.equal((await denied.send({ action: 'sign_in', username: 'admin', password: 'wrong-password' }, false)).status, 401);
});

test('setting a profile password creates a confirmed account with the selected viewer role', async () => {
  const { send, calls } = fixture();
  const response = await send({ user_id: null, profile_id: member, username: 'member.one', email: 'profile@example.com', roles: ['viewer'], password: 'test-password-123' });
  assert.equal(response.status, 200);
  assert.deepEqual(calls.find((call) => call.kind === 'provision_workspace_member')?.value, { target_band: band, target_user: member, actor, new_roles: ['viewer'] });
  const profile = calls.find((call) => call.kind === 'profile')?.value as Record<string, unknown>;
  assert.equal(profile.username, 'member.one');
  assert.equal(profile.email, 'profile@example.com');
  assert.equal(profile.user_id, member);
  assert.equal('password' in profile, false);
  assert.equal(calls.some((call) => call.kind === 'password'), false);
});

test('a username reserved by another account cannot be taken over', async () => {
  const { send, calls } = fixture({ loginEmail: 'another@example.com' });
  assert.equal((await send({ username: 'taken', email: 'member@example.com' })).status, 409);
  assert.equal(calls.some((call) => ['profile', 'password', 'create'].includes(call.kind)), false);
});

test('an account save cannot overwrite a profile belonging to another member', async () => {
  const { send, calls } = fixture();
  assert.equal((await send({ profile_id: member })).status, 409);
  assert.equal(calls.some((call) => ['profile', 'password', 'set_workspace_member_roles'].includes(call.kind)), false);
});