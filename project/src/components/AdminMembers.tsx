import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, UserPlus, X } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { workspaceEmail, workspaceUsername } from '../utils/workspaceIdentity';
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth';

const emptyProfile = { name: '', birth_date: '', shirt_size: '', instrument: '', address: '', phone: '', emergency_contact: '', instagram: '', food_allergies: '' };
type Member = { user_id: string | null; profile_id?: string | null; email: string; roles: string[]; active: boolean; confirmed: boolean; submitted_at?: string | null } & Partial<Record<keyof typeof emptyProfile, string | null>>;
type MemberCommand = { action: 'list'; band_id: string; offset: number }
  | { action: 'set_active'; band_id: string; user_id: string; active: boolean }
  | { action: 'create'; band_id: string; email: string; password: string; profile: typeof emptyProfile };
const profileColumns = [
  { field: 'submitted_at', label: 'Timestamp', width: 'w-44' },
  { field: 'name', label: 'Nome', width: 'w-48' },
  { field: 'birth_date', label: 'Data de Nascimento', width: 'w-36' },
  { field: 'shirt_size', label: 'Tamanho de camisa', width: 'w-28' },
  { field: 'instrument', label: 'Instrumento', width: 'w-36' },
  { field: 'address', label: 'Endereço', width: 'w-72' },
  { field: 'phone', label: 'Telefone', width: 'w-36' },
  { field: 'emergency_contact', label: 'Contato de Emergência', width: 'w-60' },
  { field: 'email', label: 'e-mail', width: 'w-64' },
  { field: 'instagram', label: '@ Instagram', width: 'w-40' },
  { field: 'food_allergies', label: 'Alguma alergia alimentar?', width: 'w-60' },
] as const;
const profileInputs = [
  { field: 'name', label: 'Nome', type: 'text', limit: 160 },
  { field: 'birth_date', label: 'Data de Nascimento', type: 'date', limit: 10 },
  { field: 'instrument', label: 'Instrumento', type: 'text', limit: 100 },
  { field: 'address', label: 'Endereço', type: 'text', limit: 1000 },
  { field: 'phone', label: 'Telefone', type: 'tel', limit: 100 },
  { field: 'emergency_contact', label: 'Contato de Emergência', type: 'text', limit: 500 },
  { field: 'instagram', label: '@ Instagram', type: 'text', limit: 160 },
  { field: 'food_allergies', label: 'Alguma alergia alimentar?', type: 'text', limit: 1000 },
] as const;
const control = 'min-h-11 rounded border border-[#bdcfca] bg-white px-3 py-2 text-sm text-[#182628] disabled:opacity-50';
const button = `${control} inline-flex items-center justify-center gap-2 hover:bg-[#e6efec]`;

function profileValue(member: Member, field: typeof profileColumns[number]['field']) {
  const value = member[field];
  if (!value) return field === 'name' ? workspaceUsername(member.email) : '-';
  if (field === 'birth_date') return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
  if (field === 'submitted_at') return value.replace('T', ' ');
  return value;
}

async function memberRequest(body: MemberCommand) {
  if (!supabase) throw new Error('Supabase indisponível.');
  if (body.action === 'list') {
    const { data, error } = await supabase.rpc('get_workspace_members', { target_band: body.band_id, page_start: body.offset });
    if (error) throw new Error(error.code === 'PGRST202' ? 'Aplique a migração de membros ativos no Supabase para carregar a lista.' : error.message);
    return data;
  }
  if (body.action === 'set_active') {
    const { error } = await supabase.rpc('update_workspace_member_active', { target_band: body.band_id, target_user: body.user_id, enabled: body.active });
    if (error) throw new Error(error.message);
    return { updated: true, active: body.active };
  }
  const { data, error } = await supabase.functions.invoke('workspace-members', { body });
  if (error) {
    let detail = `Não foi possível contactar o serviço de membros. Verifique a função workspace-members e a origem permitida ${window.location.origin}.`;
    if (error.context instanceof Response) {
      try { detail = (await error.context.json()).error ?? detail; }
      catch { detail = 'Resposta indisponível do serviço de membros. Tente novamente.'; }
    }
    throw new Error(detail);
  }
  return data;
}

