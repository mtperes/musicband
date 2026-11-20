import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const url = process.env.SUPABASE_URL ?? process.env.SUPABASE_PUBLIC_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
const slug = process.env.BAND_SLUG ?? 'sardinhas-nomades';

async function importAssets() {
  if (!url || !key) throw new Error('A server-only Supabase credential and URL are required.');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: band, error: bandError } = await client.from('bands').select('id').eq('slug', slug).single();
  if (bandError || !band) throw new Error(`Band lookup failed: ${bandError?.message ?? 'Band not found'}`);
  const { data: existing, error: lookupError } = await client.from('band_site_settings').select('revision').eq('band_id', band.id).maybeSingle();
  if (lookupError) throw new Error(`Apply the CMS migration first: ${lookupError.message}`);
  if (existing) { console.log('CMS configuration already exists. Existing drafts and published content were not changed.'); return; }
  const content = JSON.parse(await readFile(new URL('../src/utils/siteDefaults.json', import.meta.url), 'utf8'));
  const imported = new Map();
  const mimeTypes = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm' };
  async function upload(asset) {
    if (!asset) return null;
    const reference = asset.url;
    if (imported.has(reference)) return { ...imported.get(reference), alt: asset.alt };
    if (!reference.startsWith('/') || reference.includes('..')) throw new Error('Only local website assets may be imported.');
    const local = reference.startsWith('/src/') ? resolve(root, reference.slice(1)) : resolve(root, 'public', reference.slice(1));
    if (relative(root, local).startsWith(`..${sep}`)) throw new Error('Asset path must stay inside the project.');
    const bytes = await readFile(local);
    const extension = reference.slice(reference.lastIndexOf('.')).toLowerCase();
    if (!mimeTypes[extension]) throw new Error(`Unsupported asset: ${reference}`);
    const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 24);
    const path = `${band.id}/${hash}${extension}`;
    const bucket = client.storage.from('band-site-media');
    const { error } = await bucket.upload(path, bytes, { contentType: mimeTypes[extension], cacheControl: '31536000', upsert: false });
    if (error && !('statusCode' in error && String(error.statusCode) === '409')) throw new Error(`Upload failed for ${reference}: ${error.message}`);
    const uploaded = { ...asset, bucket: 'band-site-media', path, url: bucket.getPublicUrl(path).data.publicUrl };
    const response = await fetch(uploaded.url, { method: 'HEAD' });
    if (!response.ok) throw new Error(`Uploaded file is not publicly readable: ${reference} (${response.status})`);
    imported.set(reference, uploaded);
    console.log(`Imported ${reference} (${bytes.length} bytes)`);
    return uploaded;
  }
  for (const field of ['logo', 'headingStart', 'headingEnd', 'backgroundImage', 'backgroundVideo']) content.identity[field] = await upload(content.identity[field]);
  for (const section of Object.values(content.sections)) {
    const media = [];
    for (const asset of section.media) media.push(await upload(asset));
    section.media = media;
  }
  for (const event of content.events) event.image = await upload(event.image);
  const { error: insertError } = await client.from('band_site_settings').insert({ band_id: band.id, draft: content, published: content, published_at: new Date().toISOString() });
  if (insertError) throw new Error(`Files imported, but initial configuration failed: ${insertError.message}`);
  console.log(`CMS initialized for ${slug}; ${imported.size} assets imported. Existing source files were kept as fallback.`);
}

importAssets().catch(error => { console.error(error.message); process.exitCode = 1; });