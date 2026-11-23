const usernameDomain = '@members.sardinhas-nomades.invalid';

export function workspaceEmail(username: string) {
  const normalized = username.trim().toLowerCase();
  if (normalized === 'admin') return 'mt.peresn@gmail.com';
  if (normalized.includes('@')) return normalized;
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(normalized)) throw new Error('Utilizador inválido.');
  return `${normalized}${usernameDomain}`;
}

export function workspaceUsername(email: string) {
  if (email.toLowerCase() === 'mt.peresn@gmail.com') return 'admin';
  return email.endsWith(usernameDomain) ? email.slice(0, -usernameDomain.length) : email;
}