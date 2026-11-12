import { createClient } from '@supabase/supabase-js';

const email = 'mt.peresn@gmail.com';
const url = process.env.SUPABASE_URL ?? process.env.SUPABASE_PUBLIC_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const password = process.env.WORKSPACE_ADMIN_PASSWORD ?? (process.argv.includes('--test') ? 'admin123' : undefined);

async function setupAdmin() {
  if (!url || !key) throw new Error('Set SUPABASE_URL and a server-only SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  if (!password || password.length < 8 || password.length > 128) throw new Error('Set WORKSPACE_ADMIN_PASSWORD (8-128 characters), or use --test for a testing account only.');
  const server = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  let existing;
  for (let page = 1; ; page += 1) {
    const { data, error } = await server.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not look up the administrator: ${error.message}`);
    existing = data.users.find((user) => user.email?.toLowerCase() === email);
    if (existing || data.users.length < 1000) break;
  }
  const { data, error } = existing
    ? await server.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    : await server.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Could not set the administrator password: ${error?.message ?? 'Account unavailable'}`);
  console.log('Administrator password configured. Checking band permissions...');
  const { data: band, error: bandError } = await server.from('bands').select('id').eq('slug', 'sardinhas-nomades').single();
  if (bandError) throw new Error(`Password configured, but band lookup failed (${bandError.code ?? 'unknown'}): ${bandError.message}. Apply the music migrations and rerun setup.`);
  if (!band) throw new Error('Password configured, but band unavailable. Apply the music migrations and rerun setup.');
  const { data: membership, error: lookupError } = await server.from('band_members').select('roles').eq('band_id', band.id).eq('user_id', data.user.id).maybeSingle();
  if (lookupError) throw new Error('Password configured, but membership lookup failed. Rerun after checking the database.');
  const roles = [...new Set([...(membership?.roles ?? []), 'admin'])];
  const { error: approvalError } = await server.from('band_members').upsert({ band_id: band.id, user_id: data.user.id, roles }, { onConflict: 'band_id,user_id' });
  if (approvalError) throw new Error('Password configured, but administrator approval failed. Rerun after checking the database.');
  console.log('Administrator ready. Username: admin. Existing account ID and roles preserved.');
}

setupAdmin().catch((error) => { console.error(error.message); process.exitCode = 1; });