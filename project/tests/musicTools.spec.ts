import { expect, test, type Page } from '@playwright/test';

async function openTools(page: Page, role = 'musician', active = true) {
  await page.route('**/src/utils/supabase.ts*', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    let presets = JSON.parse(localStorage.getItem('tools-preset-fixture') ?? '[]');
    globalThis.__presetTest = { fail: false, writes: [] };
    export const supabase = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        getSession: async () => ({ data: { session: ${role === 'guest' ? 'null' : "{ user: { id: 'member', email: 'member@example.com' } }"} } }),
      },
      from(table) {
        let pending;
        const query = { select() { return query; }, eq() { return query; }, order() { return query; }, range() { return query; },
          upsert(row, options) { pending = row; globalThis.__presetTest.writes.push({ row, options }); return query; },
          async single() {
            if (globalThis.__presetTest.fail) return { data: null, error: { message: 'Save failed' } };
            presets = presets.filter(row => row.band_id !== pending.band_id || row.rhythm !== pending.rhythm).concat([structuredClone(pending)]);
            localStorage.setItem('tools-preset-fixture', JSON.stringify(presets));
            return { data: pending, error: null };
          },
          then(resolve) {
            const data = table === 'band_members' ? [{ band_id: 'band', roles: ['${role}'], active: ${active}, bands: { name: 'Test Band' } }]
              : table === 'songs' ? [{ rhythm: 'Samba' }, { rhythm: 'Bossa Nova' }, { rhythm: 'Samba' }, { rhythm: '  Frevo  ' }, { rhythm: '' }].map((song, index) => ({ ...song, id: String(index), title: 'Song ' + index, artist: '', key_c: '', key_eb: '', audio_url: '', video_url: '', song_parts: [] }))
              : table === 'rhythm_presets' ? presets : [];
            return Promise.resolve({ data, error: null }).then(resolve);
          }
        }; return query;
      },
    };
  ` }));
  await page.goto('/tools');
}

async function installAudioProbe(page: Page, denyMicrophone = false) {
  await page.addInitScript(({ denied }) => {
    const NativeAudioContext = window.AudioContext;
    const probe = {
      contexts: [] as AudioContext[],
      analysers: [] as AnalyserNode[],
      scheduled: [] as number[],
      tone: null as OscillatorNode | null,
      stoppedTracks: 0,
    };
    Object.assign(window, { __toolsAudio: probe });
    window.AudioContext = class extends NativeAudioContext {
      constructor(options?: AudioContextOptions) { super(options); probe.contexts.push(this); }
      createGain() {
        const gain = super.createGain();
        const connect = gain.connect.bind(gain);
        gain.connect = ((target: AudioNode, ...args: number[]) => {
          if (target === this.destination) {
            const analyser = this.createAnalyser();
            connect(analyser);
            probe.analysers.push(analyser);
          }
          return connect(target, ...args);
        }) as typeof gain.connect;
        return gain;
      }
      createOscillator() {
        const oscillator = super.createOscillator();
        const start = oscillator.start.bind(oscillator);
        oscillator.start = (time = 0) => { probe.scheduled.push(time); start(time); };
        return oscillator;
      }
    };
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: async () => {
      if (denied) throw new DOMException('Denied', 'NotAllowedError');
      const context = new NativeAudioContext();
      await context.resume();
      const oscillator = context.createOscillator();
      oscillator.frequency.value = 440;
      const destination = context.createMediaStreamDestination();
      oscillator.connect(destination);
      oscillator.start();
      probe.tone = oscillator;
      destination.stream.getTracks().forEach((track) => {
        const stop = track.stop.bind(track);
        track.stop = () => { probe.stoppedTracks++; stop(); void context.close(); };
      });
      return destination.stream;
    } });
  }, { denied: denyMicrophone });
}

for (const role of ['musician', 'viewer']) {
  test(`${role} can access tools and navigate from music`, async ({ page }, testInfo) => {
    await openTools(page, role);
    await expect(page.getByRole('heading', { name: 'Afinador', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ritmo', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ferramentas', exact: true })).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel('Subdivisão', { exact: true }).selectOption('4');
    await page.getByLabel('Compasso', { exact: true }).selectOption('7');
    await expect(page.getByRole('button', { name: 'Pratos passo 28', exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByLabel('Compasso', { exact: true }).selectOption('4');
    await page.getByLabel('Subdivisão', { exact: true }).selectOption('2');
    if (role === 'musician') await page.screenshot({ path: `test-results/tools-${testInfo.project.name}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Música', exact: true }).click();
    await page.getByRole('link', { name: 'Ferramentas', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Afinador', exact: true })).toBeVisible();
  });
}

