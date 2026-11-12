import assert from 'node:assert/strict';
import test from 'node:test';
import { createContactHandler } from '../server/contact.ts';

const settings = { apiKey: 'test-key', domain: 'notifications.example.com', supabaseUrl: 'https://example.supabase.co', supabaseKey: 'server-test', testMode: false };
const valid = { name: 'Visitor', email: 'visitor@example.com', message: 'A booking enquiry.' };
const request = (body: object) => new Request('https://band.example/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://band.example' }, body: JSON.stringify(body) });

test('contact email uses fixed owner and private role recipients, never visitor-supplied destinations', async () => {
  let captured;
  const handler = createContactHandler(settings, {
    send: async (mail) => { captured = mail; return { id: 'sent' }; },
    recipients: async () => ['member@example.com', 'MEMBER@EXAMPLE.COM', 'mt.peresn@gmail.com', 'user@members.sardinhas-nomades.invalid'],
    claim: async () => true,
  });
  const response = await handler(request({ ...valid, to: ['attacker@example.com'] }));
  assert.equal(response.status, 200);
  assert.deepEqual(captured?.to, ['mt.peresn@gmail.com']);
  assert.deepEqual(captured?.bcc, ['member@example.com']);
  assert.equal(captured?.replyTo, valid.email);
  assert.deepEqual(await response.json(), { sent: true });
});
test('local testing sends only to owner with provider test sender', async () => {
  let captured;
  const handler = createContactHandler({ ...settings, testMode: true }, {
    send: async (mail) => { captured = mail; return { id: 'sent' }; },
    recipients: async () => { throw new Error('Role recipients must not run in test mode'); }, claim: async () => true,
  });
  assert.equal((await handler(request(valid))).status, 200);
  assert.match(captured?.from ?? '', /onboarding@resend.dev/);
  assert.equal(captured?.bcc, undefined);
});
test('provider rejection is not reported as sent', async () => {
  const handler = createContactHandler(settings, { send: async () => ({ error: 'Domain unverified' }), recipients: async () => [], claim: async () => true });
  const response = await handler(request(valid));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).sent, undefined);
});
test('validation, honeypot and rate limit block sending', async () => {
  let sends = 0;
  const handler = createContactHandler(settings, { send: async () => { sends++; return { id: 'sent' }; }, recipients: async () => [], claim: async () => false });
  for (const body of [{ ...valid, name: '' }, { ...valid, email: 'invalid' }, { ...valid, message: 'x'.repeat(4001) }, { ...valid, website: 'spam' }]) assert.equal((await handler(request(body))).status, 400);
  assert.equal((await handler(request(valid))).status, 429);
  assert.equal(sends, 0);
});
test('other origins and unavailable service are rejected', async () => {
  const handler = createContactHandler({ ...settings, apiKey: '' });
  const foreign = new Request(request(valid), { headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' } });
  assert.equal((await handler(foreign)).status, 403);
  assert.equal((await handler(request(valid))).status, 503);
});