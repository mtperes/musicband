import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { ArrowLeft, ArrowRight, ListMusic, Maximize, Minimize, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth';
import { findSongSheet, googleDrivePreviewUrl, readPerformanceProgress, type MusicSheet, type PerformanceEntry } from '../utils/musicPerformance';
import type { RepertoireSong } from './Setlists';
import './PerformanceReader.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
const pdfOptions = {
  cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
  standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
  wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
};

type Props = {
  bandId: string;
  setlistId: string;
  title: string;
  entries: PerformanceEntry[];
  songs: RepertoireSong[];
  sheets: MusicSheet[];
  instruments: string[];
  initialInstrument: string;
  onClose: () => void;
};

function ScorePage({ number, width, root }: { number: number; width: number; root: HTMLDivElement | null }) {
  const element = useRef<HTMLDivElement>(null);
  const [nearby, setNearby] = useState(number === 1);
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    if (!element.current || !root) return;
    const observer = new IntersectionObserver(([entry]) => setNearby(number === 1 || entry.isIntersecting), { root, rootMargin: '100% 0px' });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [root, number]);
  return <div ref={element} id={`score-page-${number}`} className="score-page" style={{ width, minHeight: width * ratio }} aria-label={`Página ${number}`}>
    {nearby && <Page suspense={false} pageNumber={number} width={width} devicePixelRatio={Math.min(devicePixelRatio || 1, 2)} renderTextLayer={false} renderAnnotationLayer={false}
      loading={<p role="status">A desenhar página {number}...</p>} error={<p role="alert">Não foi possível desenhar a página {number}.</p>}
      onLoadSuccess={(page) => { const viewport = page.getViewport({ scale: 1 }); setRatio(viewport.height / viewport.width); }} />}
  </div>;
}

function ScoreDocument({ file, onRetry }: { file: Blob; onRetry: () => void }) {
  const viewport = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [pages, setPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    setRoot(element);
    const toolbar = tools.current;
    const observer = new ResizeObserver(() => {
      setWidth(Math.max(160, Math.floor(element.clientWidth)));
      element.parentElement?.style.setProperty('--score-tools-height', `${toolbar?.getBoundingClientRect().height ?? 0}px`);
    });
    observer.observe(element);
    if (toolbar) observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!root || !pages) return;
    const observer = new IntersectionObserver((changes) => {
      const visible = changes.filter((entry) => entry.isIntersecting).sort((first, second) => first.boundingClientRect.top - second.boundingClientRect.top);
      if (visible[0]) setPageNumber(Number(visible[0].target.id.replace('score-page-', '')));
    }, { root, rootMargin: '0px 0px -65% 0px', threshold: 0 });
    root.querySelectorAll('.score-page').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [root, pages, zoom]);

  function goToPage(number: number) {
    const next = Math.max(1, Math.min(pages, number));
    const element = root?.querySelector<HTMLElement>(`#score-page-${next}`);
    if (element && root) root.scrollTo({ top: Math.max(0, element.offsetTop - parseFloat(getComputedStyle(root).scrollPaddingTop)), behavior: 'instant' });
    setPageNumber(next);
  }

  return <div className="score-document">
    <div ref={tools} className="score-tools" aria-label="Controlos do PDF">
      <button type="button" title="Diminuir zoom" aria-label="Diminuir zoom" disabled={zoom <= 0.75} onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}><ZoomOut size={20} /></button>
      <button type="button" title="Ajustar à largura" aria-label="Ajustar à largura" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
      <button type="button" title="Aumentar zoom" aria-label="Aumentar zoom" disabled={zoom >= 2.5} onClick={() => setZoom((value) => Math.min(2.5, value + 0.25))}><ZoomIn size={20} /></button>
      <div className="score-page-controls">
        <button type="button" title="Página anterior" aria-label="Página anterior" disabled={!pages || pageNumber <= 1} onClick={() => goToPage(pageNumber - 1)}><ArrowLeft size={18} /></button>
        <label><span className="sr-only">Página do PDF</span><select aria-label="Página do PDF" value={pageNumber} disabled={!pages} onChange={(event) => goToPage(Number(event.target.value))}>{Array.from({ length: pages || 1 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} / {pages || '—'}</option>)}</select></label>
        <button type="button" title="Página seguinte" aria-label="Página seguinte" disabled={!pages || pageNumber >= pages} onClick={() => goToPage(pageNumber + 1)}><ArrowRight size={18} /></button>
      </div>
    </div>
    <div ref={viewport} className="score-viewport" tabIndex={0} aria-label="Partitura PDF">
      <Document suspense={false} file={file} options={pdfOptions} loading={<p role="status" className="reader-message">A abrir PDF...</p>}
        error={<div role="alert" className="reader-message"><p>Não foi possível abrir o PDF.</p><button type="button" onClick={onRetry}><RotateCcw size={18} /> Tentar novamente</button></div>}
        onLoadSuccess={({ numPages }) => { setPages(numPages); setRenderError(false); }} onLoadError={() => setRenderError(true)}>
        {width > 0 && !renderError && Array.from({ length: pages }, (_, index) => <ScorePage key={index + 1} number={index + 1} width={Math.floor(width * zoom)} root={root} />)}
      </Document>
    </div>
  </div>;
}

