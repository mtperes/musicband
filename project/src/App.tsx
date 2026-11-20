
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom';
import Banner from './components/Banner'
import Menu from './components/Menu'
import './App.css'
import Calendar from './components/Calendar'
import Events from './components/Events'
import Bio from './components/Bio'
import Contact from './components/Contact'
import SocialCarousel from './components/SocialCarousel'
import Logo from './components/Logo'
import Footer from './components/Footer';
import { SiteContentContext } from './hooks/useSiteContent';
import { defaultSiteContent, validateSiteContent } from './utils/siteContent';
import { supabase } from './utils/supabase';

const AdminPortal = lazy(() =>
  import('./components/WorkspacePortals').then(({ AdminPortal }) => ({ default: AdminPortal })),
);
const MusicPortal = lazy(() =>
  import('./components/WorkspacePortals').then(({ MusicPortal }) => ({ default: MusicPortal })),
);
const AuthConfirm = lazy(() => import('./components/AuthConfirm'));
const ToolsPortal = lazy(() =>
  import('./components/WorkspacePortals').then(({ ToolsPortal }) => ({ default: ToolsPortal })),
);
const VideoGallery = lazy(() => import('./components/VideoGallery'));

function App() {
  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicSite />} />
        <Route path="/auth/confirm" element={<Suspense fallback={<p className="p-6" role="status">A confirmar acesso...</p>}><AuthConfirm /></Suspense>} />
        <Route path="/admin/*" element={<Suspense fallback={<p className="p-6" role="status">A carregar...</p>}><AdminPortal /></Suspense>} />
        <Route path="/music/*" element={<Suspense fallback={<p className="p-6" role="status">A carregar...</p>}><MusicPortal /></Suspense>} />
        <Route path="/tools" element={<Suspense fallback={<p className="p-6" role="status">A carregar...</p>}><ToolsPortal /></Suspense>} />
        <Route path="/band" element={<Navigate to="/music" replace />} />
        <Route path="/band/*" element={<Navigate to="/music" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
    <Analytics />
    </>
  );
}

function PublicSite() {
  const backgroundVideoRef = useRef<HTMLVideoElement>(null);
  const [content, setContent] = useState(defaultSiteContent);

  useEffect(() => {
    let current = true;
    if (supabase) void supabase.rpc('get_published_band_site', { band_slug: 'sardinhas-nomades' }).then(({ data, error }) => {
      if (!current || error || !data) return;
      try { validateSiteContent(data); setContent(data); } catch { return; }
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!video) return;

    const playBackground = () => {
      if (video.paused) void video.play().catch(() => {});
    };

    playBackground();
    document.addEventListener('visibilitychange', playBackground);
    return () => document.removeEventListener('visibilitychange', playBackground);
  }, [content.identity.backgroundVideo?.url, content.identity.backgroundMode]);

  const siteStyle = {
    '--site-title-font': `"${content.typography.titles.font}", sans-serif`,
    '--site-subtitle-font': `"${content.typography.subtitles.font}", sans-serif`,
    '--site-text-font': `"${content.typography.text.font}", sans-serif`,
    '--site-title-color': content.typography.titles.color,
    '--site-subtitle-color': content.typography.subtitles.color,
    '--site-text-color': content.typography.text.color,
    backgroundColor: content.identity.backgroundColor,
    backgroundImage: content.identity.backgroundMode === 'image' && content.identity.backgroundImage ? `url("${content.identity.backgroundImage.url}")` : undefined,
  } as CSSProperties;

  return (
    <SiteContentContext.Provider value={content}>
    <div className="public-site" style={siteStyle}>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      {content.identity.backgroundMode === 'video' && content.identity.backgroundVideo && <video
        ref={backgroundVideoRef}
        id="bgVideo"
        className="background-video"
        src={content.identity.backgroundVideo.url}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      />}
      <Logo />
      <Menu />
      <main id="main-content" tabIndex={-1}>
        <h1 className="sr-only">{content.name}</h1>
        {content.sections.home.visible && <Banner />}
        {content.sections.bio.visible && <Bio />}
        {content.sections.calendar.visible && <Calendar />}
        {content.sections.socials.visible && <SocialCarousel />}
        {content.videos?.visible && content.videos.links.length > 0 && <Suspense fallback={null}><VideoGallery /></Suspense>}
        {content.sections.events.visible && <Events />}
        {content.sections.contact.visible && <Contact />}
      </main>
      <Footer />
    </div>
    </SiteContentContext.Provider>
  )
}

function NotFound() {
  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <h1 className="text-3xl">Página não encontrada</h1>
      <Link className="mt-4 inline-block underline" to="/">Voltar ao site</Link>
    </main>
  );
}

export default App
