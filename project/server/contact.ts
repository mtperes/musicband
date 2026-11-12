import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

type Mail = { from: string; to: string[]; bcc?: string[]; replyTo: string; subject: string; text: string };
type Settings = { apiKey: string; domain: string; supabaseUrl: string; supabaseKey: string; testMode: boolean };
type Dependencies = {
  send: (mail: Mail) => Promise<{ id?: string; error?: string }>;
  recipients: () => Promise<string[]>;
  claim: (key: string) => Promise<boolean>;
};
const adminEmail = 'mt.peresn@gmail.com';
const maxBody = 8192;

export function contactSettings(env: Record<string, string | undefined>, testMode = false): Settings {
  return {
    apiKey: env.RESEND_API_KEY ?? '', domain: env.RESEND_EMAIL_DOMAIN ?? '',
    supabaseUrl: env.SUPABASE_URL ?? env.SUPABASE_PUBLIC_URL ?? env.VITE_SUPABASE_URL ?? '',
    supabaseKey: env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? '', testMode,
  };
}

export function createContactHandler(settings: Settings, injected?: Dependencies) {
  const recentTests = new Map<string, number>();
  const resend = settings.apiKey ? new Resend(settings.apiKey) : null;
  const database = settings.supabaseUrl && settings.supabaseKey
    ? createClient(settings.supabaseUrl, settings.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  const dependencies: Dependencies = injected ?? {
    async send(mail) {
      if (!resend) return { error: 'Email service unavailable' };
      const { data, error } = await resend.emails.send(mail);
      if (error) console.error('Contact email rejected', { type: error.name });
      return error ? { error: error.message } : { id: data?.id };
    },
    async recipients() {
      if (!database) throw new Error('Database unavailable');
      const { data, error } = await database.rpc('contact_email_recipients');
      if (error) throw new Error('Recipient lookup unavailable');
      return (data ?? []).map((row: { email: string }) => row.email);
    },
    async claim(key) {
      if (settings.testMode) {
        const now = Date.now();
        for (const [entry, time] of recentTests) if (now - time >= 60000) recentTests.delete(entry);
        if (recentTests.has(key) || recentTests.size >= 100) return false;
        recentTests.set(key, now);
        return true;
      }
      if (!database) throw new Error('Database unavailable');
      const { data, error } = await database.rpc('claim_contact_email', { client_key: key });
      if (error) throw new Error('Rate limit unavailable');
      return data === true;
    },
  };
  return async (request: Request): Promise<Response> => {
    const reply = (status: number, body: object) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
    if (request.method !== 'POST') return reply(405, { error: 'Pedido não permitido.' });
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) return reply(403, { error: 'Origem não permitida.' });
    if (!request.headers.get('content-type')?.startsWith('application/json')) return reply(415, { error: 'Formato de mensagem inválido.' });
    let body;
    try {
      const text = await request.text();
      if (Buffer.byteLength(text) > maxBody) return reply(413, { error: 'A mensagem é demasiado longa.' });
      body = JSON.parse(text);
    } catch { return reply(400, { error: 'Mensagem inválida.' }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { error: 'Mensagem inválida.' });
    if (body.website) return reply(400, { error: 'Mensagem inválida.' });
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!name || name.length > 160 || /[\r\n]/.test(name) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message || message.length > 4000) {
      return reply(400, { error: 'Verifique o nome, email e mensagem.' });
    }
    if (!settings.apiKey || (!settings.testMode && (!settings.domain || !settings.supabaseUrl || !settings.supabaseKey))) {
      return reply(503, { error: 'O serviço de email está temporariamente indisponível.' });
    }
    try {
      const key = createHash('sha256').update(`${settings.apiKey}:${email}`).digest('hex');
      if (!await dependencies.claim(key)) return reply(429, { error: 'Aguarde um minuto antes de enviar outra mensagem.' });
      const recipients = settings.testMode ? [] : await dependencies.recipients();
      const bcc = [...new Set(recipients.map((recipient) => recipient.trim().toLowerCase()))]
        .filter((recipient) => recipient !== adminEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) && !recipient.endsWith('.invalid'));
      const result = await dependencies.send({
        from: `Sardinhas Nômades <${settings.testMode ? 'onboarding@resend.dev' : `contato@${settings.domain}`}>`,
        to: [adminEmail], ...(bcc.length ? { bcc } : {}), replyTo: email,
        subject: `Contato pelo site: ${name}`,
        text: `Nome: ${name}\nEmail: ${email}\n\n${message}`,
      });
      if (result.error || !result.id) return reply(502, { error: 'Não foi possível enviar a mensagem. O remetente precisa de estar autorizado pelo serviço de email. Tente novamente mais tarde.' });
      return reply(200, { sent: true });
    } catch {
      console.error('Contact email service unavailable');
      return reply(503, { error: 'Não foi possível enviar a mensagem. Tente novamente mais tarde.' });
    }
  };
}

export function createNodeContactHandler(settings: Settings) {
  const handle = createContactHandler(settings);
  return async (request: IncomingMessage & { body?: unknown }, response: ServerResponse) => {
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      if (request.body !== undefined) {
        const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
        chunks.push(Buffer.from(body));
        size = Buffer.byteLength(body);
      } else {
        for await (const chunk of request) {
          const bytes = Buffer.from(chunk);
          size += bytes.length;
          if (size > maxBody) break;
          chunks.push(bytes);
        }
      }
      if (size > maxBody) {
        response.writeHead(413, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify({ error: 'A mensagem é demasiado longa.' }));
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
      const protocol = request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const result = await handle(new Request(`${protocol}://${request.headers.host ?? 'localhost'}/api/contact`, {
        method: request.method, headers, ...(request.method !== 'GET' && request.method !== 'HEAD' ? { body: Buffer.concat(chunks).toString('utf8') } : {}),
      }));
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(await result.text());
    } catch {
      response.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ error: 'Não foi possível enviar a mensagem.' }));
    }
  };
}