export default function PerformanceReader({ bandId, setlistId, title, entries, songs, sheets, instruments, initialInstrument, onClose }: Props) {
  const { session } = useWorkspaceAuth();
  const storageKey = `music-performance:v1:${session?.user.id}:${bandId}:${setlistId}`;
  const [progress, setProgress] = useState(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(storageKey); } catch { raw = null; }
    const saved = readPerformanceProgress(raw, entries, instruments);
    return { ...saved, instrument: initialInstrument || saved.instrument };
  });
  const [drawer, setDrawer] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [retry, setRetry] = useState(0);
  const [score, setScore] = useState<{ id: string; file?: Blob; error?: string } | null>(null);
  const cache = useRef(new Map<string, Blob>());
  const dialog = useRef<HTMLDialogElement>(null);
  const reader = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const songsButton = useRef<HTMLButtonElement>(null);
  const drawerClose = useRef<HTMLButtonElement>(null);
  const wasDrawerOpen = useRef(false);
  const ownFullscreen = useRef(false);
  const index = Math.max(0, Math.min(entries.length - 1, progress.index));
  const entry = entries[index];
  const song = songs.find((item) => item.id === entry?.songId);
  const sheet = entry ? findSongSheet(sheets, bandId, entry.songId, progress.instrument) : undefined;
  const next = entries[index + 1];
  const nextSheet = next ? findSongSheet(sheets, bandId, next.songId, progress.instrument) : undefined;
  const source = song?.song_parts.find((part) => part.instrument.trim().toLocaleLowerCase() === progress.instrument.trim().toLocaleLowerCase());
  const drivePreview = googleDrivePreviewUrl(source?.url);
  const sourceLabel = sheet ? 'PDF' : drivePreview ? 'Google Drive' : source ? 'Link externo' : null;

  useEffect(() => {
    const topBar = header.current;
    const bottomBar = navigation.current;
    if (!topBar || !bottomBar) return;
    const observer = new ResizeObserver(() => {
      reader.current?.style.setProperty('--reader-header-height', `${topBar.getBoundingClientRect().height}px`);
      reader.current?.style.setProperty('--reader-navigation-height', `${bottomBar.getBoundingClientRect().height}px`);
    });
    observer.observe(topBar);
    observer.observe(bottomBar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const files = cache.current;
    element?.showModal();
    closeButton.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
      files.clear();
      if (ownFullscreen.current && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (drawer) drawerClose.current?.focus();
    else if (wasDrawerOpen.current) songsButton.current?.focus();
    wasDrawerOpen.current = drawer;
  }, [drawer]);

  useEffect(() => {
    let active = true;
    let lock: WakeLockSentinel | undefined;
    async function acquire() {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const acquired = await navigator.wakeLock?.request('screen');
        if (!active) await acquired?.release();
        else lock = acquired;
      } catch { return; }
    }
    void acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => { active = false; document.removeEventListener('visibilitychange', acquire); void lock?.release().catch(() => undefined); };
  }, []);

  useEffect(() => {
    function updateFullscreen() { setFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  useEffect(() => {
    if (!entry) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, songId: entry.songId, position: entry.position, instrument: progress.instrument })); }
    catch { return; }
  }, [storageKey, entry, progress.instrument]);

  const sheetId = sheet?.id;
  const sheetPath = sheet?.storage_path;
  const nextId = nextSheet?.id;
  const nextPath = nextSheet?.storage_path;
  useEffect(() => {
    let active = true;
    const files = cache.current;
    for (const id of files.keys()) if (id !== sheetId && id !== nextId) files.delete(id);
    async function load(id: string, path: string) {
      const cached = files.get(id);
      if (cached) return cached;
      if (!supabase) throw new Error('Supabase indisponível.');
      const { data, error } = await supabase.storage.from('music-sheets').download(path);
      if (error) throw new Error(error.message);
      if (active) files.set(id, data);
      return data;
    }
    async function open() {
      if (sheetId && sheetPath) {
        setScore({ id: sheetId, file: files.get(sheetId) });
        try {
          const file = await load(sheetId, sheetPath);
          if (active) setScore({ id: sheetId, file });
        } catch (error) {
          if (active) setScore({ id: sheetId, error: error instanceof Error ? error.message : 'PDF indisponível.' });
        }
      } else setScore(null);
      if (active && nextId && nextPath) {
        try { await load(nextId, nextPath); } catch { return; }
      }
    }
    void open();
    return () => { active = false; };
  }, [sheetId, sheetPath, nextId, nextPath, retry]);

  function navigate(destination: number) {
    setProgress((current) => ({ ...current, index: Math.max(0, Math.min(entries.length - 1, destination)) }));
    setDrawer(false);
  }

  async function toggleFullscreen() {
    setFullscreenError('');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) { await document.documentElement.requestFullscreen(); ownFullscreen.current = true; }
      else setFullscreenError('Ecrã inteiro indisponível. O leitor mantém a janela completa.');
    } catch { setFullscreenError('Ecrã inteiro indisponível. O leitor mantém a janela completa.'); }
  }

  function retryScore() {
    if (sheetId) cache.current.delete(sheetId);
    setRetry((value) => value + 1);
  }

  return createPortal(<dialog ref={dialog} className="workspace performance-dialog" aria-label={`Tocar setlist: ${title}`} onCancel={(event) => { event.preventDefault(); if (drawer) setDrawer(false); else onClose(); }} onKeyDown={(event) => {
    const target = event.target as HTMLElement;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A'].includes(target.tagName) || drawer) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); navigate(index + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigate(index - 1); }
  }}>
    <div ref={reader} className="performance-reader">
      <header ref={header} className="reader-header" inert={drawer}>
        <button ref={closeButton} type="button" title="Voltar às setlists" aria-label="Voltar às setlists" onClick={onClose}><ArrowLeft size={22} /></button>
        <div className="reader-heading"><p>{index + 1} / {entries.length} · {title}</p><div className="reader-title-row"><h1>{entry?.title ?? 'Música indisponível'}</h1>{sourceLabel && <span className="reader-source-label" title={sheet?.file_name}>{sourceLabel}</span>}</div></div>
        <button ref={songsButton} type="button" title="Músicas da setlist" aria-label="Músicas da setlist" aria-expanded={drawer} onClick={() => setDrawer(!drawer)}><ListMusic size={22} /></button>
        <button type="button" title={fullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'} aria-label={fullscreen ? 'Sair de ecrã inteiro' : 'Ecrã inteiro'} onClick={() => void toggleFullscreen()}>{fullscreen ? <Minimize size={21} /> : <Maximize size={21} />}</button>
        <label className="reader-instrument"><span className="sr-only">Instrumento de palco</span><select aria-label="Instrumento de palco" value={progress.instrument} onChange={(event) => setProgress((current) => ({ ...current, instrument: event.target.value }))}>{!instruments.length && <option value="">Sem instrumentos</option>}{instruments.map((name) => <option key={name}>{name}</option>)}</select></label>
      </header>
      {fullscreenError && <p role="status" className="reader-notice">{fullscreenError}</p>}
      <main className="reader-score" inert={drawer} aria-live="polite" aria-busy={Boolean(sheet && (!score || score.id !== sheet.id || (!score.file && !score.error)))}>
        {!sheet && drivePreview ? <div className="reader-external-score"><iframe key={`${entry.position}-${drivePreview}`} title={`Partitura: ${entry.title}: ${progress.instrument}`} src={drivePreview} allow="fullscreen" referrerPolicy="no-referrer" /></div>
          : !sheet ? <div className="reader-message"><p>Sem PDF associado para {progress.instrument || 'este instrumento'}.</p></div>
          : score?.id !== sheet.id || (!score.file && !score.error) ? <p role="status" className="reader-message">A carregar partitura...</p>
          : score.error ? <div role="alert" className="reader-message"><p>Não foi possível carregar o PDF.</p><p>{score.error}</p><button type="button" onClick={retryScore}><RotateCcw size={18} /> Tentar novamente</button></div>
          : score.file ? <ScoreDocument key={`${entry.position}-${sheet.id}-${retry}`} file={score.file} onRetry={retryScore} /> : null}
      </main>
      <footer ref={navigation} className="reader-navigation" inert={drawer}>
        <button type="button" disabled={index === 0} onClick={() => navigate(index - 1)}><ArrowLeft size={24} /><span>Anterior</span></button>
        <span className="reader-position" aria-label={`Música ${index + 1} de ${entries.length}`}>{index + 1} / {entries.length}</span>
        <button type="button" disabled={index >= entries.length - 1} onClick={() => navigate(index + 1)}><span>Seguinte</span><ArrowRight size={24} /></button>
      </footer>
      {drawer && <aside className="reader-drawer" aria-label="Ordem de palco">
        <div className="reader-drawer-heading"><h2>{title}</h2><button ref={drawerClose} type="button" title="Fechar lista de músicas" aria-label="Fechar lista de músicas" onClick={() => setDrawer(false)}><X size={22} /></button></div>
        <ol>{entries.map((item, position) => <li key={item.position}><button type="button" aria-current={index === position ? 'step' : undefined} onClick={() => navigate(position)}><span>{position + 1}.</span><span>{item.title}</span></button></li>)}</ol>
      </aside>}
    </div>
  </dialog>, document.body);
}