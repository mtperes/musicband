export function youtubeVideoId(value: string): string {
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw new Error('Indique uma ligação válida do YouTube.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('Indique uma ligação válida do YouTube.');
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (host === 'youtu.be' && segments.length === 1) id = segments[0];
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (segments.length === 2 && ['embed', 'shorts', 'live'].includes(segments[0])) id = segments[1];
  }
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('Use uma ligação de vídeo do YouTube, não um canal ou uma playlist.');
  return id;
}