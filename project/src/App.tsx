
import { lazy, Suspense, useEffect, useRef } from 'react';
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
 import videoSrc from './assets/w-bg.mp4';
import Logo from './components/Logo'
import Footer from './components/Footer';

const AdminPortal = lazy(() =>
  import('./components/WorkspacePortals').then(({ AdminPortal }) => ({ default: AdminPortal })),
);
const MusicPortal = lazy(() =>
  import('./components/WorkspacePortals').then(({ MusicPortal }) => ({ default: MusicPortal })),
);
const AuthConfirm = lazy(() => import('./components/AuthConfirm'));

function App() {
  return (
    <>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicSite />} />
        <Route path="/auth/confirm" element={<Suspense fallback={<p className="p-6" role="status">A confirmar acesso...</p>}><AuthConfirm /></Suspense>} />
        <Route path="/admin/*" element={<Suspense fallback={<p className="p-6" role="status">A carregar...</p>}><AdminPortal /></Suspense>} />
        <Route path="/music/*" element={<Suspense fallback={<p className="p-6" role="status">A carregar...</p>}><MusicPortal /></Suspense>} />
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

  useEffect(() => {
    const video = backgroundVideoRef.current;
    if (!video) return;

    const playBackground = () => {
      if (video.paused) void video.play().catch(() => {});
    };

    playBackground();
    document.addEventListener('visibilitychange', playBackground);
    return () => document.removeEventListener('visibilitychange', playBackground);
  }, []);

  return (
    <>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <video
        ref={backgroundVideoRef}
        id="bgVideo"
        className="background-video"
        src={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      />
      <Logo />
      <Menu />
      <main id="main-content" tabIndex={-1}>
        <h1 className="sr-only">Sardinhas Nômades</h1>
        <Banner />
        <Bio />
        <Calendar />
        <SocialCarousel />
        <Events />
        <Contact />
      </main>
      <Footer />
    </>
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
