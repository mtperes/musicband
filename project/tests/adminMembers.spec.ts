import { expect, test } from '@playwright/test';

const mockModule = `
const session = { user: { id: 'admin', email: 'admin@example.com' } };
const members = [
  { user_id: 'member', profile_id: 'profile', email: 'member@example.com', name: 'Ana', phone: '12345', roles: ['musician'], active: true, confirmed: true },
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