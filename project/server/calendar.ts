import type { IncomingMessage, ServerResponse } from 'node:http';
import { defaultCalendarUrl, publicCalendarUrl } from '../src/utils/calendarSource.ts';

export function createCalendarHandler(fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const error = (status: number, message: string) => new Response(message, { status, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });
    if (request.method !== 'GET') return error(405, 'Method not allowed');
    let source: string;
    try { source = publicCalendarUrl(new URL(request.url).searchParams.get('source') ?? defaultCalendarUrl); }
    catch { return error(400, 'A public Google Calendar iCal address is required.'); }
    try {
      const upstream = await fetcher(source, { headers: { Accept: 'text/calendar' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!upstream.ok || !upstream.body) return error(502, 'Calendar unavailable. Check that the calendar is public.');
      const reader = upstream.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 2 * 1024 * 1024) { await reader.cancel(); return error(502, 'Calendar feed is too large.'); }
        chunks.push(chunk.value);
      }
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) return error(502, 'Invalid calendar feed.');
      return new Response(text, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
    } catch {
      console.error('Public calendar proxy unavailable');
      return error(502, 'Calendar unavailable.');
    }
  };
}

export function createNodeCalendarHandler() {
  const handle = createCalendarHandler();
  return async (request: IncomingMessage, response: ServerResponse) => {
    const result = await handle(new Request(`http://${request.headers.host ?? 'localhost'}${request.url ?? '/api/calendar'}`, { method: request.method }));
    response.writeHead(result.status, Object.fromEntries(result.headers));
    response.end(await result.text());
  };
}