test('guests, inactive members and other roles cannot use tools', async ({ page }) => {
  await openTools(page, 'guest');
  await expect(page.getByRole('heading', { name: 'Área de membros' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ativar microfone' })).toHaveCount(0);
  await page.unrouteAll({ behavior: 'wait' });
  await openTools(page, 'musician', false);
  await expect(page.getByText('A sua conta não tem acesso', { exact: false })).toBeVisible();
  await page.unrouteAll({ behavior: 'wait' });
  await openTools(page, 'production');
  await expect(page.getByText('A sua conta não tem acesso', { exact: false })).toBeVisible();
});

test('tuner detects A4, sharp and flat tones and releases the microphone', async ({ page }) => {
  await installAudioProbe(page);
  await openTools(page);
  await page.getByRole('button', { name: 'Ativar microfone', exact: true }).click();
  await expect(page.getByLabel('Nota detetada')).toHaveText('A4');
  await expect(page.getByRole('region', { name: 'Afinador' }).getByRole('status')).toHaveText('Afinado');
  await expect(page.locator('.tuning-display')).toHaveClass(/is-tuned/);
  for (const [cents, message] of [[30, 'Alto'], [-30, 'Baixo']] as const) {
    await page.evaluate((offset) => {
      const probe = (window as unknown as { __toolsAudio: { tone: OscillatorNode } }).__toolsAudio;
      probe.tone.frequency.value = 440 * 2 ** (offset / 1200);
    }, cents);
    await expect(page.getByRole('region', { name: 'Afinador' }).getByRole('status')).toContainText(message);
    await expect(page.getByRole('meter', { name: 'Desvio de afinação' })).toHaveAttribute('aria-valuenow', String(cents));
    await expect(page.locator('.bar-active.bar-red')).not.toHaveCount(0);
  }
  await page.getByLabel('Referência A4').selectOption('432');
  await page.evaluate(() => { (window as unknown as { __toolsAudio: { tone: OscillatorNode } }).__toolsAudio.tone.frequency.value = 432; });
  await expect(page.getByRole('region', { name: 'Afinador' }).getByRole('status')).toHaveText('Afinado');
  await page.getByRole('button', { name: 'Desligar microfone' }).click();
  await expect(page.getByRole('region', { name: 'Afinador' }).getByRole('status')).toHaveText('Microfone desligado');
  expect(await page.evaluate(() => (window as unknown as { __toolsAudio: { stoppedTracks: number } }).__toolsAudio.stoppedTracks)).toBe(1);
});

test('microphone permission denial is recoverable', async ({ page }) => {
  await installAudioProbe(page, true);
  await openTools(page);
  await page.getByRole('button', { name: 'Ativar microfone' }).click();
  await expect(page.getByRole('alert')).toContainText('Acesso ao microfone recusado');
  await expect(page.getByRole('button', { name: 'Ativar microfone' })).toBeEnabled();
});

test('metronome produces timed audio and supports tempo, patterns, sound and stop', async ({ page }) => {
  await installAudioProbe(page);
  await openTools(page);
  await page.getByRole('spinbutton', { name: 'BPM', exact: true }).fill('120');
  await page.getByRole('button', { name: 'Aumentar BPM' }).click();
  await expect(page.getByRole('spinbutton', { name: 'BPM', exact: true })).toHaveValue('121');
  await page.getByRole('button', { name: 'Diminuir BPM' }).click();
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Parar', exact: true })).toBeVisible();
  const audible = await page.evaluate(async () => {
    const probe = (window as unknown as { __toolsAudio: { analysers: AnalyserNode[] } }).__toolsAudio;
    const samples = new Float32Array(2048);
    for (let frame = 0; frame < 120; frame++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      probe.analysers[0]?.getFloatTimeDomainData(samples);
      if (samples.some((sample) => Math.abs(sample) > 0.001)) return true;
    }
    return false;
  });
  expect(audible).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __toolsAudio: { scheduled: number[] } }).__toolsAudio.scheduled.length)).toBeGreaterThanOrEqual(3);
  const intervals = await page.evaluate(() => (window as unknown as { __toolsAudio: { scheduled: number[] } }).__toolsAudio.scheduled.slice(0, 3));
  expect(intervals[1] - intervals[0]).toBeCloseTo(0.5, 4);
  expect(intervals[2] - intervals[1]).toBeCloseTo(0.5, 4);
  await page.getByLabel('Volume', { exact: true }).fill('27');
  await expect(page.locator('.tools-volume output')).toHaveText('27%');
  await page.getByLabel('Som', { exact: true }).selectOption('electronic');
  await page.getByLabel('Padrão', { exact: true }).selectOption('drums');
  await expect(page.getByRole('button', { name: 'Iniciar', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bombo passo 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Bombo passo 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bombo passo 1', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Silenciar Caixa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Silenciar Caixa', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await page.getByRole('button', { name: 'Parar', exact: true }).click();
  await expect(page.locator('.beat-current')).toHaveCount(0);
});

test('switching instruments and leaving tools closes audio resources', async ({ page }) => {
  await installAudioProbe(page);
  await openTools(page);
  await page.getByRole('button', { name: 'Ativar microfone' }).click();
  await expect(page.getByRole('region', { name: 'Afinador' }).getByRole('status')).toHaveText('Afinado');
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Afinador' }).getByRole('status')).toHaveText('Microfone desligado');
  await page.getByRole('link', { name: 'Música', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __toolsAudio: { contexts: AudioContext[] } }).__toolsAudio.contexts.every((context) => context.state === 'closed'))).toBe(true);
});

