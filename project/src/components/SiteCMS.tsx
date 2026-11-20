import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, ImagePlus, PanelsTopLeft, Plus, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth';
import { defaultSiteContent, defaultVideoGallery, fontOptions, mapSiteAssets, sectionKeys, type SiteAsset, type SiteContent } from '../utils/siteContent';
import { draftAssetUrls, loadSiteDraft, saveSiteContent, uploadSiteAsset } from '../utils/siteCMS';
import './SiteCMS.css';
import { defaultCalendarUrl } from '../utils/calendarSource';

function EditorSection({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <details className="cms-section" open={open || undefined}><summary>{title}<ChevronDown size={17} aria-hidden="true" /></summary><div className="cms-section-body">{children}</div></details>;
}

function TextField({ label, value, onChange, multiline = false, maxLength = 160 }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number }) {
  return <label className="cms-field"><span>{label}</span>{multiline ? <textarea rows={5} maxLength={maxLength} value={value} onChange={event => onChange(event.target.value)} /> : <input value={value} maxLength={maxLength} onChange={event => onChange(event.target.value)} />}</label>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="cms-field"><span>{label}</span><div className="cms-color"><input aria-label={label} type="color" value={value} onChange={event => onChange(event.target.value)} /><span>{value}</span></div></label>;
}

function AssetEditor({ label, asset, urls, onChange, onUpload, video = false, removable = true }: {
  label: string; asset: SiteAsset | null; urls: Record<string, string>; onChange: (asset: SiteAsset | null) => void;
  onUpload: (file: File, apply: (asset: SiteAsset) => void, video: boolean) => Promise<void>; video?: boolean; removable?: boolean;
}) {
  const source = asset?.bucket === 'band-site-drafts' ? urls[asset.path ?? ''] : asset?.url;
  const isVideo = source && /\.(mp4|webm)(?:\?|$)/i.test(source);
  return <div className="cms-asset-editor">
    <div className="cms-media-preview">{source ? isVideo ? <video src={source} controls preload="metadata" /> : <img src={source} alt={asset?.alt ?? label} loading="lazy" /> : <ImagePlus size={26} aria-hidden="true" />}</div>
    <div className="cms-asset-fields">
      <label className="cms-upload"><Upload size={16} aria-hidden="true" /><span>{asset ? `Substituir ${label}` : `Carregar ${label}`}</span><input aria-label={`Carregar ${label}`} type="file" accept={video ? 'image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm' : 'image/jpeg,image/png,image/webp,image/avif'} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = '';
        if (file) void onUpload(file, uploaded => onChange({ ...uploaded, alt: asset?.alt || uploaded.alt }), video);
      }} /></label>
      {asset && <TextField label={`Descrição de ${label}`} value={asset.alt} maxLength={500} onChange={alt => onChange({ ...asset, alt })} />}
      {asset && removable && <button type="button" className="cms-icon" title={`Remover ${label}`} aria-label={`Remover ${label}`} onClick={() => onChange(null)}><Trash2 size={17} /></button>}
    </div>
  </div>;
}

