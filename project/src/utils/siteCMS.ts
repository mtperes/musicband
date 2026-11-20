import { supabase } from './supabase';
import { mapSiteAssets, validateSiteContent, type SiteAsset, type SiteContent } from './siteContent';
import { youtubeVideoId } from './youtube';

export type SiteRecord = { draft: SiteContent; published: SiteContent | null; revision: number; published_at: string | null; contact_usernames?: string[] };

export function recipientUsernames(value: string): string[] {
  const names = [...new Set(value.trim().toLowerCase().split(/[\s,;]+/).filter(Boolean).map(name => name.replace(/^@/, '')))];
  if (names.length > 30 || names.some(name => !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(name))) throw new Error('Indique até 30 nomes de utilizador válidos, separados por vírgulas.');
  return names;
}

export async function loadSiteDraft(bandId: string): Promise<SiteRecord | null> {
  if (!supabase) throw new Error('Supabase indisponível.');
  const { data, error } = await supabase.from('band_site_settings').select('draft,published,revision,published_at,contact_usernames').eq('band_id', bandId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) validateSiteContent(data.draft);
  return data as SiteRecord | null;
}

export async function uploadSiteAsset(bandId: string, file: File, video = false): Promise<SiteAsset> {
  if (!supabase) throw new Error('Supabase indisponível.');
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'video/mp4': 'mp4', 'video/webm': 'webm' };
  if (!extensions[file.type] || (video ? !file.type.startsWith('video/') && !file.type.startsWith('image/') : !file.type.startsWith('image/'))) throw new Error('Formato inválido. Use JPG, PNG, WebP ou AVIF; vídeos MP4 ou WebM.');
  const limit = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
  if (!file.size || file.size > limit) throw new Error('Limite: imagens 10 MB; vídeos 100 MB.');
  const path = `${bandId}/${crypto.randomUUID()}.${extensions[file.type]}`;
  const { error } = await supabase.storage.from('band-site-drafts').upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message);
  return { bucket: 'band-site-drafts', path, url: `/draft/${path}`, alt: file.name.replace(/\.[^.]+$/, '') };
}

export async function draftAssetUrls(content: SiteContent): Promise<Record<string, string>> {
  if (!supabase) return {};
  const paths = new Set<string>();
  mapSiteAssets(content, asset => { if (asset.bucket === 'band-site-drafts' && asset.path) paths.add(asset.path); return asset; });
  if (!paths.size) return {};
  const { data, error } = await supabase.storage.from('band-site-drafts').createSignedUrls([...paths], 3600);
  if (error) throw new Error(error.message);
  const urls: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.error || !item.signedUrl || !item.path) throw new Error(item.error ?? 'Pré-visualização indisponível.');
    urls[item.path] = item.signedUrl;
  }
  return urls;
}

export async function saveSiteContent(bandId: string, content: SiteContent, revision: number, publish: boolean, recipients = ''): Promise<SiteRecord> {
  const client = supabase;
  if (!client) throw new Error('Supabase indisponível.');
  validateSiteContent(content);
  const usernames = recipientUsernames(recipients);
  let saving = content.videos ? { ...content, videos: { ...content.videos, links: content.videos.links.map(link => `https://www.youtube.com/watch?v=${youtubeVideoId(link)}`) } } : content;
  if (publish) {
    const drafts = new Set<string>();
    mapSiteAssets(content, asset => { if (asset.bucket === 'band-site-drafts' && asset.path) drafts.add(asset.path); return asset; });
    for (const path of drafts) {
      if (!path.startsWith(`${bandId}/`)) throw new Error('O ficheiro não pertence a esta banda.');
      const { error } = await client.storage.from('band-site-drafts').copy(path, path, { destinationBucket: 'band-site-media' });
      if (error && !['409', 'Duplicate', 'ResourceAlreadyExists'].includes(String(error.name)) && !('statusCode' in error && String(error.statusCode) === '409')) throw new Error(error.message);
    }
    saving = mapSiteAssets(saving, asset => asset.bucket === 'band-site-drafts' && asset.path
      ? { ...asset, bucket: 'band-site-media', url: client.storage.from('band-site-media').getPublicUrl(asset.path).data.publicUrl }
      : asset);
  }
  const { data, error } = await client.rpc('save_band_site', { target_band: bandId, content: saving, expected_revision: revision, publish, recipient_usernames: usernames });
  if (error) throw new Error(error.code === '40001' ? 'O site foi alterado noutra sessão. Recarregue antes de guardar.' : error.message);
  if (!data) throw new Error('Não foi possível confirmar a gravação.');
  return data as SiteRecord;
}