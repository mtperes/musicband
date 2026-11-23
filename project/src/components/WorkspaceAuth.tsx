import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Eye, LogIn, LogOut, Music2, RefreshCw, ShieldCheck, Settings } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { workspaceUsername } from '../utils/workspaceIdentity';
import { WorkspaceAuthContext, useWorkspaceAuth, type Membership } from '../hooks/useWorkspaceAuth';

const button = 'inline-flex min-h-9 items-center justify-center gap-2 rounded border border-[#bdcfca] bg-white px-3 py-1.5 text-sm text-[#182628] hover:bg-[#e6efec] disabled:opacity-50';

export function WorkspaceAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(Boolean(supabase));
  const [membershipState, setMembershipState] = useState<{ userId: string; rows: Membership[]; error: string } | null>(null);
  const [authError, setAuthError] = useState('');
  const [revision, setRevision] = useState(0);
  const userId = session?.user.id;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      if (!next) setMembershipState(null);
      setSession(next);
      setSessionLoading(false);
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setSession(data.session);
      setAuthError(error?.message ?? '');
      setSessionLoading(false);
    }).catch(() => {
      if (active) { setAuthError('Não foi possível restaurar a sessão.'); setSessionLoading(false); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    void supabase.from('band_members').select('band_id, roles, active, bands(name)').eq('user_id', userId).then(({ data, error }) => {
      const accessError = error?.code === 'PGRST205' ? 'A sessão foi iniciada, mas a base de dados de membros ainda não está configurada.'
        : error?.code === '42703' ? 'A base de dados de membros precisa de ser atualizada para verificar contas ativas.' : error?.message ?? '';
      if (active) setMembershipState({ userId, rows: (data ?? []) as unknown as Membership[], error: accessError });
    });
    return () => { active = false; };
  }, [userId, revision]);

  const current = membershipState?.userId === userId ? membershipState : null;
  return (
    <WorkspaceAuthContext.Provider value={{
      session,
      memberships: current?.rows.filter((member) => member.active === true) ?? [],
      loading: sessionLoading || Boolean(userId && !current),
      error: authError || current?.error || '',
      reload: () => { setMembershipState(null); setRevision((value) => value + 1); },
    }}>
      {children}
    </WorkspaceAuthContext.Provider>
  );
}

export function WorkspaceAccount() {
  const { session, memberships } = useWorkspaceAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    if (!supabase || busy) return;
    setBusy(true);
    try {
      const { error: logoutError } = await supabase.auth.signOut({ scope: 'local' });
      if (logoutError) setError('A sessão local foi terminada, mas não foi possível confirmar a saída no servidor.');
    } finally { setBusy(false); }
  }
  if (!session) return null;
  const roleLabels = [
    { role: 'owner', label: 'Responsável', Icon: ShieldCheck },
    { role: 'admin', label: 'Admin', Icon: Settings },
    { role: 'musician', label: 'Músico', Icon: Music2 },
    { role: 'viewer', label: 'Leitor', Icon: Eye },
  ].filter(({ role }) => memberships.some((member) => member.roles.includes(role)));
  return <div className="workspace-account min-w-0 flex-wrap">
    <div className="workspace-account-details">
      <span className="max-w-60 break-all text-sm text-[#52625f]">{workspaceUsername(session.user.email ?? '')}</span>
      {roleLabels.length > 0 && <div className="workspace-account-roles" aria-label="Funções na banda">
        {roleLabels.map(({ role, label, Icon }) => <span key={role} className="workspace-role-label" title={label}>
          <Icon size={12} aria-hidden="true" />{label}
        </span>)}
      </div>}
    </div>
    <button type="button" className={button} disabled={busy} onClick={() => void signOut()}><LogOut size={18} /> Sair</button>
    {error && <p role="alert" className="w-full text-sm text-red-800">{error}</p>}
  </div>;
}

export function WorkspaceGuard({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const { session, loading, error, memberships, reload } = useWorkspaceAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true);
    setLoginError('');
    try {
      const { data, error: loginError } = await supabase.functions.invoke('workspace-members', { body: { action: 'sign_in', username: username.trim().toLowerCase(), password } });
      if (loginError || !data?.session) throw new Error('Utilizador ou palavra-passe inválidos.');
      const { error: sessionError } = await supabase.auth.setSession(data.session);
      if (sessionError) throw sessionError;
      setPassword('');
    } catch (signInError) { setLoginError(signInError instanceof Error && signInError.message === 'Utilizador ou palavra-passe inválidos.' ? signInError.message : 'Não foi possível iniciar sessão. Verifique o utilizador, a palavra-passe e a ligação.'); }
    finally { setBusy(false); }
  }

  if (!supabase) return <p role="status">Supabase indisponível. Configure o URL e a chave pública.</p>;
  if (loading) return <p role="status" className="py-8">A carregar...</p>;
  if (!session) return <section className="mt-8 border-y border-[#d6dfdc] py-8" aria-labelledby="login-heading">
    <h1 id="login-heading" className="text-2xl font-semibold">Área de membros</h1>
    <form className="mt-5 flex max-w-md flex-col gap-3" onSubmit={(event) => void signIn(event)}>
      <label className="flex flex-col gap-1 text-sm">Utilizador<input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required minLength={3} maxLength={64} pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,63}" value={username} disabled={busy} onChange={(event) => setUsername(event.target.value)} className="min-h-11 rounded border border-[#bdcfca] bg-white px-3 py-2 text-[#182628]" /></label>
      <label className="flex flex-col gap-1 text-sm">Palavra-passe<input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} className="min-h-11 rounded border border-[#bdcfca] bg-white px-3 py-2 text-[#182628]" /></label>
      <button type="submit" className={`${button} self-start`} disabled={busy}><LogIn size={18} />{busy ? 'A entrar...' : 'Entrar'}</button>
    </form>
    {(loginError || error) && <p role="alert" className="mt-4 text-sm text-red-800">{loginError || error}</p>}
  </section>;
  const roles = admin ? ['owner', 'admin'] : ['owner', 'admin', 'musician', 'viewer'];
  if (error || !memberships.some((member) => member.roles.some((role) => roles.includes(role)))) return <section className="py-8">
    <h1 className="text-2xl font-semibold">{admin ? 'Administração' : 'Partituras'}</h1>
    <p role={error ? 'alert' : 'status'} className="mt-4 text-[#52625f]">{error ? `Não foi possível verificar o acesso: ${error}` : 'A sua conta não tem acesso a esta área. Contacte o administrador.'}</p>
    <button type="button" className={`${button} mt-4`} onClick={reload}><RefreshCw size={18} /> Verificar acesso</button>
  </section>;
  return <Fragment key={session.user.id}>{children}</Fragment>;
}