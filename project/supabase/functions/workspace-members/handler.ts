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
    if (size > 4096) { await reader.cancel(); throw new Error('Body too large'); }
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
    if (!settings.url || !settings.publicKey || !settings.secretKey || !settings.siteUrl || !settings.origins.length) return reply(503, { error: 'Member service is not configured.' });
    const authorization = request.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) return reply(401, { error: 'Authentication required.' });
    let body;
    try { body = await readBody(request); }
    catch { return reply(400, { error: 'Invalid request body.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Invalid request.' });
    const { action, band_id: bandId } = body;
    const offset = body.offset ?? 0;
    if (!['list', 'invite'].includes(action) || typeof bandId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bandId)
      || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return reply(400, { error: 'Invalid action, workspace or offset.' });
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (action === 'invite' && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || body.roles !== undefined)) return reply(400, { error: 'Provide a valid email; invitations grant musician access only.' });

    try {
      const caller = factory(settings.url, settings.publicKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
      const { data: identity, error: identityError } = await caller.auth.getUser(authorization.slice(7));
      if (identityError || !identity.user) return reply(401, { error: 'Invalid session.' });
      const actor = identity.user.id;
      const { data: membership, error: accessError } = await caller.from('band_members').select('roles').eq('band_id', bandId).eq('user_id', actor).maybeSingle();
      if (accessError) return reply(503, { error: 'Could not verify workspace access.' });
      if (!membership?.roles.some((role: string) => ['owner', 'admin'].includes(role))) return reply(403, { error: 'Administrator access required.' });
      const server = factory(settings.url, settings.secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
      if (action === 'list') {
        const { data, error } = await server.rpc('list_workspace_members', { target_band: bandId, actor, page_start: offset });
        if (error) return reply(error.code === '42501' ? 403 : 503, { error: 'Could not list members.' });
        return reply(200, { members: data, has_more: data.length === 50 });
      }
      const { data: claimed, error: limitError } = await server.rpc('claim_member_invite', { target_band: bandId, actor });
      if (limitError) return reply(limitError.code === '42501' ? 403 : 503, { error: 'Could not verify invitation limit.' });
      if (!claimed) return reply(429, { error: 'Wait 60 seconds before inviting another member.' });
      const { data: matches, error: lookupError } = await server.rpc('find_invite_user', { target_email: email });
      if (lookupError || matches.length > 1) return reply(503, { error: 'Could not resolve the invited account.' });
      let userId = matches[0]?.user_id;
      let emailed = false;
      if (!userId || !matches[0].confirmed) {
        const { data: invited, error: inviteError } = await server.auth.admin.inviteUserByEmail(email, { redirectTo: `${settings.siteUrl.replace(/\/$/, '')}/auth/confirm?next=music` });
        if (inviteError || !invited.user) return reply(502, { error: 'Invitation could not be sent. Check SMTP configuration and retry after 60 seconds.' });
        userId = invited.user.id;
        emailed = true;
      }
      const { error: approvalError } = await server.rpc('approve_music_member', { target_band: bandId, target_user: userId, actor });
      if (approvalError) return reply(approvalError.code === '42501' ? 403 : 503, { error: 'Account resolved, but workspace approval failed. Retry after 60 seconds; no new workspace access was granted.' });
      return reply(200, { approved: true, invitation_sent: emailed });
    } catch { return reply(503, { error: 'Member service unavailable. Try again later.' }); }
  };
}