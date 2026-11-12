import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Check, FileMusic, ListMusic, Pencil, Play, Plus, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../utils/supabase';
import type { MusicSheet } from '../utils/musicPerformance';

export type RepertoireSong = { id: string; rhythm: string; title: string; artist: string; key_c: string; key_eb: string; video_url: string; audio_url: string; song_parts: { instrument: string; url: string }[] };
type Setlist = { id: string; title: string; setlist_songs: { song_id: string; position: number }[] };
type Draft = { id: string | null; title: string; songIds: string[] };
const control = 'min-h-11 rounded border border-[#bdcfca] bg-white px-3 py-2 text-sm text-[#182628] disabled:opacity-50';
const command = `${control} inline-flex items-center justify-center gap-2 hover:bg-[#e6efec]`;
const PerformanceReader = lazy(() => import('./PerformanceReader'));

export default function Setlists({ bandId, songs, sheets, songsLoading }: { bandId: string; songs: RepertoireSong[]; sheets: MusicSheet[]; songsLoading: boolean }) {
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [instrument, setInstrument] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [query, setQuery] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);
  const [reload, setReload] = useState(0);
  const [playing, setPlaying] = useState(false);
  const selected = setlists.find((setlist) => setlist.id === selectedId) ?? setlists[0];
  const songMap = new Map(songs.map((song) => [song.id, song]));
  const entries = selected ? [...selected.setlist_songs].sort((first, second) => first.position - second.position) : [];
  const instruments = [...new Set([...songs.flatMap((song) => song.song_parts.map((part) => part.instrument)), ...sheets.filter((sheet) => sheet.song_id).map((sheet) => sheet.instrument)])].sort();
  const availableSongs = songs.filter((song) => `${song.title} ${song.artist} ${song.rhythm}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    setLoading(true);
    setError('');
    void supabase.from('setlists').select('id, title, setlist_songs(song_id, position)').eq('band_id', bandId).order('created_at').then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(`Não foi possível carregar as setlists: ${loadError.message}`);
      else setSetlists((data ?? []) as Setlist[]);
      setLoading(false);
    });
    return () => { active = false; };
  }, [bandId, reload]);

  function editSetlist() {
    if (!selected) return;
    setDraft({ id: selected.id, title: selected.title, songIds: entries.map((entry) => entry.song_id) });
    setPendingDelete(false);
    setQuery('');
  }

  function moveSong(index: number, direction: number) {
    setDraft((current) => {
      if (!current) return current;
      const songIds = [...current.songIds];
      const destination = index + direction;
      if (destination < 0 || destination >= songIds.length) return current;
      [songIds[index], songIds[destination]] = [songIds[destination], songIds[index]];
      return { ...current, songIds };
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !draft || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: saveError } = await supabase.rpc('save_setlist', {
        target_band: bandId, target_setlist: draft.id, setlist_title: draft.title.trim(), song_ids: draft.songIds,
      });
      if (saveError) throw saveError;
      setSelectedId(data as string);
      setDraft(null);
      setReload((value) => value + 1);
    } catch (saveError) {
      setError(`Não foi possível guardar a setlist: ${saveError instanceof Error ? saveError.message : String((saveError as { message?: string }).message ?? saveError)}`);
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!supabase || !selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const { data, error: deleteError } = await supabase.from('setlists').delete().eq('id', selected.id).eq('band_id', bandId).select('id');
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error('Setlist indisponível ou sem permissão.');
      setSetlists((current) => current.filter((setlist) => setlist.id !== selected.id));
      setSelectedId('');
      setPendingDelete(false);
    } catch (deleteError) {
      setError(`Não foi possível eliminar a setlist: ${deleteError instanceof Error ? deleteError.message : String((deleteError as { message?: string }).message ?? deleteError)}`);
    } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="setlists-heading" className="mt-6 min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="setlists-heading" className="flex items-center gap-2 text-lg font-medium"><ListMusic size={22} /> Setlists</h2>
        {!draft && <button type="button" className={command} disabled={loading || busy || songsLoading} onClick={() => { setDraft({ id: null, title: '', songIds: [] }); setQuery(''); setPendingDelete(false); }}><Plus size={18} /> Nova setlist</button>}
      </div>
      {error && <div role="alert" className="mt-4 flex items-start justify-between gap-3 border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900"><span className="min-w-0 break-words">{error}</span><button type="button" aria-label="Fechar erro de setlist" title="Fechar erro" onClick={() => setError('')}><X size={18} /></button></div>}
      {loading || songsLoading ? <p role="status" className="py-8">A carregar setlists...</p> : error && !setlists.length && !draft ? <button type="button" className={`${command} mt-4`} onClick={() => setReload((value) => value + 1)}>Tentar novamente</button> : draft ? (
        <form onSubmit={(event) => void save(event)} className="mt-4 border-y border-[#d6dfdc] py-5">
          <fieldset disabled={busy} className="min-w-0">
            <label className="flex flex-col gap-1 text-sm">Nome da setlist<input autoFocus className={`${control} w-full`} required maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <div className="mt-5 grid min-w-0 gap-6 lg:grid-cols-2">
              <section aria-label="Ordem da setlist" className="min-w-0">
                <h3 className="font-medium">Ordem <span className="text-sm text-[#52625f]">({draft.songIds.length}/200)</span></h3>
                {!draft.songIds.length && <p className="py-6 text-sm text-[#52625f]">Nenhuma música selecionada.</p>}
                <ol className="mt-2 max-h-[32rem] overflow-y-auto divide-y divide-[#d6dfdc]">
                  {draft.songIds.map((id, index) => <li key={`${id}-${index}`} className="flex items-center gap-2 py-2"><span className="w-6 shrink-0 text-sm tabular-nums text-[#52625f]">{index + 1}.</span><span className="min-w-0 flex-1 break-words text-sm">{songMap.get(id)?.title ?? 'Música indisponível'}</span><div className="flex shrink-0 gap-1"><button type="button" className={`${command} px-2`} title={`Subir música ${index + 1}`} aria-label={`Subir música ${index + 1}`} disabled={busy || index === 0} onClick={() => moveSong(index, -1)}><ArrowUp size={16} /></button><button type="button" className={`${command} px-2`} title={`Descer música ${index + 1}`} aria-label={`Descer música ${index + 1}`} disabled={busy || index === draft.songIds.length - 1} onClick={() => moveSong(index, 1)}><ArrowDown size={16} /></button><button type="button" className={`${command} px-2`} title={`Remover música ${index + 1}`} aria-label={`Remover música ${index + 1}`} onClick={() => setDraft({ ...draft, songIds: draft.songIds.filter((_, position) => position !== index) })}><X size={16} /></button></div></li>)}
                </ol>
              </section>
              <section aria-label="Adicionar músicas" className="min-w-0">
                <label className="relative block"><Search className="absolute left-3 top-3 text-[#52625f]" size={18} /><input type="search" aria-label="Pesquisar músicas para a setlist" placeholder="Pesquisar músicas" className={`${control} w-full pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                {!availableSongs.length && <p className="py-6 text-sm text-[#52625f]">Nenhuma música encontrada.</p>}
                <ul className="mt-2 max-h-[32rem] overflow-y-auto divide-y divide-[#d6dfdc]">{availableSongs.map((song) => <li key={song.id} className="flex items-center justify-between gap-3 py-2"><div className="min-w-0 text-sm"><p className="break-words font-medium">{song.title}</p><p className="break-words text-[#52625f]">{song.artist}</p></div><button type="button" className={`${command} shrink-0`} title={`Adicionar ${song.title}`} aria-label={`Adicionar ${song.title}`} disabled={busy || draft.songIds.length >= 200} onClick={() => setDraft({ ...draft, songIds: [...draft.songIds, song.id] })}><Plus size={18} /></button></li>)}</ul>
              </section>
            </div>
            <div className="mt-5 flex flex-wrap gap-2"><button type="submit" className={`${command} font-medium`} disabled={busy || !draft.title.trim() || !draft.songIds.length}><Check size={18} />{busy ? 'A guardar...' : 'Guardar setlist'}</button><button type="button" className={command} onClick={() => setDraft(null)}><X size={18} /> Cancelar</button></div>
          </fieldset>
        </form>
      ) : !selected ? <p className="py-8 text-[#52625f]">Ainda não há setlists.</p> : <>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 basis-full flex-col gap-1 text-sm sm:basis-72">Setlist<select className={`${control} w-full min-w-0`} value={selected.id} disabled={busy} onChange={(event) => { setSelectedId(event.target.value); setPendingDelete(false); }}>{setlists.map((setlist) => <option key={setlist.id} value={setlist.id}>{setlist.title}</option>)}</select></label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm sm:max-w-52">Instrumento<select className={`${control} w-full`} value={instrument} onChange={(event) => setInstrument(event.target.value)}><option value="">Todos</option>{instruments.map((name) => <option key={name}>{name}</option>)}</select></label>
          <button type="button" className={command} title="Editar setlist" aria-label="Editar setlist" disabled={busy} onClick={editSetlist}><Pencil size={18} /></button>
          <button type="button" className={command} title="Eliminar setlist" aria-label="Eliminar setlist" disabled={busy} onClick={() => setPendingDelete(true)}><Trash2 size={18} /></button>
          <button type="button" className={`${command} font-medium`} disabled={!entries.length} onClick={() => setPlaying(true)}><Play size={18} /> Tocar setlist</button>
        </div>
        {pendingDelete && <div role="alert" className="mt-4 border-l-4 border-red-600 bg-white p-4"><p className="break-words">Eliminar "{selected.title}"? As músicas permanecem no repertório.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={command} disabled={busy} onClick={() => void remove()}><Trash2 size={18} /> Eliminar</button><button type="button" className={command} disabled={busy} onClick={() => setPendingDelete(false)}>Cancelar</button></div></div>}
        <div className="mt-6 border-b border-[#bdcfca] pb-3"><h3 className="break-words text-xl font-semibold">{selected.title}</h3><p className="mt-1 text-sm text-[#52625f]">{entries.length} músicas</p></div>
        {!entries.length && <p className="py-8 text-[#52625f]">Esta setlist não tem músicas.</p>}
        <ol className="divide-y divide-[#d6dfdc]">{entries.map((entry) => {
          const song = songMap.get(entry.song_id);
          const parts = song?.song_parts.filter((part) => !instrument || part.instrument === instrument) ?? [];
          return <li key={entry.position} className="flex gap-3 py-4 sm:gap-4"><span className="w-7 shrink-0 pt-1 text-right text-lg tabular-nums text-[#52625f]">{entry.position}.</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"><h4 className="min-w-0 break-words font-semibold">{song?.title ?? 'Música indisponível'}</h4>{song && <span className="text-sm text-[#52625f]">{[song.key_c, song.key_eb].filter(Boolean).join(' / ')}</span>}</div>{song && <p className="mt-1 break-words text-sm text-[#52625f]">{[song.artist, song.rhythm].filter(Boolean).join(' · ')}</p>}<div className="mt-3 flex flex-wrap gap-2">{parts.map((part) => <a key={part.instrument} className={command} href={part.url} target="_blank" rel="noopener noreferrer" aria-label={`${song?.title}: ${part.instrument}`}><FileMusic size={18} />{part.instrument}</a>)}{!parts.length && <span className="py-2 text-sm text-[#52625f]">{instrument ? `Sem partitura para ${instrument}.` : 'Sem partituras.'}</span>}</div>{song && (song.video_url || song.audio_url) && <div className="mt-2 flex flex-wrap gap-x-4 text-sm">{song.video_url && <a className="inline-flex min-h-11 items-center underline" href={song.video_url} target="_blank" rel="noopener noreferrer">Vídeo</a>}{song.audio_url && <a className="inline-flex min-h-11 items-center underline" href={song.audio_url} target="_blank" rel="noopener noreferrer">Spotify</a>}</div>}</div></li>;
        })}</ol>
      </>}
      {playing && selected && <Suspense fallback={<p role="status" className="py-4">A abrir modo de palco...</p>}><PerformanceReader bandId={bandId} setlistId={selected.id} title={selected.title} entries={entries.map((entry) => ({ songId: entry.song_id, position: entry.position, title: songMap.get(entry.song_id)?.title ?? 'Música indisponível' }))} songs={songs} sheets={sheets} instruments={instruments} initialInstrument={instrument} onClose={() => setPlaying(false)} /></Suspense>}
    </section>
  );
}