function SiteEditor({ bandId }: { bandId: string }) {
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);
  const [revision, setRevision] = useState(0);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [recipients, setRecipients] = useState('');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const persisted = useRef<SiteContent>(defaultSiteContent());
  const persistedRecipients = useRef('');
  const paths = new Set<string>();
  mapSiteAssets(content, asset => { if (asset.bucket === 'band-site-drafts' && asset.path) paths.add(asset.path); return asset; });
  const pathKey = [...paths].sort().join('|');
  const videos = content.videos ?? defaultVideoGallery;
  const updateVideos = (values: Partial<typeof videos>) => edit(previous => ({ ...previous, videos: { ...(previous.videos ?? defaultVideoGallery), ...values } }));

  useEffect(() => {
    let current = true;
    void loadSiteDraft(bandId).then(record => {
      if (!current) return;
      const initial = record?.draft ?? defaultSiteContent();
      persisted.current = initial;
      persistedRecipients.current = (record?.contact_usernames ?? []).join(', ');
      setRecipients(persistedRecipients.current);
      setContent(initial); setRevision(record?.revision ?? 0); setPublishedAt(record?.published_at ?? null); setDirty(false); setError(''); setLoading(false); setReady(true);
    }).catch(reason => { if (current) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o CMS.'); setLoading(false); } });
    return () => { current = false; };
  }, [bandId, reload]);

  useEffect(() => {
    let current = true;
    const snapshot = mapSiteAssets(defaultSiteContent(), asset => asset);
    snapshot.sections.bio.media = pathKey ? pathKey.split('|').map(path => ({ url: `/draft/${path}`, alt: '', path, bucket: 'band-site-drafts' })) : [];
    void draftAssetUrls(snapshot).then(result => { if (current) setUrls(result); }).catch(reason => { if (current) setError(reason instanceof Error ? reason.message : 'Pré-visualização indisponível.'); });
    return () => { current = false; };
  }, [pathKey]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function edit(update: (previous: SiteContent) => SiteContent) {
    setContent(update); setDirty(true); setNotice('');
  }
  async function upload(file: File, apply: (asset: SiteAsset) => void, video: boolean) {
    setBusy(true); setError('');
    try { apply(await uploadSiteAsset(bandId, file, video)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o ficheiro.'); }
    finally { setBusy(false); }
  }
  async function save(publish: boolean) {
    setBusy(true); setError(''); setNotice('');
    try {
      const record = await saveSiteContent(bandId, content, revision, publish, recipients);
      persisted.current = record.draft; setContent(record.draft); setRevision(record.revision); setPublishedAt(record.published_at); setDirty(false);
      persistedRecipients.current = (record.contact_usernames ?? []).join(', '); setRecipients(persistedRecipients.current);
      setNotice(publish ? 'Site publicado.' : 'Rascunho guardado.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível guardar.'); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status" className="cms-loading">A carregar conteúdo...</p>;

  return <>
    <div className="cms-toolbar">
      <div><span className="cms-state">{dirty ? 'Alterações por guardar' : 'Rascunho guardado'}</span><small>{publishedAt ? `Publicado ${new Date(publishedAt).toLocaleString('pt-PT')}` : 'Ainda não publicado'}</small></div>
      <div className="cms-actions">
        <a className="cms-icon" href="/" target="_blank" rel="noopener noreferrer" title="Abrir site publicado" aria-label="Abrir site publicado"><ExternalLink size={18} /></a>
        <button type="button" className="cms-icon" disabled={busy} title="Recarregar conteúdo" aria-label="Recarregar conteúdo" onClick={() => { if (!dirty || window.confirm('Descartar alterações por guardar?')) { setReady(false); setLoading(true); setReload(value => value + 1); } }}><RefreshCw size={18} /></button>
        <button type="button" className="cms-command" disabled={busy || !ready || !dirty && revision > 0} onClick={() => void save(false)}><Save size={17} />Guardar rascunho</button>
        <button type="button" className="cms-command cms-publish" disabled={busy || !ready} onClick={() => void save(true)}><Upload size={17} />{busy ? 'A processar...' : 'Publicar'}</button>
      </div>
    </div>
    {error && <p role="alert" className="cms-error">{error}</p>}
    {notice && <p role="status" className="cms-notice">{notice}</p>}
    <fieldset disabled={busy || !ready} className="cms-fields">
      <EditorSection title="Logo e fundo" open>
        <TextField label="Nome da banda" value={content.name} onChange={name => edit(previous => ({ ...previous, name }))} />
        <p className="cms-help">Use PNG ou WebP com fundo transparente, de preferência quadrado, com 512 × 512 px ou 1024 × 1024 px. Mantenha o logo centrado com uma pequena margem. Idealmente abaixo de 500 KB; máximo 10 MB.</p>
        <AssetEditor label="logo" asset={content.identity.logo} urls={urls} onUpload={upload} removable={false} onChange={logo => { if (logo) edit(previous => ({ ...previous, identity: { ...previous.identity, logo } })); }} />
        <div className="cms-grid">
          <ColorField label="Cor de fundo do logo" value={content.identity.logoBackground} onChange={logoBackground => edit(previous => ({ ...previous, identity: { ...previous.identity, logoBackground } }))} />
          <ColorField label="Cor de fundo do site" value={content.identity.backgroundColor} onChange={backgroundColor => edit(previous => ({ ...previous, identity: { ...previous.identity, backgroundColor } }))} />
          <label className="cms-field"><span>Fundo do site</span><select value={content.identity.backgroundMode} onChange={event => edit(previous => ({ ...previous, identity: { ...previous.identity, backgroundMode: event.target.value as SiteContent['identity']['backgroundMode'] } }))}><option value="color">Cor</option><option value="image">Imagem</option><option value="video">Vídeo</option></select></label>
        </div>
        {content.identity.backgroundMode === 'image' && <AssetEditor label="imagem de fundo" asset={content.identity.backgroundImage} urls={urls} onUpload={upload} onChange={backgroundImage => edit(previous => ({ ...previous, identity: { ...previous.identity, backgroundImage } }))} />}
        {content.identity.backgroundMode === 'video' && <AssetEditor label="vídeo de fundo" asset={content.identity.backgroundVideo} urls={urls} onUpload={upload} video onChange={backgroundVideo => edit(previous => ({ ...previous, identity: { ...previous.identity, backgroundVideo } }))} />}
        <EditorSection title="Imagens dos títulos">
          <label className="cms-checkbox"><input type="checkbox" checked={content.identity.headingImagesVisible !== false} onChange={event => edit(previous => ({ ...previous, identity: { ...previous.identity, headingImagesVisible: event.target.checked } }))} />Imagens dos títulos visíveis</label>
          {content.identity.headingImagesVisible !== false && (['headingStart', 'headingEnd'] as const).map((key, index) => <AssetEditor key={key} label={index ? 'imagem à direita do título' : 'imagem à esquerda do título'} asset={content.identity[key]} urls={urls} onUpload={upload} removable={false} onChange={asset => { if (asset) edit(previous => ({ ...previous, identity: { ...previous.identity, [key]: asset } })); }} />)}
        </EditorSection>
      </EditorSection>
      <EditorSection title="Tipografia">
        <div className="cms-grid">{(['titles', 'subtitles', 'text'] as const).map((key, index) => <div key={key} className="cms-typeface">
          <label className="cms-field"><span>{['Títulos', 'Subtítulos', 'Texto'][index]}</span><select aria-label={`Fonte de ${['títulos', 'subtítulos', 'texto'][index]}`} value={content.typography[key].font} onChange={event => edit(previous => ({ ...previous, typography: { ...previous.typography, [key]: { ...previous.typography[key], font: event.target.value } } }))}>{fontOptions.map(font => <option key={font}>{font}</option>)}</select></label>
          <ColorField label={`Cor de ${['títulos', 'subtítulos', 'texto'][index]}`} value={content.typography[key].color} onChange={color => edit(previous => ({ ...previous, typography: { ...previous.typography, [key]: { ...previous.typography[key], color } } }))} />
          <div className="cms-font-preview" style={{ fontFamily: `"${content.typography[key].font}", sans-serif`, color: content.typography[key].color, backgroundColor: content.identity.backgroundColor }}>{content.name}</div>
        </div>)}</div>
      </EditorSection>
      {sectionKeys.map(key => {
        const section = content.sections[key];
        const update = (values: Partial<typeof section>) => edit(previous => ({ ...previous, sections: { ...previous.sections, [key]: { ...previous.sections[key], ...values } } }));
        const replaceMedia = (index: number, asset: SiteAsset | null) => update({ media: asset ? section.media.map((item, position) => position === index ? asset : item) : section.media.filter((_, position) => position !== index) });
        const move = (index: number, offset: number) => { const media = [...section.media]; [media[index], media[index + offset]] = [media[index + offset], media[index]]; update({ media }); };
        return <Fragment key={key}><EditorSection title={key === 'bio' ? 'Biografia' : section.label}>
          <label className="cms-checkbox"><input type="checkbox" checked={section.visible} onChange={event => update({ visible: event.target.checked })} />Visível no site</label>
          <div className="cms-grid"><TextField label={`Menu: ${section.label}`} value={section.label} maxLength={100} onChange={label => update({ label })} /><TextField label={`Título: ${section.label}`} value={section.title} onChange={title => update({ title })} /></div>
          {section.subtitle !== undefined && <TextField label={`Subtítulo: ${section.label}`} value={section.subtitle} maxLength={500} onChange={subtitle => update({ subtitle })} />}
          <TextField label={`Texto: ${section.label}`} value={section.text} multiline maxLength={20000} onChange={text => update({ text })} />
          {key === 'calendar' && <div className="cms-field"><TextField label="Google Calendar: endereço público iCal" value={content.calendarUrl ?? defaultCalendarUrl} maxLength={2000} onChange={calendarUrl => edit(previous => ({ ...previous, calendarUrl }))} /><p className="cms-help">No Google Calendar, abra Definições → o calendário → Integrar calendário e copie o Endereço público em formato iCal. Ative a disponibilização pública do calendário. Não use o endereço secreto. <a href="https://support.google.com/calendar/answer/37083?hl=pt#link" target="_blank" rel="noopener noreferrer">Ajuda do Google Calendar <ExternalLink size={12} aria-hidden="true" /></a></p></div>}
          {key === 'contact' && <div className="cms-field"><TextField label="Encaminhar mensagens para utilizadores" value={recipients} multiline maxLength={2000} onChange={value => { setRecipients(value); setDirty(true); setNotice(''); }} /><p className="cms-help">Nomes de utilizador separados por vírgulas, por exemplo: admin, producao. Os destinatários devem ser membros ativos desta banda com email confirmado. Vazio mantém os destinatários atuais. As alterações ao encaminhamento entram em vigor ao publicar.</p></div>}
          {['home', 'bio', 'socials'].includes(key) && <div className="cms-media-list">
            {section.media.map((asset, index) => <div key={asset.path ?? asset.url} className="cms-media-row"><AssetEditor label={`${section.label} ${index + 1}`} asset={asset} urls={urls} onUpload={upload} video={key === 'home'} onChange={replacement => replaceMedia(index, replacement)} /><div className="cms-order"><button type="button" className="cms-icon" title="Mover para cima" aria-label={`Mover ${section.label} ${index + 1} para cima`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={17} /></button><button type="button" className="cms-icon" title="Mover para baixo" aria-label={`Mover ${section.label} ${index + 1} para baixo`} disabled={index === section.media.length - 1} onClick={() => move(index, 1)}><ArrowDown size={17} /></button></div></div>)}
            {(key !== 'home' || section.media.length === 0) && section.media.length < 50 && <AssetEditor label={`novo ficheiro: ${section.label}`} asset={null} urls={urls} onUpload={upload} video={key === 'home'} onChange={asset => { if (asset) update({ media: [...section.media, asset] }); }} />}
          </div>}
          {key === 'socials' && <div className="cms-grid"><TextField label="Ligação do Instagram" value={content.instagramUrl} maxLength={2000} onChange={instagramUrl => edit(previous => ({ ...previous, instagramUrl }))} /><TextField label="Texto da ligação" value={content.instagramLabel} onChange={instagramLabel => edit(previous => ({ ...previous, instagramLabel }))} /></div>}
          {key === 'events' && <>
            {content.events.map((event, index) => <EditorSection title={event.title || `Evento ${index + 1}`} key={event.id}>
              <TextField label={`Nome do evento ${index + 1}`} value={event.title} onChange={title => edit(previous => ({ ...previous, events: previous.events.map(item => item.id === event.id ? { ...item, title } : item) }))} />
              <TextField label={`Texto do evento ${index + 1}`} value={event.text} multiline maxLength={20000} onChange={text => edit(previous => ({ ...previous, events: previous.events.map(item => item.id === event.id ? { ...item, text } : item) }))} />
              <AssetEditor label={`imagem do evento ${index + 1}`} asset={event.image} urls={urls} onUpload={upload} onChange={image => edit(previous => ({ ...previous, events: previous.events.map(item => item.id === event.id ? { ...item, image } : item) }))} />
              <button type="button" className="cms-command" onClick={() => edit(previous => ({ ...previous, events: previous.events.filter(item => item.id !== event.id) }))}><Trash2 size={17} />Remover evento</button>
            </EditorSection>)}
            <button type="button" className="cms-command" disabled={content.events.length >= 50} onClick={() => edit(previous => ({ ...previous, events: [...previous.events, { id: crypto.randomUUID(), title: 'Novo evento', text: '', image: null }] }))}><Plus size={17} />Adicionar evento</button>
          </>}
        </EditorSection>
        {key === 'socials' && <EditorSection title="Vídeos">
          <label className="cms-checkbox"><input type="checkbox" checked={videos.visible} onChange={event => updateVideos({ visible: event.target.checked })} />Vídeos visíveis no site</label>
          <div className="cms-grid"><TextField label="Menu: Vídeos" value={videos.label} maxLength={100} onChange={label => updateVideos({ label })} /><TextField label="Título: Vídeos" value={videos.title} onChange={title => updateVideos({ title })} /></div>
          <TextField label="Texto: Vídeos" value={videos.text} multiline maxLength={20000} onChange={text => updateVideos({ text })} />
          {videos.links.map((link, index) => <div key={index} className="cms-video-link">
            <TextField label={`YouTube ${index + 1}`} value={link} maxLength={2000} onChange={value => updateVideos({ links: videos.links.map((item, position) => position === index ? value : item) })} />
            <div className="cms-actions">
              <button type="button" className="cms-icon" title="Mover vídeo para cima" aria-label={`Mover vídeo ${index + 1} para cima`} disabled={index === 0} onClick={() => { const links = [...videos.links]; [links[index - 1], links[index]] = [links[index], links[index - 1]]; updateVideos({ links }); }}><ArrowUp size={17} /></button>
              <button type="button" className="cms-icon" title="Mover vídeo para baixo" aria-label={`Mover vídeo ${index + 1} para baixo`} disabled={index === videos.links.length - 1} onClick={() => { const links = [...videos.links]; [links[index], links[index + 1]] = [links[index + 1], links[index]]; updateVideos({ links }); }}><ArrowDown size={17} /></button>
              <button type="button" className="cms-icon" title="Remover vídeo" aria-label={`Remover vídeo ${index + 1}`} onClick={() => updateVideos({ links: videos.links.filter((_, position) => position !== index) })}><Trash2 size={17} /></button>
            </div>
          </div>)}
          <button type="button" className="cms-command" disabled={videos.links.length >= 20} onClick={() => updateVideos({ links: [...videos.links, ''] })}><Plus size={17} />Adicionar vídeo</button>
        </EditorSection>}
        </Fragment>;
      })}
      <EditorSection title="Rodapé"><TextField label="Texto do rodapé" value={content.footerText} multiline maxLength={2000} onChange={footerText => edit(previous => ({ ...previous, footerText }))} /></EditorSection>
    </fieldset>
    {dirty && <button className="cms-command cms-discard" type="button" disabled={busy} onClick={() => { if (window.confirm('Descartar alterações por guardar?')) { setContent(persisted.current); setRecipients(persistedRecipients.current); setDirty(false); setError(''); } }}><Trash2 size={16} />Descartar alterações</button>}
  </>;
}

export default function SiteCMS() {
  const { memberships } = useWorkspaceAuth();
  const bands = memberships.filter(member => member.active && member.roles.some(role => ['owner', 'admin'].includes(role)));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState('');
  const bandId = selected || bands[0]?.band_id;
  return <details className="site-cms" onToggle={event => { if (event.currentTarget.open) setOpen(true); }}>
    <summary className="cms-heading"><PanelsTopLeft size={21} aria-hidden="true" /><span>Conteúdo do site</span><ChevronDown size={18} aria-hidden="true" /></summary>
    {open && <div className="cms-body">
      {bands.length > 1 && <label className="cms-field"><span>Banda</span><select value={bandId} onChange={event => { if (window.confirm('Mudar de banda? As alterações por guardar serão descartadas.')) setSelected(event.target.value); }}>{bands.map(band => <option key={band.band_id} value={band.band_id}>{band.bands?.name ?? band.band_id}</option>)}</select></label>}
      {bandId ? <SiteEditor key={bandId} bandId={bandId} /> : <p role="alert">É necessário acesso de administrador ativo.</p>}
    </div>}
  </details>;
}