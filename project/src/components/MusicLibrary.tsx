import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Download, FileMusic, Search, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth';
import Setlists, { type RepertoireSong } from './Setlists';
import type { MusicSheet } from '../utils/musicPerformance';

type Sheet = MusicSheet;
type Song = RepertoireSong;
const bucket = 'music-sheets';
const maxSize = 20 * 1024 * 1024;
const control = 'min-h-11 rounded border border-[#bdcfca] bg-white px-3 py-2 text-sm text-[#182628] disabled:opacity-50';
const command = `${control} inline-flex items-center justify-center gap-2 hover:bg-[#e6efec]`;

function message(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir o pedido.';
}

function SheetAttachment({ sheet, songs, busy, onSave }: { sheet: Sheet; songs: Song[]; busy: boolean; onSave: (sheet: Sheet, songId: string, instrument: string) => Promise<void> }) {
  const [songId, setSongId] = useState(sheet.song_id ?? '');
  const [instrument, setInstrument] = useState(sheet.instrument);
  const changed = songId !== (sheet.song_id ?? '') || instrument !== sheet.instrument;
  return <form className="grid w-full min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={(event) => { event.preventDefault(); void onSave(sheet, songId, instrument); }}>
    <label className="flex min-w-0 flex-col gap-1 text-sm">Música associada<select className={`${control} w-full min-w-0`} value={songId} disabled={busy} onChange={(event) => setSongId(event.target.value)}><option value="">Sem associação</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select></label>
    <label className="flex min-w-0 flex-col gap-1 text-sm">Instrumento do PDF<input className={`${control} w-full`} list="music-instruments" value={instrument} maxLength={100} required={Boolean(songId)} disabled={busy} onChange={(event) => setInstrument(event.target.value)} /></label>
    <button className={`${command} self-end`} type="submit" disabled={busy || !changed || Boolean(songId && !instrument.trim())}>Guardar associação</button>
  </form>;
}

