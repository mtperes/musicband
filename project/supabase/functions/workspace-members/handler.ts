import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Settings = {
  url: string;
  publicKey: string;
  secretKey: string;
  siteUrl: string;
  origins: string[];
};
type ClientFactory = (url: string, key: string, options?: Parameters<typeof createClient>[2]) => SupabaseClient;

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('Missing body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new Error('Body too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function createMembersHandler(settings: Settings, factory: ClientFactory = createClient) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (origin && settings.origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
    if (origin && !settings.origins.includes(origin)) return reply(403, { error: 'Origin not allowed.' });
    if (request.method === 'OPTIONS') return reply(200, { ok: true });
    if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
    if (!settings.url || !settings.publicKey || !settings.secretKey || !settings.origins.length) return reply(503, { error: 'Member service is not configured.' });
    const authorization = request.headers.get('authorization');
    let body;
    try { body = await readBody(request); }
    catch { return reply(400, { error: 'Invalid request body.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Invalid request.' });
    const { action, band_id: bandId } = body;
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
    if (body.username !== undefined && (typeof body.username !== 'string' || (username !== '' && !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)))) return reply(400, { error: 'Use a username with 3 to 64 letters, numbers, dots, underscores or hyphens.' });
    if (action === 'sign_in') {
      if (!username || typeof body.password !== 'string' || !body.password || body.password.length > 128) return reply(401, { error: 'Utilizador ou palavra-passe inválidos.' });
      try {
        const server = factory(settings.url, settings.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: loginEmail, error: lookupError } = await server.rpc('resolve_workspace_login', { login_username: username });
        if (lookupError) return reply(503, { error: 'Serviço de autenticação indisponível.' });
        const client = factory(settings.url, settings.publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await client.auth.signInWithPassword({ email: loginEmail ?? `${username}@members.sardinhas-nomades.invalid`, password: body.password });
        if (error || !data.session) return reply(error?.status === 429 ? 429 : 401, { error: 'Utilizador ou palavra-passe inválidos.' });
        return reply(200, { session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
      } catch { return reply(503, { error: 'Serviço de autenticação indisponível.' }); }
    }
    if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Authentication required.' });
    const offset = body.offset ?? 0;
    const isUuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (!['list', 'create', 'update'].includes(action) || !isUuid(bandId)
      || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return reply(400, { error: 'Invalid action, workspace or offset.' });
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (action === 'create' && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.roles !== undefined)) return reply(400, { error: 'Provide a valid username or email; new members receive musician access only.' });
    if (action === 'create' && (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128)) return reply(400, { error: 'Use a password between 8 and 128 characters.' });
    if (action === 'update') {
      if (!isUuid(body.user_id) && !(body.user_id === null && isUuid(body.profile_id))) return reply(400, { error: 'Invalid member.' });
      if (typeof body.password !== 'string' || (body.password !== '' && (body.password.length < 8 || body.password.length > 128))) return reply(400, { error: 'Use a password between 8 and 128 characters, or leave it empty to keep the current password.' });
      if (!Array.isArray(body.roles) || body.roles.length > 7 || body.roles.some((role: unknown) => !['owner', 'admin', 'musician', 'viewer', 'finance_manager', 'production', 'receive_mail'].includes(role as string))
        || ((body.user_id || body.password) && !body.roles.length)) return reply(400, { error: 'Invalid member roles or account settings.' });
      if (body.email !== undefined && (typeof body.email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return reply(400, { error: 'Provide a valid email address.' });
      if (!body.user_id && body.password && !username) return reply(400, { error: 'Provide a username before creating a login.' });
      if (body.profile === undefined) return reply(400, { error: 'Provide the member profile.' });
    }
    let profile: Record<string, string | null> | undefined;
    if (['create', 'update'].includes(action) && body.profile !== undefined) {
      const input = body.profile;
      if (!input || typeof input !== 'object' || Array.isArray(input)) return reply(400, { error: 'Invalid member profile.' });
      const limits: Record<string, number> = { name: 160, shirt_size: 20, instrument: 100, address: 1000, phone: 100, emergency_contact: 500, instagram: 160, food_allergies: 1000 };
      profile = {};
      for (const [field, limit] of Object.entries(limits)) {
        const value = input[field] ?? '';
        if (typeof value !== 'string' || value.trim().length > limit) return reply(400, { error: 'Invalid member profile.' });
        profile[field] = value.trim();
      }
      if (!profile.name) return reply(400, { error: 'Provide the member name.' });
      const birthDate = input.birth_date;
      if (birthDate !== undefined && birthDate !== null && birthDate !== '') {
        if (typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return reply(400, { error: 'Invalid birth date.' });
        const parsed = new Date(`${birthDate}T00:00:00Z`);
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) return reply(400, { error: 'Invalid birth date.' });
      }
      profile.birth_date = birthDate || null;
    }

    try {
      const caller = factory(settings.url, settings.publicKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
      const { data: identity, error: identityError } = await caller.auth.getUser(authorization.slice(7));
      if (identityError || !identity.user) return reply(401, { error: 'Invalid session.' });
      const actor = identity.user.id;
      const { data: membership, error: accessError } = await caller.from('band_members').select('roles, active').eq('band_id', bandId).eq('user_id', actor).maybeSingle();
      if (accessError) return reply(503, { error: 'Could not verify workspace access.' });
      if (membership?.active !== true || !membership.roles.some((role: string) => ['owner', 'admin'].includes(role))) return reply(403, { error: 'Active administrator access required.' });
      const server = factory(settings.url, settings.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
      if (action === 'list') {
        const { data, error } = await server.rpc('list_workspace_members', { target_band: bandId, actor, page_start: offset });
        if (error) return reply(error.code === '42501' ? 403 : 503, { error: 'Could not list members.' });
        return reply(200, { members: data, has_more: data.length === 50 });
      }
      if (action === 'update') {
        let targetEmail: string;
        let targetUser = body.user_id;
        let accountCreated = false;
        if (username) {
          const { data: reservedEmail, error: usernameError } = await server.rpc('resolve_workspace_login', { login_username: username });
          if (usernameError) return reply(503, { error: 'Could not verify the username. Apply the member-username migration.' });
          if (reservedEmail && reservedEmail !== email && body.email !== undefined) return reply(409, { error: 'This username is already in use.' });
          const { data: available, error: availabilityError } = await server.rpc('workspace_username_available', { target_username: username, target_profile: body.profile_id ?? null });
          if (availabilityError) return reply(503, { error: 'Could not verify username availability.' });
          if (!available) return reply(409, { error: 'This username is already in use.' });
        }
        if (body.user_id) {
          const { data: target, error: targetError } = await server.from('band_members').select('roles').eq('band_id', bandId).eq('user_id', body.user_id).maybeSingle();
          if (targetError) return reply(503, { error: 'Could not verify the member.' });
          if (!target) return reply(404, { error: 'Member not found in this band.' });
          if (body.password && body.user_id !== actor && target.roles.some((role: string) => ['owner', 'admin'].includes(role)) && !membership.roles.includes('owner')) return reply(403, { error: 'Only an owner can change another administrator password.' });
          const { data: account, error: accountError } = await server.auth.admin.getUserById(body.user_id);
          if (accountError || !account.user?.email) return reply(503, { error: 'Could not resolve the member account.' });
          targetEmail = account.user.email;
          if (body.profile_id) {
            const { data: targetProfile, error: profileLookupError } = await server.from('member_profiles').select('email, user_id').eq('band_id', bandId).eq('id', body.profile_id).maybeSingle();
            if (profileLookupError) return reply(503, { error: 'Could not verify the member profile.' });
            if (!targetProfile || (targetProfile.user_id ? targetProfile.user_id !== body.user_id : targetProfile.email !== targetEmail)) return reply(409, { error: 'The profile does not belong to this member and band. Refresh the list.' });
          }
          const { error: rolesError } = await server.rpc('set_workspace_member_roles', { target_band: bandId, target_user: body.user_id, actor, new_roles: body.roles });
          if (rolesError) return reply(rolesError.code === '42501' ? 403 : 503, { error: rolesError.code === 'PGRST202' ? 'Aplique a migração de funções de membros no Supabase.' : 'Could not save member roles. Check owner and administrator access restrictions.' });
        } else {
          const { data: target, error: targetError } = await server.from('member_profiles').select('email, user_id').eq('band_id', bandId).eq('id', body.profile_id).maybeSingle();
          if (targetError) return reply(503, { error: 'Could not verify the member profile.' });
          if (!target) return reply(404, { error: 'Member profile not found in this band.' });
          if (target.user_id) return reply(409, { error: 'This member now has an account. Refresh the list before editing.' });
          const { data: matches, error: lookupError } = await server.rpc('find_invite_user', { target_email: target.email });
          if (lookupError) return reply(503, { error: 'Could not verify account settings.' });
          if (matches.length) return reply(409, { error: 'This profile now has an account. Refresh the member list before editing.' });
          targetEmail = email || target.email;
          if (body.password) {
            if (body.roles.includes('owner') && !membership.roles.includes('owner')) return reply(403, { error: 'Only an owner can grant owner access.' });
            const { data: claimed, error: limitError } = await server.rpc('claim_member_invite', { target_band: bandId, actor });
            if (limitError || !claimed) return reply(429, { error: 'Wait 60 seconds before creating another account.' });
            const { data: created, error: createError } = await server.auth.admin.createUser({ email: targetEmail, password: body.password, email_confirm: true });
            if (createError || !created.user) return reply(502, { error: 'Account could not be created. Check the email and password policy.' });
            targetUser = created.user.id;
            accountCreated = true;
            const { error: provisionError } = await server.rpc('provision_workspace_member', { target_band: bandId, target_user: targetUser, actor, new_roles: body.roles });
            if (provisionError) return reply(503, { error: 'Account created, but band access could not be saved. No new band access was granted.' });
          }
        }
        const profileRoles = body.user_id ? {} : { roles: [...new Set(body.roles)] };
        const identityFields = body.username === undefined ? {} : { username, user_id: targetUser };
        const { error: profileError } = await server.from('member_profiles').upsert({ ...profile, ...profileRoles, ...identityFields, ...(body.profile_id ? { id: body.profile_id } : {}), email: targetEmail, band_id: bandId }, { onConflict: body.profile_id ? 'id' : 'band_id,email' });
        if (profileError?.code === '23505') return reply(409, { error: 'This username or email is already in use. Any earlier account or role changes were kept; refresh the list before retrying.' });
        if (profileError) return reply(503, { error: body.user_id ? 'Roles saved, but profile details could not be saved. The password was not changed. Retry saving.' : 'Could not save the member profile and role tags. Apply the profile-role migration and retry.' });
        if (body.password && !accountCreated) {
          const { error: passwordError } = await server.auth.admin.updateUserById(targetUser, { password: body.password, email_confirm: true });
          if (passwordError) return reply(502, { error: 'Profile and roles saved, but the password could not be changed. Check the password policy and retry.' });
        }
        return reply(200, { updated: true });
      }
      const { data: claimed, error: limitError } = await server.rpc('claim_member_invite', { target_band: bandId, actor });
      if (limitError) return reply(limitError.code === '42501' ? 403 : 503, { error: 'Could not verify member creation limit.' });
      if (!claimed) return reply(429, { error: 'Wait 60 seconds before adding another member.' });
      if (username) {
        const { data: reservedEmail, error: usernameError } = await server.rpc('resolve_workspace_login', { login_username: username });
        if (usernameError) return reply(503, { error: 'Could not verify the username.' });
        if (reservedEmail && reservedEmail !== email) return reply(409, { error: 'This username is already in use.' });
        const { data: available, error: availabilityError } = await server.rpc('workspace_username_available', { target_username: username, target_profile: null });
        if (availabilityError) return reply(503, { error: 'Could not verify username availability.' });
        if (!available) return reply(409, { error: 'This username is already in use.' });
      }
      const { data: matches, error: lookupError } = await server.rpc('find_invite_user', { target_email: email });
      if (lookupError || matches.length > 1) return reply(503, { error: 'Could not resolve the member account.' });
      let userId = matches[0]?.user_id;
      if (userId && !matches[0].confirmed) return reply(409, { error: 'This existing account is unconfirmed. Complete its password setup in Supabase Authentication before approving it.' });
      const accountCreated = !userId;
      if (!userId) {
        const { data: created, error: createError } = await server.auth.admin.createUser({ email, password: body.password, email_confirm: true });
        if (createError || !created.user) return reply(502, { error: 'Account could not be created. Check the password policy and retry after 60 seconds.' });
        userId = created.user.id;
      }
      const { error: approvalError } = await server.rpc('approve_music_member', { target_band: bandId, target_user: userId, actor });
      if (approvalError) return reply(approvalError.code === '42501' ? 403 : 503, { error: 'Account resolved, but workspace approval failed. Retry after 60 seconds; no new workspace access was granted.' });
      if (profile) {
        const suppliedFields = Object.fromEntries(Object.entries(profile).filter(([, value]) => value !== '' && value !== null));
        const identityFields = body.username === undefined ? {} : { username, user_id: userId };
        const { error: profileError } = await server.from('member_profiles').upsert({ ...suppliedFields, ...identityFields, email, band_id: bandId }, { onConflict: 'band_id,email' });
        if (profileError) return reply(503, { error: 'Member access was approved, but profile details could not be saved. Retry after 60 seconds.' });
      }
      return reply(200, { approved: true, account_created: accountCreated });
    } catch { return reply(503, { error: 'Member service unavailable. Try again later.' }); }
  };
}