export default function AdminMembers() {
  const { memberships, session } = useWorkspaceAuth();
  const bands = memberships.filter((member) => member.roles.some((role) => ['owner', 'admin'].includes(role)));
  const [chosenBand, setChosenBand] = useState('');
  const bandId = bands.find((member) => member.band_id === chosenBand)?.band_id ?? bands[0]?.band_id ?? '';
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [listing, setListing] = useState<{ bandId: string; page: number; members: Member[]; more: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState({ ...emptyProfile });
  const [addingMember, setAddingMember] = useState(false);
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

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !bandId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await memberRequest({ action: 'create', band_id: bandId, email: workspaceEmail(email), password, profile });
      setNotice(result.account_created ? 'Membro criado e aprovado.' : 'Conta existente aprovada. A palavra-passe existente foi mantida.');
      setEmail('');
      setPassword('');
      setProfile({ ...emptyProfile });
      setAddingMember(false);
      setRevision((value) => value + 1);
    } catch (createError) { setError(createError instanceof Error ? createError.message : 'Não foi possível criar o membro.'); }
    finally { setBusy(false); }
  }

  async function setMemberActive(member: Member, active: boolean) {
    if (!member.user_id || busy || !bandId) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await memberRequest({ action: 'set_active', band_id: bandId, user_id: member.user_id, active });
      setListing((value) => value?.bandId === bandId ? { ...value, members: value.members.map((row) => row.user_id === member.user_id ? { ...row, active } : row) } : value);
    } catch (updateError) { setError(updateError instanceof Error ? updateError.message : 'Não foi possível atualizar o estado do membro.'); }
    finally { setBusy(false); }
  }

  return <section className="mt-8" aria-labelledby="members-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="members-heading" className="text-xl font-medium">Membros</h2><button type="button" className={button} disabled={busy || !bandId || addingMember} aria-expanded={addingMember} aria-controls="add-member-form" onClick={() => setAddingMember(true)}><UserPlus size={18} /> Adicionar membro</button></div>
    <label className="mt-4 flex max-w-sm flex-col gap-1 text-sm">Banda<select className={control} value={bandId} disabled={busy} onChange={(event) => { setChosenBand(event.target.value); setPage(0); setNotice(''); setEmail(''); setPassword(''); setProfile({ ...emptyProfile }); setAddingMember(false); }}>{bands.map((band) => <option key={band.band_id} value={band.band_id}>{band.bands?.name ?? band.band_id}</option>)}</select></label>
    {addingMember && <form id="add-member-form" className="mt-6 grid min-w-0 gap-4 border-y border-[#d6dfdc] py-6 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => void createMember(event)}>
      {profileInputs.map((input) => <label key={input.field} className="flex min-w-0 flex-col gap-1 text-sm">{input.label}<input type={input.type} required={input.field === 'name'} maxLength={input.limit} autoComplete="off" className={`${control} w-full min-w-0`} value={profile[input.field]} disabled={busy} onChange={(event) => setProfile((value) => ({ ...value, [input.field]: event.target.value }))} /></label>)}
      <label className="flex min-w-0 flex-col gap-1 text-sm">Tamanho de camisa<select className={control} value={profile.shirt_size} disabled={busy} onChange={(event) => setProfile((value) => ({ ...value, shirt_size: event.target.value }))}><option value="">-</option>{['PP', 'P', 'M', 'G', 'GG', 'XG'].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">e-mail / Utilizador<input type="text" required maxLength={254} autoComplete="off" autoCapitalize="none" spellCheck={false} className={`${control} w-full min-w-0`} value={email} disabled={busy} onChange={(event) => setEmail(event.target.value)} /></label>
      <label className="flex min-w-0 flex-col gap-1 text-sm">Palavra-passe<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={`${control} w-full min-w-0`} value={password} disabled={busy} onChange={(event) => setPassword(event.target.value)} /></label>
      <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-3"><button className={button} type="submit" disabled={busy || !email.trim() || !profile.name.trim() || password.length < 8}><UserPlus size={18} />{busy ? 'A criar...' : 'Criar músico'}</button><button type="button" className={button} disabled={busy} onClick={() => { setAddingMember(false); setEmail(''); setPassword(''); setProfile({ ...emptyProfile }); }}><X size={18} /> Cancelar</button></div>
    </form>}
    {error && <p role="alert" className="mt-4 wrap-break-word border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-[#39736b]">{notice}</p>}
    <div className="mt-6 flex items-center justify-between gap-3"><h3 className="font-medium">Membros aprovados</h3><button type="button" title="Atualizar membros" aria-label="Atualizar membros" className={button} disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={18} /></button></div>
    <div className="mt-3 max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela de membros">
    <table className="w-full min-w-[2352px] table-fixed border-collapse text-left text-sm" aria-label="Membros aprovados" aria-busy={loading}>
      <colgroup>{profileColumns.map((column) => <col key={column.field} className={column.width} />)}<col className="w-24" /><col className="w-40" /></colgroup>
      <thead className="border-y border-[#d6dfdc] text-[#52625f]"><tr>{profileColumns.map((column) => <th key={column.field} scope="col" className="px-2 py-3 font-medium">{column.label}</th>)}<th scope="col" className="px-2 py-3 font-medium">Ativo</th><th scope="col" className="px-2 py-3 font-medium">Acesso</th></tr></thead>
      <tbody className="divide-y divide-[#d6dfdc]">
        {loading || !current?.members.length ? <tr><td colSpan={profileColumns.length + 2} className="px-2 py-6 text-[#52625f]"><span role={error ? 'alert' : 'status'}>{loading ? 'A carregar membros...' : error ? 'Lista indisponível.' : page === 0 ? 'Ainda não há membros.' : 'Nenhum membro nesta página.'}</span></td></tr> : current.members.map((member) => <tr key={member.profile_id ?? member.user_id ?? member.email}>{profileColumns.map((column) => <td key={column.field} className="wrap-break-word px-2 py-4 align-top">{profileValue(member, column.field)}</td>)}<td className="px-2 py-4 align-top"><input type="checkbox" className="h-5 w-5 cursor-pointer accent-[#39736b] disabled:cursor-not-allowed" aria-label={`Ativo: ${member.name || workspaceUsername(member.email)}`} title={!member.user_id ? 'Sem conta de acesso' : member.user_id === session?.user.id ? 'Não pode desativar a sua própria conta' : 'Estado de acesso do membro'} checked={member.active} disabled={busy || !member.user_id || member.user_id === session?.user.id} onChange={(event) => void setMemberActive(member, event.target.checked)} /></td><td className="wrap-break-word px-2 py-4 align-top text-[#52625f]">{member.user_id ? `${member.roles.join(', ')} · ${member.active ? member.confirmed ? 'Ativo' : 'Por configurar' : 'Inativo'}` : 'Sem acesso'}</td></tr>)}
      </tbody>
    </table>
    </div>
    <div className="mt-3 flex items-center justify-end gap-3"><button type="button" className={button} disabled={loading || busy || page === 0} title="Página anterior" aria-label="Página anterior" onClick={() => setPage((value) => value - 1)}><ChevronLeft size={18} /></button><span className="text-sm">Página {page + 1}</span><button type="button" className={button} disabled={loading || busy || !current?.more} title="Página seguinte" aria-label="Página seguinte" onClick={() => setPage((value) => value + 1)}><ChevronRight size={18} /></button></div>
  </section>;
}