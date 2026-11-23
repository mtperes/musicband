import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import siteDefaults from '../src/utils/siteDefaults.json' with { type: 'json' };

const mockModule = `
const session = { user: { id: 'admin', email: 'admin@example.com' } };
const members = [
  { user_id: 'member', profile_id: 'profile', email: 'member@example.com', name: 'Ana', phone: '12345', roles: ['musician'], active: true, confirmed: true, last_sign_in_at: '2026-11-18T14:30:00.000Z' },
  { user_id: null, profile_id: 'no-account', email: 'profile@example.com', name: 'Bruno', roles: [], active: false, confirmed: false },
];
globalThis.__memberTest = { commands: [], fail: false };
export const supabase = {
  auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session } }) },
  from() {
    const query = { select() { return query; }, eq() { return query; },
      then(resolve) { return Promise.resolve({ data: [{ band_id: 'band', roles: ['owner'], active: true, bands: { name: 'Test Band' } }], error: null }).then(resolve); }
    }; return query;
  },
  async rpc() { return { data: { members: members.map(member => ({ ...member })), has_more: false }, error: null }; },
  functions: { async invoke(name, { body }) {
    globalThis.__memberTest.commands.push(body);
    if (globalThis.__memberTest.fail) return { data: null, error: { context: new Response(JSON.stringify({ error: 'Test save failure' })) } };
    const member = members.find(member => body.user_id ? member.user_id === body.user_id : member.profile_id === body.profile_id);
    Object.assign(member, body.profile, { roles: body.roles, username: body.username, email: body.email });
    return { data: { updated: true }, error: null };
  } },
};
`;

test.beforeEach(async ({ page }) => {
  await page.route('**/src/utils/supabase.ts*', (route) => route.fulfill({ contentType: 'application/javascript', body: mockModule }));
  await page.goto('/admin');
});

test('table edit opens a populated form and saves roles, profile and optional password', async ({ page }) => {
  const table = page.getByRole('table', { name: 'Membros aprovados' });
  await expect(table.getByRole('columnheader', { name: 'Funções' })).toHaveCount(0);
  await expect(table.getByRole('columnheader', { name: 'Último acesso' })).toBeVisible();
  const expectedLogin = await page.evaluate(() => new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date('2026-11-18T14:30:00.000Z')));
  await expect(table.getByRole('row').nth(1).getByRole('cell').nth(6)).toHaveText(expectedLogin);
  await expect(table.getByRole('row').nth(2).getByRole('cell').nth(6)).toHaveText('-');
  await page.getByRole('button', { name: 'Editar membro: Ana', exact: true }).click();
  const form = page.getByRole('form', { name: 'Editar membro' });
  await expect(form.getByLabel('Nome', { exact: true })).toHaveValue('Ana');
  await expect(form.getByLabel('Email', { exact: true })).toBeDisabled();
  await expect(form.getByLabel('Utilizador', { exact: true })).toBeEditable();
  await expect(form.getByLabel('Nova palavra-passe (opcional)')).toHaveValue('');
  await form.getByLabel('Produção', { exact: true }).check();
  await form.getByLabel('Nome', { exact: true }).fill('Ana Updated');
  await form.getByRole('button', { name: 'Cancelar' }).click();
  await expect(table.getByRole('button', { name: 'Editar membro: Ana', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __memberTest: { commands: unknown[] } }).__memberTest.commands.length)).toBe(0);

  await table.getByRole('button', { name: 'Editar membro: Ana', exact: true }).click();
  await expect(form.getByLabel('Produção', { exact: true })).not.toBeChecked();
  await form.getByLabel('Músico', { exact: true }).uncheck();
  await expect(form.getByRole('button', { name: 'Guardar alterações' })).toBeDisabled();
  await form.getByLabel('Músico', { exact: true }).check();
  await form.getByLabel('Produção', { exact: true }).check();
  await form.getByLabel('Nome', { exact: true }).fill('Ana Updated');
  await form.getByLabel('Telefone', { exact: true }).fill('');
  await form.getByLabel('Nova palavra-passe (opcional)').fill('test-password-123');
  await form.getByRole('button', { name: 'Guardar alterações' }).click();
  await expect(form).toHaveCount(0);
  await expect(table.getByRole('button', { name: 'Editar membro: Ana Updated', exact: true })).toBeVisible();
  const commands = await page.evaluate(() => (globalThis as unknown as { __memberTest: { commands: Record<string, unknown>[] } }).__memberTest.commands);
  expect(commands[0]).toMatchObject({ action: 'update', user_id: 'member', password: 'test-password-123', roles: ['musician', 'production'], profile: { name: 'Ana Updated', phone: '' } });

  await table.getByRole('button', { name: 'Editar membro: Ana Updated', exact: true }).click();
  await expect(form.getByLabel('Nova palavra-passe (opcional)')).toHaveValue('');
  await expect(form.getByLabel('Produção', { exact: true })).toBeChecked();
  await form.getByRole('button', { name: 'Guardar alterações' }).click();
  const lastPassword = await page.evaluate(() => (globalThis as unknown as { __memberTest: { commands: { password: string }[] } }).__memberTest.commands.at(-1)?.password);
  expect(lastPassword).toBe('');
});

