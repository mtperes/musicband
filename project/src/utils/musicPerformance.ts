export type MusicSheet = {
  id: string;
  band_id: string;
  song_id: string | null;
  title: string;
  instrument: string;
  file_name: string;
  file_size: number;
  storage_path: string;
  created_at: string;
};

export type PerformanceEntry = { songId: string; position: number; title: string };

export function findSongSheet(sheets: MusicSheet[], bandId: string, songId: string, instrument: string) {
  return sheets.find((sheet) => sheet.band_id === bandId && sheet.song_id === songId
    && sheet.instrument.trim().toLocaleLowerCase() === instrument.trim().toLocaleLowerCase());
}

export function googleDrivePreviewUrl(source: string | undefined) {
  if (!source) return null;
  try {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.port || url.username || url.password) return null;
    const file = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/(?:view|preview|edit))?\/?$/);
    const id = file?.[1] ?? (['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : null);
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;
    const preview = new URL(`https://drive.google.com/file/d/${id}/preview`);
    const resourceKey = url.searchParams.get('resourcekey');
    if (resourceKey) preview.searchParams.set('resourcekey', resourceKey);
    return preview.toString();
  } catch { return null; }
}

export function readPerformanceProgress(raw: string | null, entries: PerformanceEntry[], instruments: string[]) {
  const fallback = { index: 0, instrument: instruments[0] ?? '' };
  if (!raw || raw.length > 2048) return fallback;
  try {
    const saved: unknown = JSON.parse(raw);
    if (!saved || typeof saved !== 'object' || !('version' in saved) || saved.version !== 1) return fallback;
    const progress = saved as { songId?: unknown; position?: unknown; instrument?: unknown };
    const exact = entries.findIndex((entry) => entry.songId === progress.songId && entry.position === progress.position);
    const moved = entries.findIndex((entry) => entry.songId === progress.songId);
    return {
      index: exact >= 0 ? exact : Math.max(0, moved),
      instrument: typeof progress.instrument === 'string' && instruments.includes(progress.instrument) ? progress.instrument : fallback.instrument,
    };
  } catch { return fallback; }
}