export default function MusicLibrary() {
  const { session, memberships: allMemberships } = useWorkspaceAuth();
  const memberships = allMemberships.filter((member) => member.roles.some((role) => ['owner', 'admin', 'musician'].includes(role)));
  const [loading, setLoading] = useState(false);
  const [bandId, setBandId] = useState(memberships[0]?.band_id ?? '');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songsLoading, setSongsLoading] = useState(true);
  const [musicView, setMusicView] = useState<'setlists' | 'repertoire' | 'sheets'>('setlists');
  const [songQuery, setSongQuery] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [viewer, setViewer] = useState<{ sheet: Sheet; url: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Sheet | null>(null);
  const [title, setTitle] = useState('');
  const [instrument, setInstrument] = useState('');
  const [songId, setSongId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const operation = useRef(0);
  const member = memberships.find((item) => item.band_id === bandId);
  const canEdit = member?.roles.some((role) => ['owner', 'admin', 'musician'].includes(role)) ?? false;
  const visibleSheets = sheets.filter((sheet) => `${sheet.title} ${sheet.instrument} ${sheet.file_name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));

  useEffect(() => {
    let active = true;
    operation.current += 1;
    setSheets([]);
    setSongs([]);
    setViewer(null);
    setPendingDelete(null);
    if (!supabase || !bandId || !canEdit) return;
    setLoading(true);
    setSongsLoading(true);
    void supabase.from('music_sheets').select('*').eq('band_id', bandId).order('title').then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) setError(`Não foi possível carregar as partituras: ${loadError.message}`);
      setSheets((data ?? []) as Sheet[]);
      setLoading(false);
    });
    void supabase.from('songs').select('*, song_parts(instrument, url)').eq('band_id', bandId).order('sort_order').then(({ data, error: songError }) => {
      if (!active) return;
      if (songError) setError(`Não foi possível carregar o repertório: ${songError.message}`);
      setSongs((data ?? []) as Song[]);
      setSongsLoading(false);
    });
    return () => { active = false; };
  }, [bandId, canEdit, refresh]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !session || !file || !canEdit || busy) return;
    setBusy(true);
    setError('');
    const currentOperation = operation.current;
    try {
      if (!title.trim() || title.trim().length > 160 || instrument.trim().length > 100) throw new Error('Verifique o título e o instrumento.');
      if (songId && !instrument.trim()) throw new Error('Escolha o instrumento da partitura.');
      if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf') || file.size > maxSize || file.size < 5) throw new Error('Escolha um PDF até 20 MB.');
      const signature = await file.slice(0, 5).text();
      if (signature !== '%PDF-') throw new Error('O ficheiro não tem um cabeçalho PDF válido.');
      const id = crypto.randomUUID();
      const path = `${bandId}/${id}.pdf`;
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;
      const { error: saveError } = await supabase.from('music_sheets').insert({ id, band_id: bandId, song_id: songId || null, title: title.trim(), instrument: instrument.trim(), file_name: file.name, file_size: file.size, storage_path: path, uploaded_by: session.user.id });
      if (saveError) {
        const { error: cleanupError } = await supabase.storage.from(bucket).remove([path]);
        if (cleanupError) throw new Error(`${saveError.message} O ficheiro ficou no armazenamento; peça a um administrador para o remover.`);
        throw saveError;
      }
      if (currentOperation === operation.current) {
        setTitle(''); setInstrument(''); setSongId(''); setFile(null);
        if (inputRef.current) inputRef.current.value = '';
        setRefresh((value) => value + 1);
      }
    } catch (uploadError) { setError(message(uploadError)); }
    finally { setBusy(false); }
  }

  async function openSheet(sheet: Sheet, download = false) {
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    const currentOperation = operation.current;
    const { data, error: openError } = await supabase.storage.from(bucket).createSignedUrl(sheet.storage_path, 300, download ? { download: sheet.file_name } : undefined);
    if (currentOperation === operation.current) {
      if (openError) setError(openError.message);
      else if (download) {
        const anchor = document.createElement('a');
        anchor.href = data.signedUrl;
        anchor.rel = 'noopener noreferrer';
        anchor.click();
      } else setViewer({ sheet, url: data.signedUrl });
    }
    setBusy(false);
  }

  async function attachSheet(sheet: Sheet, targetSong: string, targetInstrument: string) {
    if (!supabase || busy) return;
    setBusy(true);
    setError('');
    const currentOperation = operation.current;
    try {
      const { data, error: attachError } = await supabase.from('music_sheets')
        .update({ song_id: targetSong || null, instrument: targetInstrument.trim() })
        .eq('id', sheet.id).eq('band_id', bandId).select('*').single();
      if (attachError) throw new Error(attachError.code === '23505' ? 'Esta música já tem um PDF para esse instrumento. Desassocie o anterior antes de o substituir.' : attachError.message);
      if (currentOperation === operation.current) setSheets((current) => current.map((item) => item.id === sheet.id ? data as Sheet : item));
    } catch (attachError) { if (currentOperation === operation.current) setError(message(attachError)); }
    finally { setBusy(false); }
  }

  async function removeSheet() {
    if (!supabase || !pendingDelete || busy) return;
    setBusy(true);
    setError('');
    try {
      const { error: storageError } = await supabase.storage.from(bucket).remove([pendingDelete.storage_path]);
      if (storageError) throw storageError;
      const { error: deleteError } = await supabase.from('music_sheets').delete().eq('id', pendingDelete.id).eq('band_id', pendingDelete.band_id);
      if (deleteError) throw new Error(`${deleteError.message} O PDF foi removido; tente novamente para remover o registo.`);
      setPendingDelete(null);
      setRefresh((value) => value + 1);
    } catch (deleteError) { setError(message(deleteError)); }
    finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="music-heading" className="[&_button]:cursor-pointer [&_button:disabled]:cursor-wait [&_input]:max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-sm font-medium uppercase text-[#39736b]">Sardinhas Nômades</p><h1 id="music-heading" className="mt-2 text-3xl font-semibold">Música</h1></div>
      </div>
      {error && <div role="alert" className="mt-5 flex items-start justify-between gap-3 border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900"><span className="min-w-0 break-words">{error}</span><button type="button" aria-label="Fechar erro" title="Fechar erro" onClick={() => setError('')}><X size={18} /></button></div>}
      {!supabase ? <p role="status" className="mt-8">Supabase indisponível. Configure o URL e a chave pública e reinicie o servidor.</p>
        : loading ? <p role="status" className="mt-8">A carregar...</p>
        : !memberships.length ? <p role="status" className="mt-8">A sua conta ainda não tem acesso a uma banda. Contacte o administrador.</p>
        : <>
          <label className="mt-6 flex max-w-sm flex-col gap-1 text-sm">Banda<select className={control} value={bandId} disabled={busy} onChange={(event) => setBandId(event.target.value)}>{memberships.map((item) => <option key={item.band_id} value={item.band_id}>{item.bands?.name ?? item.band_id}</option>)}</select></label>
          {!canEdit ? <p role="status" className="mt-8">Não tem permissão para aceder às partituras desta banda.</p> : <>
            <div aria-label="Biblioteca musical" className="mt-6 flex flex-wrap gap-1 border-b border-[#bdcfca] pb-2">
              {([{ id: 'setlists', label: 'Setlists' }, { id: 'repertoire', label: 'Repertório' }, { id: 'sheets', label: 'PDFs' }] as const).map((view) => <button key={view.id} type="button" aria-pressed={musicView === view.id} aria-controls={`music-${view.id}`} className={`${command} ${musicView === view.id ? 'bg-[#dcece7] font-semibold' : ''}`} onClick={() => setMusicView(view.id)}>{view.label}</button>)}
            </div>
            <div id="music-setlists" hidden={musicView !== 'setlists'}><Setlists key={bandId} bandId={bandId} songs={songs} sheets={sheets} songsLoading={songsLoading} /></div>
            <div id="music-repertoire" hidden={musicView !== 'repertoire'}>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-medium">Repertório <span className="text-sm text-[#52625f]">({songs.length})</span></h2><label className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 text-[#52625f]" size={18} /><input type="search" aria-label="Pesquisar repertório" placeholder="Pesquisar repertório" className={`${control} w-full pl-10`} value={songQuery} onChange={(event) => setSongQuery(event.target.value)} /></label></div>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[40rem] text-left text-sm"><thead><tr className="border-b border-[#bdcfca] text-[#52625f]"><th className="py-2 pr-3">Ritmo</th><th className="py-2 pr-3">Música</th><th className="py-2 pr-3">Tom (C / Eb)</th><th className="py-2 pr-3">Partituras</th><th className="py-2">Ouvir</th></tr></thead><tbody>{songs.filter((song) => `${song.rhythm} ${song.title} ${song.artist}`.toLocaleLowerCase().includes(songQuery.toLocaleLowerCase())).map((song) => <tr key={song.id} className="border-b border-[#d6dfdc] align-top"><td className="py-2 pr-3">{song.rhythm}</td><td className="py-2 pr-3"><span className="font-medium">{song.title}</span>{song.artist && <span className="block text-[#52625f]">{song.artist}</span>}</td><td className="py-2 pr-3">{[song.key_c, song.key_eb].filter(Boolean).join(' / ')}</td><td className="py-2 pr-3"><span className="flex flex-wrap gap-x-3">{song.song_parts.map((part) => <a key={part.instrument} className="underline" href={part.url} target="_blank" rel="noopener noreferrer">{part.instrument}</a>)}</span></td><td className="py-2"><span className="flex flex-wrap gap-x-3">{song.video_url && <a className="underline" href={song.video_url} target="_blank" rel="noopener noreferrer">Vídeo</a>}{song.audio_url && <a className="underline" href={song.audio_url} target="_blank" rel="noopener noreferrer">Spotify</a>}</span></td></tr>)}</tbody></table></div>
            </div>
            <div id="music-sheets" hidden={musicView !== 'sheets'}>
            <form onSubmit={(event) => void upload(event)} className="mt-8 border-y border-[#d6dfdc] py-6">
              <h2 className="mb-4 text-lg font-medium">Adicionar partitura</h2>
              <datalist id="music-instruments">{['Sax Alto', 'Trompete', 'Trombone', 'Sax Tenor'].map((name) => <option key={name} value={name} />)}</datalist>
              <fieldset disabled={busy} className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex min-w-0 flex-col gap-1 text-sm">Música<select className={`${control} w-full min-w-0`} value={songId} onChange={(event) => { setSongId(event.target.value); if (!title.trim()) setTitle(songs.find((song) => song.id === event.target.value)?.title ?? ''); }}><option value="">Sem associação</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}</select></label>
                <label className="flex min-w-0 flex-col gap-1 text-sm">Título<input className={control} value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} /></label>
                <label className="flex min-w-0 flex-col gap-1 text-sm">Instrumento<input className={control} list="music-instruments" value={instrument} onChange={(event) => setInstrument(event.target.value)} required={Boolean(songId)} maxLength={100} /></label>
                <label className="flex min-w-0 flex-col gap-1 text-sm">PDF (até 20 MB)<input ref={inputRef} className={`${control} w-full file:mr-2 file:cursor-pointer`} type="file" accept="application/pdf,.pdf" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
                <button className={`${command} self-end`} type="submit" disabled={busy || !file || !title.trim()}><Upload size={18} /> Carregar</button>
              </fieldset>
            </form>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-4"><h2 className="text-lg font-medium">Biblioteca <span className="text-sm text-[#52625f]">({sheets.length})</span></h2><label className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 text-[#52625f]" size={18} /><input type="search" aria-label="Pesquisar partituras" placeholder="Pesquisar partituras" className={`${control} w-full pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
            {!visibleSheets.length ? <p className="py-10 text-[#52625f]">{query ? 'Nenhuma partitura encontrada.' : 'Ainda não há partituras.'}</p> : <ul className="mt-4 divide-y divide-[#d6dfdc]">{visibleSheets.map((sheet) => <li key={sheet.id} className="flex flex-wrap items-center justify-between gap-4 py-4"><div className="flex min-w-0 flex-1 items-center gap-3"><FileMusic size={28} className="shrink-0 text-[#39736b]" /><div className="min-w-0"><button type="button" className="break-words text-left font-medium underline-offset-4 hover:underline" onClick={() => void openSheet(sheet)} disabled={busy}>{sheet.title}</button><p className="break-words text-sm text-[#52625f]">{sheet.instrument || 'Geral'} · {(sheet.file_size / 1024 / 1024).toFixed(1)} MB</p></div></div><div className="flex shrink-0 gap-2"><button type="button" className={command} disabled={busy} title={`Descarregar ${sheet.title}`} aria-label={`Descarregar ${sheet.title}`} onClick={() => void openSheet(sheet, true)}><Download size={18} /></button><button type="button" className={command} disabled={busy} title={`Eliminar ${sheet.title}`} aria-label={`Eliminar ${sheet.title}`} onClick={() => setPendingDelete(sheet)}><Trash2 size={18} /></button></div></li>)}</ul>}
            <section aria-label="Associar PDFs a músicas" className="mt-6 space-y-5">{visibleSheets.map((sheet) => <div key={`${sheet.id}-${sheet.song_id}-${sheet.instrument}`} className="border-t border-[#d6dfdc] pt-4"><h3 className="mb-2 break-words font-medium">{sheet.title}</h3><SheetAttachment sheet={sheet} songs={songs} busy={busy} onSave={attachSheet} /></div>)}</section>
            {pendingDelete && <div role="alert" className="mt-5 border-l-4 border-red-600 bg-white p-4"><p className="break-words">Eliminar "{pendingDelete.title}" definitivamente?</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" className={command} disabled={busy} onClick={() => void removeSheet()}><Trash2 size={18} /> Eliminar</button><button type="button" className={command} disabled={busy} onClick={() => setPendingDelete(null)}>Cancelar</button></div></div>}
            {viewer && <section aria-label={`PDF: ${viewer.sheet.title}`} className="mt-8 border-t border-[#d6dfdc] pt-4"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-medium">{viewer.sheet.title}</h2><button type="button" className={command} title="Fechar PDF" aria-label="Fechar PDF" onClick={() => setViewer(null)}><X size={18} /></button></div><object data={viewer.url} type="application/pdf" aria-label={viewer.sheet.title} className="h-[70dvh] min-h-80 w-full bg-white"><p className="p-4">Pré-visualização indisponível. <a className="underline" href={viewer.url} target="_blank" rel="noopener noreferrer">Abrir PDF</a></p></object><button type="button" className={`${command} mt-3`} disabled={busy} onClick={() => void openSheet(viewer.sheet)}>Reabrir PDF</button></section>}
            </div>
          </>}
        </>}
    </section>
  );
}