test('repertoire rhythms are deduplicated and saving consolidates every setting across reloads', async ({ page }) => {
  await openTools(page);
  await expect(page.getByText('Sardinhas Nômades / Ensaio', { exact: true })).toHaveCount(0);
  const selector = page.getByLabel('Ritmo do repertório', { exact: true });
  await expect(selector.locator('option')).toHaveText(['Selecionar ritmo', 'Bossa Nova', 'Frevo', 'Samba']);
  const save = page.getByRole('button', { name: 'Guardar', exact: true });
  await expect(save).toBeDisabled();
  await selector.selectOption('Samba');
  await page.getByRole('spinbutton', { name: 'BPM', exact: true }).fill('126');
  await page.getByLabel('Padrão', { exact: true }).selectOption('drums');
  await page.getByLabel('Compasso', { exact: true }).selectOption('3');
  await page.getByLabel('Subdivisão', { exact: true }).selectOption('4');
  await page.getByLabel('Som', { exact: true }).selectOption('electronic');
  await page.getByLabel('Volume', { exact: true }).fill('27');
  await page.getByRole('button', { name: 'Silenciar Caixa', exact: true }).click();
  await page.getByRole('button', { name: 'Bombo passo 2', exact: true }).click();
  await save.click();
  await expect(page.locator('.rhythm-save-status')).toHaveText('Configuração guardada');
  await expect(save).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'BPM', exact: true }).fill('132');
  await expect(page.locator('.rhythm-save-status')).toHaveText('Alterações por guardar');
  await save.click();
  await expect(save).toBeDisabled();
  const records = await page.evaluate(() => JSON.parse(localStorage.getItem('tools-preset-fixture') ?? '[]'));
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ band_id: 'band', rhythm: 'Samba', bpm: 132, beats: 3, subdivision: 4, kit: 'electronic', drums: true, volume: 0.27, muted: ['snare'] });
  await page.reload();
  await selector.selectOption('Samba');
  await expect(page.getByRole('spinbutton', { name: 'BPM', exact: true })).toHaveValue('132');
  await expect(page.getByLabel('Compasso', { exact: true })).toHaveValue('3');
  await expect(page.getByLabel('Subdivisão', { exact: true })).toHaveValue('4');
  await expect(page.getByLabel('Padrão', { exact: true })).toHaveValue('drums');
  await expect(page.getByLabel('Som', { exact: true })).toHaveValue('electronic');
  await expect(page.getByLabel('Volume', { exact: true })).toHaveValue('27');
  await expect(page.getByRole('button', { name: 'Silenciar Caixa', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Bombo passo 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('saved rhythms load independently and switching protects unsaved edits', async ({ page }) => {
  await openTools(page);
  const selector = page.getByLabel('Ritmo do repertório', { exact: true });
  const bpm = page.getByRole('spinbutton', { name: 'BPM', exact: true });
  const save = page.getByRole('button', { name: 'Guardar', exact: true });
  for (const [name, tempo] of [['Samba', '110'], ['Bossa Nova', '90']]) {
    await selector.selectOption(name);
    await bpm.fill(tempo);
    await save.click();
    await expect(save).toBeDisabled();
  }
  await selector.selectOption('Samba');
  await expect(bpm).toHaveValue('110');
  await bpm.fill('115');
  page.once('dialog', (dialog) => dialog.dismiss());
  await selector.selectOption('Bossa Nova');
  await expect(selector).toHaveValue('Samba');
  await expect(bpm).toHaveValue('115');
  page.once('dialog', (dialog) => dialog.accept());
  await selector.selectOption('Bossa Nova');
  await expect(bpm).toHaveValue('90');
});

test('failed saves preserve edits and can be retried', async ({ page }) => {
  await openTools(page);
  await page.getByLabel('Ritmo do repertório', { exact: true }).selectOption('Samba');
  await page.getByRole('spinbutton', { name: 'BPM', exact: true }).fill('124');
  await page.evaluate(() => { (globalThis as unknown as { __presetTest: { fail: boolean } }).__presetTest.fail = true; });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível guardar');
  await expect(page.getByRole('spinbutton', { name: 'BPM', exact: true })).toHaveValue('124');
  await expect(page.locator('.rhythm-save-status')).toHaveText('Alterações por guardar');
  await page.evaluate(() => { (globalThis as unknown as { __presetTest: { fail: boolean } }).__presetTest.fail = false; });
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.locator('.rhythm-save-status')).toHaveText('Configuração guardada');
});

test('viewers load shared configurations without a save command', async ({ page }) => {
  await page.addInitScript(() => {
    const pattern = { pulse: [true, false, true, false, true, false], kick: Array(6).fill(false), snare: Array(6).fill(false), hat: Array(6).fill(false) };
    localStorage.setItem('tools-preset-fixture', JSON.stringify([{ band_id: 'band', rhythm: 'Samba', bpm: 82, beats: 3, subdivision: 2, kit: 'studio', drums: false, volume: 0.4, muted: [], pattern }]));
  });
  await openTools(page, 'viewer');
  await page.getByLabel('Ritmo do repertório', { exact: true }).selectOption('Samba');
  await expect(page.getByRole('spinbutton', { name: 'BPM', exact: true })).toHaveValue('82');
  await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'BPM', exact: true }).fill('85');
  await expect(page.locator('.rhythm-save-status')).toHaveText('Alterações locais');
});