import { expect, test } from '@playwright/test';

function makeScore() {
  let stream = 'BT /F1 20 Tf 40 800 Td (Practice score) Tj ET\n';
  for (let staff = 0; staff < 7; staff += 1) {
    for (let line = 0; line < 5; line += 1) {
      const height = 740 - staff * 85 - line * 7;
      stream += `40 ${height} m 555 ${height} l S\n`;
    }
    for (let note = 0; note < 8; note += 1) {
      const left = 75 + note * 55;
      const top = 725 - staff * 85 + (note % 3) * 7;
      stream += `${left} ${top} 6 4 re f ${left + 6} ${top} m ${left + 6} ${top + 24} l S\n`;
    }
  }
  const page = (content: number) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents ${content} 0 R >>`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    page(6), page(7),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((value, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${value}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

const pdf = makeScore();
const mockModule = `
const songs = ['Emorio', 'Anunciacao', 'Sem PDF'].map((title, index) => ({
  id: 'song-' + index, title, rhythm: 'Forro', artist: 'Test fixture', key_c: 'C', key_eb: 'A', video_url: '', audio_url: '',
  song_parts: [{ instrument: 'Sax Alto', url: 'https://example.com/source' }, { instrument: 'Trompete', url: 'https://example.com/source' }],
}));
const sheets = [0, 1].map(index => ({ id: 'pdf-' + index, band_id: 'band', song_id: 'song-' + index, title: songs[index].title, instrument: 'Sax Alto', file_name: 'score.pdf', file_size: 1000, storage_path: 'band/pdf-' + index + '.pdf', created_at: '' }));
const lists = [{ id: 'concert', title: 'Brasilidades - Lavagem das Escadas de Sto Antonio 26', setlist_songs: songs.map((song, index) => ({ song_id: song.id, position: index + 1 })) }];
const session = { user: { id: 'stage-tester', email: 'stage@members.sardinhas-nomades.invalid' } };
globalThis.__stageTest = { downloads: [], fail: false, uploaded: null };
const blob = new Blob([Uint8Array.from(atob('${pdf.toString('base64')}'), character => character.charCodeAt(0))], { type: 'application/pdf' });
export const supabase = {
  auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session } }) },
  storage: { from() { return {
    async download(path) { globalThis.__stageTest.downloads.push(path); return globalThis.__stageTest.fail ? { data: null, error: { message: 'Simulated network failure' } } : { data: blob, error: null }; },
    async upload() { return { error: null }; },
  }; } },
  from(table) {
    let id = '', changes = null;
    const query = {
      select() { return query; }, eq(column, value) { if (column === 'id') id = value; return query; }, order() { return query; },
      update(value) { changes = value; return query; },
      async insert(value) { globalThis.__stageTest.uploaded = value; sheets.push({ ...value, created_at: '' }); return { error: null }; },
      async single() { const sheet = sheets.find(item => item.id === id); Object.assign(sheet, changes); return { data: { ...sheet }, error: null }; },
      then(resolve) {
        const data = table === 'band_members' ? [{ band_id: 'band', roles: ['musician'], active: true, bands: { name: 'Sardinhas Nomades' } }] : table === 'songs' ? songs : table === 'setlists' ? lists : table === 'music_sheets' ? sheets.map(sheet => ({ ...sheet })) : [];
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return query;
  },
};
`;

test.beforeEach(async ({ page }) => {
  await page.route('**/src/utils/supabase.ts*', (route) => route.fulfill({ contentType: 'application/javascript', body: mockModule }));
  await page.goto('/music');
});

test('stage reader renders scores, navigates, resumes and recovers', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByRole('button', { name: 'Tocar setlist', exact: true }).click();
  const reader = page.getByRole('dialog');
  await expect(reader).toBeVisible();
  await expect(reader.getByRole('heading', { name: 'Emorio', exact: true })).toBeVisible();
  const canvas = reader.locator('canvas').first();
  await expect.poll(async () => canvas.evaluate((element) => {
    const surface = element as HTMLCanvasElement;
    const pixels = surface.getContext('2d')!.getImageData(0, 0, surface.width, surface.height).data;
    let ink = 0;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index + 3] && pixels[index] < 100) ink += 1;
    return ink;
  })).toBeGreaterThan(100);
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __stageTest: { downloads: string[] } }).__stageTest.downloads)).toContain('band/pdf-1.pdf');
  await expect(reader.getByRole('button', { name: 'Anterior', exact: true })).toBeDisabled();
  await expect(reader.getByRole('button', { name: 'Anterior', exact: true })).toHaveCSS('opacity', '1');
  await expect(reader.locator('.score-tools')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const scoreBounds = await reader.locator('.score-viewport').boundingBox();
  const headerBounds = await reader.locator('.reader-header').boundingBox();
  const narrow = testInfo.project.use.viewport!.width < 1024;
  expect(scoreBounds?.y).toBe(narrow ? headerBounds!.height + 8 : 0);
  expect(scoreBounds?.height).toBe(testInfo.project.use.viewport!.height - scoreBounds!.y);
  if (narrow) await expect(reader.locator('.reader-source-label')).toBeHidden();
  else {
    await expect(reader.locator('.reader-source-label')).toHaveText('PDF');
    await expect(reader.locator('.reader-heading h1')).toHaveCSS('color', 'rgb(255, 255, 255)');
  }
  const frame = await reader.boundingBox();
  expect(frame?.width).toBe(testInfo.project.use.viewport!.width);
  expect(frame?.height).toBe(testInfo.project.use.viewport!.height);
  await page.screenshot({ path: testInfo.outputPath('score.png') });
  await reader.getByRole('button', { name: 'Ecrã inteiro', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement) || document.querySelector('.reader-notice') !== null)).toBe(true);
  if (await page.evaluate(() => Boolean(document.fullscreenElement))) {
    await reader.getByRole('button', { name: 'Sair de ecrã inteiro', exact: true }).click();
    await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  }
  await reader.locator('.score-viewport').focus();
  await page.keyboard.press('ArrowRight');
  await expect(reader.getByRole('heading', { name: 'Anunciacao', exact: true })).toBeVisible();
  await reader.locator('.score-viewport').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(reader.getByRole('heading', { name: 'Emorio', exact: true })).toBeVisible();
  await reader.getByRole('button', { name: 'Aumentar zoom', exact: true }).click();
  await expect(reader.getByRole('button', { name: 'Ajustar à largura', exact: true })).toHaveText('125%');
  await reader.getByRole('button', { name: 'Ajustar à largura', exact: true }).click();
  await reader.getByRole('button', { name: 'Página seguinte', exact: true }).click();
  await expect(reader.getByRole('combobox', { name: 'Página do PDF', exact: true })).toHaveValue('2');
  await expect(reader.getByRole('heading', { name: 'Emorio', exact: true })).toBeVisible();
  const prefetched = await page.evaluate(() => (globalThis as unknown as { __stageTest: { downloads: string[] } }).__stageTest.downloads.filter((path) => path === 'band/pdf-1.pdf').length);
  await reader.getByRole('button', { name: 'Seguinte', exact: true }).click();
  await expect(reader.getByRole('heading', { name: 'Anunciacao', exact: true })).toBeVisible();
  await expect(reader.locator('canvas').first()).toBeVisible();
  expect(await page.evaluate(() => (globalThis as unknown as { __stageTest: { downloads: string[] } }).__stageTest.downloads.filter((path) => path === 'band/pdf-1.pdf').length)).toBe(prefetched);
  await reader.getByRole('button', { name: 'Músicas da setlist', exact: true }).click();
  await expect(reader.getByRole('button', { name: 'Fechar lista de músicas', exact: true })).toBeFocused();
  await reader.getByRole('button', { name: /3\. Sem PDF/ }).click();
  await expect(reader.getByText('Sem PDF associado para Sax Alto.')).toBeVisible();
  await expect(reader.getByRole('link')).toHaveCount(0);
  await expect(reader.getByRole('button', { name: 'Seguinte', exact: true })).toBeDisabled();
  await page.evaluate(() => { (globalThis as unknown as { __stageTest: { fail: boolean } }).__stageTest.fail = true; });
  await reader.getByRole('button', { name: 'Anterior', exact: true }).click();
  await expect(reader.getByText('Simulated network failure')).toBeVisible();
  await page.evaluate(() => { (globalThis as unknown as { __stageTest: { fail: boolean } }).__stageTest.fail = false; });
  await reader.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(reader.locator('canvas').first()).toBeVisible();
  await reader.getByRole('combobox', { name: 'Instrumento de palco', exact: true }).selectOption('Trompete');
  await expect(reader.getByText('Sem PDF associado para Trompete.')).toBeVisible();
  await reader.getByRole('button', { name: 'Voltar às setlists', exact: true }).click();
  await expect(reader).not.toBeVisible();
  await page.getByRole('button', { name: 'Tocar setlist', exact: true }).click();
  await expect(reader.getByRole('heading', { name: 'Anunciacao', exact: true })).toBeVisible();
  await expect(reader.getByRole('combobox', { name: 'Instrumento de palco', exact: true })).toHaveValue('Trompete');
  await page.keyboard.press('Escape');
  await expect(reader).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Tocar setlist', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('PDFs can be associated and uploaded for a specific song and instrument', async ({ page }) => {
  await page.getByRole('button', { name: 'PDFs', exact: true }).click();
  const form = page.getByRole('region', { name: 'Associar PDFs a músicas' }).locator('form').first();
  await form.getByLabel('Música associada').selectOption('song-2');
  await form.getByRole('button', { name: 'Guardar associação' }).click();
  await expect(form.getByLabel('Música associada')).toHaveValue('song-2');
  await page.getByRole('button', { name: 'Setlists', exact: true }).click();
  await page.getByRole('button', { name: 'Tocar setlist', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Sem PDF associado para Sax Alto.')).toBeVisible();
  await page.getByRole('button', { name: 'Voltar às setlists', exact: true }).click();
  await page.getByRole('button', { name: 'PDFs', exact: true }).click();
  const upload = page.locator('#music-sheets > form');
  await upload.getByRole('combobox', { name: 'Música', exact: true }).selectOption('song-0');
  await upload.getByRole('combobox', { name: 'Instrumento', exact: true }).fill('Trompete');
  await upload.getByLabel('PDF (até 20 MB)', { exact: true }).setInputFiles({ name: 'practice.pdf', mimeType: 'application/pdf', buffer: pdf });
  await upload.getByRole('button', { name: 'Carregar', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (globalThis as unknown as { __stageTest: { uploaded: { song_id: string; instrument: string } } }).__stageTest.uploaded)).toMatchObject({ song_id: 'song-0', instrument: 'Trompete' });
});

test('existing Drive parts open in place without replacing uploaded PDFs', async ({ page }, testInfo) => {
  const driveModule = mockModule.replaceAll("url: 'https://example.com/source'", "url: index === 2 ? 'https://drive.google.com/drive/folders/folder123' : 'https://drive.google.com/file/d/file_' + index + '/view?usp=sharing'");
  await page.route('**/src/utils/supabase.ts*', (route) => route.fulfill({ contentType: 'application/javascript', body: driveModule }));
  await page.route('https://drive.google.com/file/d/*/preview', (route) => route.fulfill({ contentType: 'text/html', body: '<html><body>Mock Drive score</body></html>' }));
  await page.reload();
  await page.getByRole('button', { name: 'Tocar setlist', exact: true }).click();
  const reader = page.getByRole('dialog');
  await expect(reader.locator('canvas').first()).toBeVisible();
  await expect(reader.locator('iframe')).toHaveCount(0);
  await reader.getByRole('combobox', { name: 'Instrumento de palco', exact: true }).selectOption('Trompete');
  await expect(reader.locator('iframe')).toHaveAttribute('src', 'https://drive.google.com/file/d/file_0/preview');
  await expect(reader.frameLocator('iframe').getByText('Mock Drive score')).toBeVisible();
  await expect(reader.getByRole('link')).toHaveCount(0);
  await expect(reader.locator('.reader-source-bar')).toHaveCount(0);
  const previewBounds = await reader.locator('iframe').boundingBox();
  const topBar = await reader.locator('.reader-header').boundingBox();
  const narrow = testInfo.project.use.viewport!.width < 1024;
  expect(previewBounds?.y).toBe(narrow ? topBar!.height + 8 : 0);
  expect(previewBounds?.height).toBe(testInfo.project.use.viewport!.height - previewBounds!.y);
  if (narrow) await expect(reader.locator('.reader-source-label')).toBeHidden();
  else {
    await expect(reader.locator('.reader-source-label')).toHaveText('Google Drive');
    await expect(reader.locator('.reader-heading h1')).toHaveCSS('color', 'rgb(255, 255, 255)');
  }
  await expect(reader.locator('.reader-header')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(reader.locator('.reader-navigation')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  const back = reader.getByRole('button', { name: 'Voltar às setlists', exact: true });
  await expect(reader.locator('.reader-header button').first()).toHaveAttribute('aria-label', 'Voltar às setlists');
  await back.click();
  await expect(reader).not.toBeVisible();
  await page.getByRole('button', { name: 'Tocar setlist', exact: true }).click();
  await expect(reader.locator('iframe')).toHaveAttribute('src', 'https://drive.google.com/file/d/file_0/preview');
  await page.screenshot({ path: testInfo.outputPath('drive-reader.png') });
  await reader.getByRole('button', { name: 'Seguinte', exact: true }).click();
  await expect(reader.locator('iframe')).toHaveAttribute('src', 'https://drive.google.com/file/d/file_1/preview');
  await reader.getByRole('button', { name: 'Músicas da setlist', exact: true }).click();
  await expect(reader.getByRole('button', { name: '2. Anunciacao', exact: true })).toBeVisible();
  await reader.getByRole('button', { name: '3. Sem PDF', exact: true }).click();
  await expect(reader.locator('iframe')).toHaveCount(0);
  await expect(reader.getByRole('link')).toHaveCount(0);
});