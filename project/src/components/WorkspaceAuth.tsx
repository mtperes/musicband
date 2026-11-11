import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { LogOut, Mail, RefreshCw } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { WorkspaceAuthContext, useWorkspaceAuth, type Membership } from '../hooks/useWorkspaceAuth';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded border border-[#bdcfca] bg-white px-3 py-2 text-sm text-[#182628] hover:bg-[#e6efec] disabled:opacity-50';

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
    void supabase.from('band_members').select('band_id, roles, bands(name)').eq('user_id', userId).then(({ data, error }) => {
      if (active) setMembershipState({ userId, rows: (data ?? []) as unknown as Membership[], error: error?.message ?? '' });
    });
    return () => { active = false; };
  }, [userId, revision]);

  const current = membershipState?.userId === userId ? membershipState : null;
  return (
    <WorkspaceAuthContext.Provider value={{
      session,
      memberships: current?.rows ?? [],
      loading: sessionLoading || Boolean(userId && !current),
      error: authError || current?.error || '',
      reload: () => { setMembershipState(null); setRevision((value) => value + 1); },
    }}>
      {children}
    </WorkspaceAuthContext.Provider>
  );
}

export function WorkspaceAccount() {
  const { session } = useWorkspaceAuth();
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
  return <div className="flex min-w-0 flex-wrap items-center gap-3">
    <span className="max-w-60 break-all text-sm text-[#52625f]">{session.user.email}</span>
    <button type="button" className={button} disabled={busy} onClick={() => void signOut()}><LogOut size={18} /> Sair</button>
    {error && <p role="alert" className="w-full text-sm text-red-800">{error}</p>}
  </div>;
}

export function WorkspaceGuard({ admin = false, children }: { admin?: boolean; children: ReactNode }) {
  const { session, loading, error, memberships, reload } = useWorkspaceAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busy || cooldown) return;
    setBusy(true);
    setLoginError('');
    try {
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/confirm?next=${admin ? 'admin' : 'music'}` },
      });
      if (sendError?.code === 'email_address_not_authorized') {
        setLoginError('O serviço de email ainda não está disponível para membros. Contacte o administrador.');
      } else if (sendError && sendError.status !== 400 && sendError.status !== 422) {
        setLoginError(sendError.status === 429 ? 'Demasiados pedidos. Aguarde antes de tentar novamente.' : 'Não foi possível enviar o link. Tente novamente mais tarde.');
      } else setSent(true);
      setCooldown(60);
    } catch { setLoginError('Ligação indisponível. Tente novamente.'); }
    finally { setBusy(false); }
  }

  if (!supabase) return <p role="status">Supabase indisponível. Configure o URL e a chave pública.</p>;
  if (loading) return <p role="status" className="py-8">A carregar...</p>;
  if (!session) return <section className="mt-8 border-y border-[#d6dfdc] py-8" aria-labelledby="login-heading">
    <h1 id="login-heading" className="text-2xl font-semibold">Área de membros</h1>
    <form className="mt-5 flex max-w-md flex-col gap-3" onSubmit={(event) => void sendLink(event)}>
      <label className="flex flex-col gap-1 text-sm">Email<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={busy} onChange={(event) => { setEmail(event.target.value); setSent(false); }} className="min-h-11 rounded border border-[#bdcfca] bg-white px-3 py-2 text-[#182628]" /></label>
      <button type="submit" className={`${button} self-start`} disabled={busy || cooldown > 0}><Mail size={18} />{busy ? 'A enviar...' : cooldown ? `Aguarde ${cooldown}s` : sent ? 'Reenviar link' : 'Enviar link de acesso'}</button>
    </form>
    {sent && <p role="status" className="mt-4 max-w-md text-sm text-[#52625f]">Se o email estiver autorizado, receberá um link de acesso. Verifique também a pasta de spam.</p>}
    {(loginError || error) && <p role="alert" className="mt-4 text-sm text-red-800">{loginError || error}</p>}
  </section>;
  const roles = admin ? ['owner', 'admin'] : ['owner', 'admin', 'musician'];
  if (error || !memberships.some((member) => member.roles.some((role) => roles.includes(role)))) return <section className="py-8">
    <h1 className="text-2xl font-semibold">{admin ? 'Administração' : 'Partituras'}</h1>
    <p role={error ? 'alert' : 'status'} className="mt-4 text-[#52625f]">{error ? `Não foi possível verificar o acesso: ${error}` : 'A sua conta não tem acesso a esta área. Contacte o administrador.'}</p>
    <button type="button" className={`${button} mt-4`} onClick={reload}><RefreshCw size={18} /> Verificar acesso</button>
  </section>;
  return <Fragment key={session.user.id}>{children}</Fragment>;
}