test('every edit form supports multiple role tags, including profiles without accounts', async ({ page }) => {
  await page.getByRole('button', { name: 'Editar membro: Bruno', exact: true }).click();
  const form = page.getByRole('form', { name: 'Editar membro' });
  await expect(form.getByLabel('Nova palavra-passe (opcional)')).toHaveValue('');
  await expect(form.getByLabel('Email', { exact: true })).toBeEditable();
  await form.getByLabel('Utilizador', { exact: true }).fill('bruno');
  await expect(form.getByRole('group', { name: 'Funções' })).toBeVisible();
  await form.getByLabel('Músico', { exact: true }).check();
  await form.getByLabel('Produção', { exact: true }).check();
  await form.getByLabel('Nome', { exact: true }).fill('Bruno Updated');
  await page.evaluate(() => { (globalThis as unknown as { __memberTest: { fail: boolean } }).__memberTest.fail = true; });
  await form.getByRole('button', { name: 'Guardar alterações' }).click();
  await expect(page.getByRole('alert')).toHaveText('Test save failure');
  await expect(form.getByLabel('Nome', { exact: true })).toHaveValue('Bruno Updated');
  await expect(form.getByLabel('Músico', { exact: true })).toBeChecked();
  await expect(form.getByLabel('Produção', { exact: true })).toBeChecked();
  await page.evaluate(() => { (globalThis as unknown as { __memberTest: { fail: boolean } }).__memberTest.fail = false; });
  await form.getByRole('button', { name: 'Guardar alterações' }).click();
  await expect(page.getByRole('button', { name: 'Editar membro: Bruno Updated', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar membro: Bruno Updated', exact: true }).click();
  await expect(form.getByLabel('Músico', { exact: true })).toBeChecked();
  await expect(form.getByLabel('Produção', { exact: true })).toBeChecked();
  await form.getByLabel('Produção', { exact: true }).uncheck();
  await expect(form.getByLabel('Músico', { exact: true })).toBeChecked();
  await expect(form.getByLabel('Utilizador', { exact: true })).toHaveValue('bruno');
  await form.getByLabel('Visualização', { exact: true }).check();
});

for (const username of ['member.one', 'ADMIN']) {
test(`username ${username} signs in without requiring an email`, async ({ page }) => {
  await page.unrouteAll({ behavior: 'wait' });
  const loginModule = mockModule + `
    let onSession;
    supabase.auth.getSession = async () => ({ data: { session: null } });
    supabase.auth.onAuthStateChange = callback => { onSession = callback; return { data: { subscription: { unsubscribe() {} } } }; };
    supabase.auth.setSession = async tokens => { onSession('SIGNED_IN', session); return { error: null }; };
    supabase.functions.invoke = async (name, { body }) => { globalThis.__memberTest.commands.push(body); return { data: { session: { access_token: 'fixture-access', refresh_token: 'fixture-refresh' } }, error: null }; };
  `;
  await page.route('**/src/utils/supabase.ts*', route => route.fulfill({ contentType: 'application/javascript', body: loginModule }));
  await page.goto('/admin');
  await page.getByLabel('Utilizador', { exact: true }).fill('member@example.com');
  await page.getByLabel('Palavra-passe', { exact: true }).fill('test-password-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  expect(await page.getByLabel('Utilizador', { exact: true }).evaluate(input => (input as HTMLInputElement).validity.patternMismatch)).toBe(true);
  expect(await page.evaluate(() => (globalThis as unknown as { __memberTest: { commands: unknown[] } }).__memberTest.commands)).toEqual([]);
  await page.getByLabel('Utilizador', { exact: true }).fill(username);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Membros', exact: true })).toBeVisible();
  const commands = await page.evaluate(() => (globalThis as unknown as { __memberTest: { commands: Record<string, unknown>[] } }).__memberTest.commands);
  expect(commands).toEqual([{ action: 'sign_in', username: username.toLowerCase(), password: 'test-password-123' }]);
});
}

test.describe('website CMS', () => {
  test.beforeEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'wait' });
    const cmsMock = mockModule.replace("band_id: 'band'", "band_id: '11111111-1111-4111-8111-111111111111'") + `
      const initial = { draft: ${JSON.stringify(siteDefaults)}, published: ${JSON.stringify(siteDefaults)}, revision: 1, published_at: '2026-11-20T12:00:00Z' };
      let record = JSON.parse(localStorage.getItem('cms-test-record') ?? JSON.stringify(initial));
      const originalFrom = supabase.from;
      const originalRpc = supabase.rpc;
      globalThis.__cmsTest = { saves: [], uploads: [], copies: [], fail: false };
      supabase.from = table => table === 'band_site_settings' ? {
        select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: structuredClone(record), error: null })
      } : originalFrom(table);
      supabase.rpc = async (name, args) => {
        if (name === 'get_published_band_site') return { data: structuredClone(record.published), error: null };
        if (name !== 'save_band_site') return originalRpc(name, args);
        globalThis.__cmsTest.saves.push(args);
        if (globalThis.__cmsTest.fail) return { error: { message: 'CMS save failed' } };
        if (args.expected_revision !== record.revision) return { error: { code: '40001' } };
        record.draft = structuredClone(args.content); record.revision++;
        record.contact_usernames = args.recipient_usernames ?? [];
        if (args.publish) { record.published = structuredClone(args.content); record.published_at = new Date().toISOString(); }
        localStorage.setItem('cms-test-record', JSON.stringify(record));
        return { data: structuredClone(record), error: null };
      };
      supabase.storage = { from(bucket) { return {
        async upload(path, file) { globalThis.__cmsTest.uploads.push({ bucket, path, size: file.size }); return { error: null }; },
        async copy(source, destination, options) { globalThis.__cmsTest.copies.push({ bucket, source, destination, options }); return { error: null }; },
        async createSignedUrls(paths) { return { data: paths.map(path => ({ path, signedUrl: '/band/band1.png' })), error: null }; },
        getPublicUrl(path) { return { data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/' + bucket + '/' + path } }; }
      }; } };
    `;
    await page.route('**/src/utils/supabase.ts*', route => route.fulfill({ contentType: 'application/javascript', body: cmsMock }));
    await page.goto('/admin');
    await page.locator('.cms-heading').click();
    await expect(page.getByLabel('Nome da banda', { exact: true })).toHaveValue('Sardinhas Nômades');
  });

  test('prefills collapsible editors below members, saves drafts and publishes fonts and content', async ({ page }) => {
    const cms = page.locator('.site-cms');
    const belowMembers = await page.evaluate(() => document.querySelector('.site-cms')!.getBoundingClientRect().top >= document.querySelector('table')!.getBoundingClientRect().bottom);
    expect(belowMembers).toBe(true);
    await expect(cms.getByRole('img', { name: 'Pré-visualização do logo' })).toBeVisible();
    await cms.locator('summary').filter({ hasText: /^Tipografia$/ }).click();
    await cms.getByLabel('Fonte de títulos', { exact: true }).selectOption('Barrio');
    await cms.getByLabel('Cor de títulos', { exact: true }).fill('#ffcc00');
    await cms.locator('summary').filter({ hasText: /^Biografia$/ }).click();
    await expect(cms.getByLabel('Texto: O Cardume')).toHaveValue(siteDefaults.sections.bio.text);
    await cms.getByLabel('Texto: O Cardume').fill('Biografia CMS de teste.');
    await page.locator('.cms-heading').click();
    await page.locator('.cms-heading').click();
    await expect(cms.getByLabel('Texto: O Cardume')).toHaveValue('Biografia CMS de teste.');
    expect(await cms.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await cms.screenshot({ path: test.info().outputPath('cms-editor.png') });
    await cms.getByRole('button', { name: 'Guardar rascunho', exact: true }).click();
    await expect(cms.getByRole('status')).toHaveText('Rascunho guardado.');
    await page.goto('/');
    await expect(page.locator('#bio p')).toHaveText(siteDefaults.sections.bio.text);
    await expect(page.locator('#bio h2')).toContainText('O Cardume');
    await page.goto('/admin');
    await page.locator('.cms-heading').click();
    await page.locator('.cms-section > summary').filter({ hasText: /^Biografia$/ }).click();
    await expect(page.getByLabel('Texto: O Cardume')).toHaveValue('Biografia CMS de teste.');
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Site publicado.');
    await page.goto('/');
    await expect(page.locator('#bio p')).toHaveText('Biografia CMS de teste.');
    const typeface = await page.locator('#bio h2').evaluate(element => ({ font: getComputedStyle(element).fontFamily, color: getComputedStyle(element).color }));
    expect(typeface.font).toContain('Barrio');
    expect(typeface.color).toBe('rgb(255, 204, 0)');
  });

  test('uploads privately, preserves failed edits and copies assets only on publish', async ({ page }) => {
    const cms = page.locator('.site-cms');
    await expect(cms.getByLabel('Nome da banda')).toBeVisible();
    await cms.getByLabel('Nome da banda').fill('Banda editada');
    await page.evaluate(() => { (globalThis as unknown as { __cmsTest: { fail: boolean } }).__cmsTest.fail = true; });
    await cms.getByRole('button', { name: 'Guardar rascunho', exact: true }).click();
    await expect(cms.getByRole('alert')).toHaveText('CMS save failed');
    await expect(cms.getByLabel('Nome da banda')).toHaveValue('Banda editada');
    await page.evaluate(() => { (globalThis as unknown as { __cmsTest: { fail: boolean } }).__cmsTest.fail = false; });
    await cms.getByLabel('Carregar logo', { exact: true }).setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64') });
    await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __cmsTest: { uploads: unknown[] } }).__cmsTest.uploads.length)).toBe(1);
    await expect(cms.getByRole('button', { name: 'Guardar rascunho', exact: true })).toBeEnabled();
    await cms.getByRole('button', { name: 'Guardar rascunho', exact: true }).click();
    await expect(cms.getByRole('status')).toHaveText('Rascunho guardado.');
    expect(await page.evaluate(() => (globalThis as unknown as { __cmsTest: { copies: unknown[] } }).__cmsTest.copies.length)).toBe(0);
    await cms.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(cms.getByRole('status')).toHaveText('Site publicado.');
    const storage = await page.evaluate(() => (globalThis as unknown as { __cmsTest: { uploads: { bucket: string; path: string }[]; copies: { options: { destinationBucket: string } }[] } }).__cmsTest);
    expect(storage.uploads[0].bucket).toBe('band-site-drafts');
    expect(storage.uploads[0].path).toMatch(/^11111111-1111-4111-8111-111111111111\/[0-9a-f-]{36}\.png$/);
    expect(storage.copies[0].options.destinationBucket).toBe('band-site-media');
  });

  test('configures public calendar, optional title images and private forwarding usernames', async ({ page }) => {
    const cms = page.locator('.site-cms');
    await expect(cms.locator('.cms-logo-guidance')).toContainText('512 × 512');
    await cms.locator('summary').filter({ hasText: /^Imagens dos títulos$/ }).click();
    await cms.getByLabel('Imagens dos títulos visíveis').uncheck();
    await cms.locator('summary').filter({ hasText: /^Agenda$/ }).click();
    const calendar = 'https://calendar.google.com/calendar/ical/test%40group.calendar.google.com/public/basic.ics';
    await cms.getByLabel('Google Calendar: endereço público iCal').fill(calendar);
    await expect(cms.getByRole('link', { name: 'Ajuda do Google Calendar' })).toHaveAttribute('href', /support.google.com\/calendar/);
    await cms.locator('summary').filter({ hasText: /^Contato$/ }).click();
    await cms.getByLabel('Encaminhar mensagens para utilizadores').fill('admin, member.one');
    const overflow = await cms.evaluate(element => {
      const right = element.getBoundingClientRect().right;
      return [...element.querySelectorAll('*')].filter(child => child.getBoundingClientRect().right > right + 1).map(child => ({ tag: child.tagName, className: child.className, text: child.textContent?.slice(0, 60), width: child.getBoundingClientRect().width }));
    });
    expect(overflow).toEqual([]);
    await cms.screenshot({ path: test.info().outputPath('cms-refinements.png') });
    await cms.locator('.cms-logo-guidance').screenshot({ path: test.info().outputPath('cms-logo-guidance.png') });
    await cms.getByRole('button', { name: 'Guardar rascunho', exact: true }).click();
    await expect(cms.getByRole('status')).toHaveText('Rascunho guardado.');
    await expect(cms.getByLabel('Encaminhar mensagens para utilizadores')).toHaveValue('admin, member.one');
    const command = await page.evaluate(() => (globalThis as unknown as { __cmsTest: { saves: Record<string, unknown>[] } }).__cmsTest.saves.at(-1));
    expect(command?.recipient_usernames).toEqual(['admin', 'member.one']);
    expect(JSON.stringify(command?.content)).not.toContain('member.one');
    await cms.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(cms.getByRole('status')).toHaveText('Site publicado.');
    await page.route('**/api/calendar*', route => route.fulfill({ contentType: 'text/calendar', body: 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR' }));
    const request = page.waitForRequest(request => new URL(request.url()).pathname === '/api/calendar' && new URL(request.url()).searchParams.get('source') === calendar);
    await page.goto('/');
    expect(new URL((await request).url()).searchParams.get('source')).toBe(calendar);
    await expect(page.locator('#bio h2 img')).toHaveCount(0);
    const fonts = await page.evaluate(() => ({ title: getComputedStyle(document.querySelector('#bio h2')!).fontFamily, gallery: getComputedStyle(document.querySelector('.gallery-link')!).fontFamily }));
    expect(fonts.gallery).toBe(fonts.title);
  });

  test('publishes a continuous 80vh YouTube gallery that moves slowly right and centers on interaction', async ({ page }) => {
    await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType: 'application/javascript', body: `
      globalThis.__youtubeTest = { players: [] };
      window.YT = { Player: class {
        constructor(element, options) {
          this.options = options; this.playing = false; this.muted = false;
          this.iframe = document.createElement('iframe');
          this.iframe.src = options.host + '/embed/' + options.videoId + '?' + new URLSearchParams(options.playerVars);
          element.replaceWith(this.iframe);
          globalThis.__youtubeTest.players.push(this);
          queueMicrotask(() => options.events.onReady({ target: this }));
        }
        getIframe() { return this.iframe; }
        mute() { this.muted = true; }
        playVideo() { this.playCalls = (this.playCalls ?? 0) + 1; this.playing = true; this.options.events.onStateChange?.({ target: this, data: 1 }); }
        pauseVideo() { this.playing = false; this.options.events.onStateChange?.({ target: this, data: 2 }); }
        destroy() { this.iframe.remove(); this.playing = false; }
      } };
      window.onYouTubeIframeAPIReady();
    ` }));
    const poster = readFileSync(new URL('../src/assets/GalaCriCri-09-03-2023-008.jpeg', import.meta.url)).toString('base64');
    await page.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: `<html><body style="margin:0;background:#122"><img src="data:image/jpeg;base64,${poster}" style="width:100vw;height:100vh;object-fit:cover" alt="Video fixture"></body></html>` }));
    const cms = page.locator('.site-cms');
    const headings = await cms.locator('.cms-section > summary').allTextContents();
    expect(headings[headings.indexOf('Fotos') + 1]).toBe('Vídeos');
    await cms.locator('summary').filter({ hasText: /^Vídeos$/ }).click();
    await cms.getByRole('button', { name: 'Adicionar vídeo', exact: true }).click();
    await cms.getByLabel('YouTube 1', { exact: true }).fill('https://example.com/video');
    await cms.getByRole('button', { name: 'Guardar rascunho', exact: true }).click();
    await expect(cms.getByRole('alert')).toContainText('YouTube');
    await cms.getByLabel('YouTube 1', { exact: true }).fill('https://youtu.be/M7lc1UVf-VE');
    await cms.getByRole('button', { name: 'Adicionar vídeo', exact: true }).click();
    await cms.getByLabel('YouTube 2', { exact: true }).fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await cms.getByRole('button', { name: 'Guardar rascunho', exact: true }).click();
    await expect(cms.getByRole('status')).toHaveText('Rascunho guardado.');
    await expect(cms.getByLabel('YouTube 1', { exact: true })).toHaveValue('https://www.youtube.com/watch?v=M7lc1UVf-VE');
    await cms.screenshot({ path: test.info().outputPath('cms-videos.png') });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#bio p')).toHaveText(siteDefaults.sections.bio.text);
    await expect(page.locator('#videos')).toHaveCount(0);
    await page.goto('/admin');
    await page.locator('.cms-heading').click();
    await expect(page.getByLabel('Nome da banda', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Publicar', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Site publicado.');
    await page.mouse.move(0, 0);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const gallery = page.locator('#videos');
    await gallery.scrollIntoViewIfNeeded();
    await expect.poll(() => gallery.locator('iframe').count()).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __youtubeTest: { players: { playing: boolean }[] } }).__youtubeTest.players.filter(player => player.playing).length)).toBe(0);
    await expect(page.locator('#bio h2')).toContainText('O Cardume');
    const dimensions = await gallery.locator('.video-gallery-frame').first().evaluate(element => ({ width: element.clientWidth, height: element.clientHeight }));
    expect(dimensions.width).toBeGreaterThanOrEqual(200);
    expect(dimensions.height).toBeGreaterThanOrEqual(200);
    expect(Math.abs(dimensions.height - page.viewportSize()!.height * .8)).toBeLessThanOrEqual(1);
    await expect(gallery.locator('.video-gallery-controls')).toHaveCount(0);
    await expect(gallery.getByRole('button', { name: 'Vídeo anterior', exact: true })).toBeVisible();
    await expect(gallery.getByRole('button', { name: 'Vídeo seguinte', exact: true })).toBeVisible();
    const layout = await gallery.evaluate(element => {
      const section = getComputedStyle(element);
      const arrow = getComputedStyle(element.querySelector('.video-gallery-arrow')!);
      return { padding: section.paddingTop, scrollMargin: section.scrollMarginTop, position: arrow.position, border: arrow.borderTopWidth, background: arrow.backgroundColor, width: element.querySelector('.video-gallery-stage')!.clientWidth };
    });
    const sharedPadding = await page.locator('#socials').evaluate(element => getComputedStyle(element).paddingTop);
    expect(layout).toEqual({ padding: sharedPadding, scrollMargin: '0px', position: 'absolute', border: '0px', background: 'rgba(0, 0, 0, 0)', width: page.viewportSize()!.width });
    await expect(gallery.locator('.video-gallery-prev svg')).toHaveAttribute('width', '44');
    await expect(gallery.locator('.swiper-pagination-bullet')).toHaveCount(6);
    const expectedGap = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.7);
    expect(await gallery.locator('.video-gallery-frame').first().evaluate(element => getComputedStyle(element).borderRadius)).toBe('16px');
    const carousel = await gallery.locator('.swiper').evaluate(element => {
      const swiper = (element as HTMLElement & { swiper: { params: { loop: boolean; spaceBetween: number; speed: number; parallax: { enabled: boolean }; autoplay: { delay: number; disableOnInteraction: boolean; reverseDirection: boolean } }; autoplay: { running: boolean } } }).swiper;
      return { loop: swiper.params.loop, gap: swiper.params.spaceBetween, speed: swiper.params.speed, parallax: swiper.params.parallax.enabled, delay: swiper.params.autoplay.delay, interactionStops: swiper.params.autoplay.disableOnInteraction, reverse: swiper.params.autoplay.reverseDirection, running: swiper.autoplay.running };
    });
    expect(carousel).toEqual({ loop: true, gap: expectedGap, speed: 18000, parallax: true, delay: 0, interactionStops: true, reverse: true, running: true });
    const players = await page.evaluate(() => (globalThis as unknown as { __youtubeTest: { players: { playing: boolean; muted: boolean; options: { playerVars: { controls: number } } }[] } }).__youtubeTest.players.map(player => ({ playing: player.playing, muted: player.muted, controls: player.options.playerVars.controls })));
    expect(players.filter(player => player.playing).length).toBeLessThanOrEqual(1);
    expect(players.every(player => player.muted && player.controls === 1)).toBe(true);
    const wrapper = gallery.locator('.swiper-wrapper');
    const translation = () => wrapper.evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41);
    const start = await translation();
    await expect.poll(translation).toBeGreaterThan(start + 10);
    const targetIndex = await gallery.locator('.swiper-slide').evaluateAll(slides => slides.filter(slide => slide.querySelector('iframe')).sort((first, second) => {
      const distance = (slide: Element) => Math.abs(slide.getBoundingClientRect().left + slide.getBoundingClientRect().width / 2 - innerWidth / 2);
      return distance(first) - distance(second);
    })[0].getAttribute('data-swiper-slide-index'));
    const target = gallery.locator(`.swiper-slide[data-swiper-slide-index="${targetIndex}"]`);
    const running = () => gallery.locator('.swiper').evaluate(element => (element as HTMLElement & { swiper: { autoplay: { running: boolean } } }).swiper.autoplay.running);
    if (!test.info().project.use.hasTouch) {
      await target.locator('.video-gallery-frame').hover({ force: true });
      expect(await running()).toBe(true);
      const hovered = await translation();
      await expect.poll(translation).toBeGreaterThan(hovered + 10);
    }
    if (test.info().project.use.hasTouch) {
      const box = await target.locator('iframe').boundingBox();
      expect(box).not.toBeNull();
      await page.touchscreen.tap(Math.max(5, Math.min(page.viewportSize()!.width - 5, box!.x + box!.width / 2)), Math.max(5, Math.min(page.viewportSize()!.height - 5, box!.y + box!.height / 2)));
    } else {
      await target.locator('iframe').evaluate(element => (element as HTMLIFrameElement).focus());
    }
    const centerOffset = () => target.evaluate(element => Math.abs(element.getBoundingClientRect().left + element.getBoundingClientRect().width / 2 - element.closest('.swiper')!.getBoundingClientRect().left - element.closest('.swiper')!.clientWidth / 2));
    await expect.poll(running).toBe(false);
    await expect.poll(centerOffset).toBeLessThan(2);
    await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __youtubeTest: { players: { playing: boolean }[] } }).__youtubeTest.players.filter(player => player.playing).length)).toBe(0);
    await page.mouse.move(0, 0);
    await expect.poll(() => gallery.locator('iframe').first().contentFrame().locator('img').evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
    await gallery.screenshot({ path: test.info().outputPath('public-videos.png') });
    expect(await running()).toBe(false);
    expect(await centerOffset()).toBeLessThan(2);
    if (page.viewportSize()!.width >= 1024) {
      const neighborsVisible = await gallery.locator('.swiper-slide').evaluateAll(slides => {
        const bounds = slides.map(slide => slide.getBoundingClientRect());
        return bounds.some(bound => bound.left < 0 && bound.right > 0) && bounds.some(bound => bound.left < innerWidth && bound.right > innerWidth);
      });
      expect(neighborsVisible).toBe(true);
    }
    const activeVideo = () => gallery.locator('.swiper').evaluate(element => (element as HTMLElement & { swiper: { realIndex: number } }).swiper.realIndex);
    const beforeArrow = await activeVideo();
    await gallery.getByRole('button', { name: 'Vídeo seguinte', exact: true }).click();
    await expect.poll(activeVideo).not.toBe(beforeArrow);
    await expect.poll(running).toBe(false);
    await expect.poll(() => gallery.locator('.swiper-slide-active').evaluate(element => Math.abs(element.getBoundingClientRect().left + element.clientWidth / 2 - element.closest('.swiper')!.getBoundingClientRect().left - element.closest('.swiper')!.clientWidth / 2))).toBeLessThan(2);
    const beforeDot = await activeVideo();
    const dot = (beforeDot + 2) % 6;
    await gallery.getByRole('button', { name: `Ir para vídeo ${dot + 1}`, exact: true }).click();
    await expect.poll(activeVideo).toBe(dot);
    await expect.poll(running).toBe(false);
    await page.locator('#home').scrollIntoViewIfNeeded();
    await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __youtubeTest: { players: { playing: boolean }[] } }).__youtubeTest.players.filter(player => player.playing).length)).toBe(0);
    await expect.poll(running).toBe(false);
    await page.mouse.move(0, 0);
    await gallery.scrollIntoViewIfNeeded();
    await expect.poll(running).toBe(true);
    const resumed = await translation();
    await expect.poll(translation).toBeGreaterThan(resumed + 10);
    const automaticPlayCalls = await page.evaluate(() => (globalThis as unknown as { __youtubeTest: { players: { playCalls?: number; options: { playerVars: { autoplay: number } } }[] } }).__youtubeTest.players.map(player => ({ calls: player.playCalls ?? 0, autoplay: player.options.playerVars.autoplay })));
    expect(automaticPlayCalls.every(player => player.calls === 0 && player.autoplay === 0)).toBe(true);
    await page.locator('#bio').scrollIntoViewIfNeeded();
    if (page.viewportSize()!.width < 768) await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
    await page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('button', { name: siteDefaults.videos.label, exact: true }).click();
    await expect.poll(() => gallery.evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(2);
  });
});