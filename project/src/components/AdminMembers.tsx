import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, UserPlus } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth';

type Member = { user_id: string; email: string; roles: string[]; confirmed: boolean };
const control = 'min-h-11 rounded border border-[#bdcfca] bg-white px-3 py-2 text-sm text-[#182628] disabled:opacity-50';
const button = `${control} inline-flex items-center justify-center gap-2 hover:bg-[#e6efec]`;

async function memberRequest(body: object) {
  if (!supabase) throw new Error('Supabase indisponível.');
  const { data, error } = await supabase.functions.invoke('workspace-members', { body });
  if (error) {
    let detail = 'Não foi possível contactar o serviço de membros. Verifique a configuração e tente novamente.';
    if (error.context instanceof Response) {
      try { detail = (await error.context.json()).error ?? detail; }
      catch { detail = 'Resposta indisponível do serviço de membros. Tente novamente.'; }
    }
    throw new Error(detail);
  }
  return data;
}

export default function AdminMembers() {
  const { memberships } = useWorkspaceAuth();
  const bands = memberships.filter((member) => member.roles.some((role) => ['owner', 'admin'].includes(role)));
  const [chosenBand, setChosenBand] = useState('');
  const bandId = bands.find((member) => member.band_id === chosenBand)?.band_id ?? bands[0]?.band_id ?? '';
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [listing, setListing] = useState<{ bandId: string; page: number; members: Member[]; more: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const current = listing?.bandId === bandId && listing.page === page ? listing : null;

  useEffect(() => {
    if (!bandId) return;
    let active = true;
    setLoading(true);
    setError('');
    void memberRequest({ action: 'list', band_id: bandId, offset: page * 50 }).then((data) => {
      if (active) setListing({ bandId, page, members: data.members, more: data.has_more });
    }).catch((loadError: Error) => {
      if (active) { setError(loadError.message); setListing(null); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bandId, page, revision]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !bandId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await memberRequest({ action: 'invite', band_id: bandId, email: email.trim().toLowerCase() });
      setNotice(result.invitation_sent ? 'Membro aprovado. Convite enviado por email.' : 'Conta existente aprovada. O membro pode pedir um link de acesso.');
      setEmail('');
      setRevision((value) => value + 1);
    } catch (inviteError) { setError(inviteError instanceof Error ? inviteError.message : 'Não foi possível enviar o convite.'); }
    finally { setBusy(false); }
  }

  return <section className="mt-8" aria-labelledby="members-heading">
    <h2 id="members-heading" className="text-xl font-medium">Membros</h2>
    <label className="mt-4 flex max-w-sm flex-col gap-1 text-sm">Banda<select className={control} value={bandId} disabled={busy} onChange={(event) => { setChosenBand(event.target.value); setPage(0); setNotice(''); setEmail(''); }}>{bands.map((band) => <option key={band.band_id} value={band.band_id}>{band.bands?.name ?? band.band_id}</option>)}</select></label>
    <form className="mt-6 flex flex-wrap items-end gap-3 border-y border-[#d6dfdc] py-6" onSubmit={(event) => void invite(event)}>
      <label className="flex w-full max-w-md flex-col gap-1 text-sm">Email do novo membro<input type="email" required maxLength={254} autoComplete="off" className={control} value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} /></label>
      <button className={button} type="submit" disabled={busy || !email.trim()}><UserPlus size={18} />{busy ? 'A convidar...' : 'Convidar músico'}</button>
    </form>
    {error && <p role="alert" className="mt-4 wrap-break-word border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-[#39736b]">{notice}</p>}
    <div className="mt-6 flex items-center justify-between gap-3"><h3 className="font-medium">Membros aprovados</h3><button type="button" title="Atualizar membros" aria-label="Atualizar membros" className={button} disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={18} /></button></div>
    {loading ? <p role="status" className="py-6">A carregar membros...</p> : !current?.members.length ? <p className="py-6 text-[#52625f]">{error ? 'Lista indisponível.' : 'Nenhum membro nesta página.'}</p> : <ul className="mt-3 divide-y divide-[#d6dfdc]">{current.members.map((member) => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 py-4"><span className="min-w-0 break-all font-medium">{member.email}</span><span className="text-sm text-[#52625f]">{member.roles.join(', ')} · {member.confirmed ? 'Ativo' : 'Convite pendente'}</span></li>)}</ul>}
    <div className="mt-3 flex items-center justify-end gap-3"><button type="button" className={button} disabled={loading || busy || page === 0} title="Página anterior" aria-label="Página anterior" onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button><span className="text-sm">Página {page + 1}</span><button type="button" className={button} disabled={loading || busy || !current?.more} title="Página seguinte" aria-label="Página seguinte" onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button></div>
  </section>;
}