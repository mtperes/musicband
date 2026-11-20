import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperInstance } from 'swiper';
import { Autoplay, Keyboard, Parallax, Navigation, Pagination } from 'swiper/modules';
import { motion, useReducedMotion } from 'framer-motion';
import { useSiteContent } from '../hooks/useSiteContent';
import { youtubeVideoId } from '../utils/youtube';
import { loadYouTubeAPI, type YouTubePlayer } from '../utils/youtubePlayer';
import SectionTitle from './sectionTitle';
import './VideoGallery.css';

function VideoPlayer({ videoId, index, active, onInteract }: { videoId: string; index: number; active: boolean; onInteract: (slide: HTMLElement) => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const playback = useRef({ ready: false });
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);
  const interaction = useRef(onInteract);

  useEffect(() => { interaction.current = onInteract; }, [onInteract]);

  function selectVideo() {
    const slide = frame.current?.closest<HTMLElement>('.swiper-slide');
    if (slide) interaction.current(slide);
  }

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      if (entry.isIntersecting) setNear(true);
      setVisible(entry.isIntersecting && entry.intersectionRatio > .5);
    }, { threshold: [0, .51] });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!player.current || !playback.current.ready) return;
    if (!active || !visible || document.visibilityState !== 'visible') player.current.pauseVideo();
  }, [active, visible]);

  useEffect(() => {
    if (!near || !mount.current) return;
    const playbackState = playback.current;
    let current = true;
    void loadYouTubeAPI().then(api => {
      if (!current || !mount.current) return;
      player.current = new api.Player(mount.current, {
        host: 'https://www.youtube-nocookie.com', width: '100%', height: '100%', videoId,
        playerVars: { controls: 1, autoplay: 0, mute: 1, playsinline: 1, enablejsapi: 1, rel: 0, fs: 0, origin: window.location.origin },
        events: {
          onReady: event => {
            if (!current) return;
            event.target.mute();
            const iframe = event.target.getIframe();
            iframe.title = `Vídeo ${index + 1}`;
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
            playback.current.ready = true;
            if (document.visibilityState !== 'visible') event.target.pauseVideo();
          },
          onError: () => { if (current) setError(true); },
        },
      });
    }).catch(() => { if (current) setError(true); });
    const visibility = () => {
      if (!player.current || !playback.current.ready) return;
      if (document.visibilityState !== 'visible') player.current.pauseVideo();
    };
    const iframeFocus = () => {
      requestAnimationFrame(() => {
        if (!current || !player.current || document.activeElement !== player.current.getIframe()) return;
        const slide = frame.current?.closest<HTMLElement>('.swiper-slide');
        if (slide) interaction.current(slide);
      });
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', iframeFocus);
    return () => {
      current = false; document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', iframeFocus);
      playbackState.ready = false; player.current?.destroy(); player.current = null;
    };
  }, [near, videoId, index]);

  return <div className="video-gallery-item">
    <div className="video-gallery-frame" ref={frame} onPointerDown={selectVideo} onFocusCapture={selectVideo}>
      {!near && <img src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt={`Vídeo ${index + 1}`} loading="lazy" />}
      <div ref={mount} />
    </div>
    {error && <p className="video-gallery-error" role="status">Vídeo indisponível <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener">YouTube <ExternalLink size={13} /></a></p>}
  </div>;
}

export default function VideoGallery() {
  const { videos } = useSiteContent();
  const reducedMotion = useReducedMotion() ?? false;
  const carousel = useRef<SwiperInstance | null>(null);
  const selected = useRef<HTMLElement | null>(null);
  const section = useRef<HTMLElement>(null);
  const interacted = useRef(false);
  const [gap, setGap] = useState(() => parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.7);

  useEffect(() => {
    const resize = () => setGap(parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.7);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!section.current || reducedMotion || !videos?.visible || videos.links.length < 2) return;
    const observer = new IntersectionObserver(entries => {
      const swiper = carousel.current;
      if (!swiper || swiper.destroyed) return;
      if (!entries[0].isIntersecting) {
        const position = swiper.getTranslate();
        swiper.autoplay.stop(); swiper.translateTo(position, 0, false, false); swiper.animating = false;
        selected.current = null; interacted.current = false;
        swiper.el.removeAttribute('data-interacting'); swiper.params.speed = 18000;
      } else if (!interacted.current) {
        swiper.params.speed = 18000; swiper.autoplay.start();
      }
    });
    observer.observe(section.current);
    return () => observer.disconnect();
  }, [reducedMotion, videos?.visible, videos?.links.length]);

  function stopForInteraction() {
    const swiper = carousel.current;
    if (!swiper || swiper.destroyed) return;
    interacted.current = true;
    const position = swiper.getTranslate();
    swiper.autoplay.stop(); swiper.translateTo(position, 0, false, false); swiper.animating = false;
    swiper.el.dataset.interacting = 'true'; swiper.params.speed = reducedMotion ? 0 : 450;
  }

  function centerVideo(slide: HTMLElement) {
    const swiper = carousel.current;
    if (!swiper || swiper.destroyed) return;
    const slideBounds = slide.getBoundingClientRect();
    const carouselBounds = swiper.el.getBoundingClientRect();
    const centered = Math.abs(slideBounds.left + slideBounds.width / 2 - carouselBounds.left - carouselBounds.width / 2) < 2;
    if (selected.current === slide && !swiper.autoplay.running && centered) return;
    const index = swiper.slides.indexOf(slide);
    if (index < 0) return;
    selected.current = slide;
    stopForInteraction();
    swiper.slideTo(index, reducedMotion ? 0 : 450);
  }
  if (!videos?.visible || !videos.links.length) return null;
  const links = videos.links.length === 2 ? [...videos.links, ...videos.links, ...videos.links] : videos.links;
  return <section id="videos" className="video-gallery" aria-labelledby="videos-heading" ref={section}>
    <SectionTitle titleText={videos.title} id="videos-heading" />
    {videos.text && <p className="video-gallery-text whitespace-pre-line">{videos.text}</p>}
    <div className="video-gallery-stage">
    {links.length > 1 && <motion.button type="button" className="video-gallery-arrow video-gallery-prev" aria-label="Vídeo anterior" title="Vídeo anterior" onPointerDown={stopForInteraction} onFocus={stopForInteraction} whileHover={reducedMotion ? undefined : { scale: 1.19, x: -4 }} whileTap={reducedMotion ? undefined : { scale: 1.285, x: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}><ChevronLeft size={44} /></motion.button>}
    <Swiper modules={[Keyboard, Parallax, Navigation, Pagination, Autoplay]} slidesPerView="auto" centeredSlides spaceBetween={gap} parallax loop={links.length > 1} speed={reducedMotion ? 0 : 18000}
      autoplay={reducedMotion || links.length < 2 ? false : { delay: 0, disableOnInteraction: true, reverseDirection: true }}
      onSwiper={swiper => { carousel.current = swiper; }}
      navigation={links.length > 1 ? { prevEl: '.video-gallery-prev', nextEl: '.video-gallery-next' } : false}
      pagination={links.length > 1 ? { clickable: true, bulletElement: 'button', renderBullet: (index, className) => `<button type="button" class="${className}" aria-label="Ir para vídeo ${index + 1}"></button>` } : false}
      onPointerDownCapture={event => { if ((event.target as HTMLElement).closest('.swiper-pagination')) stopForInteraction(); }}
      onFocusCapture={event => { if ((event.target as HTMLElement).closest('.swiper-pagination')) stopForInteraction(); }}
      keyboard={{ enabled: true, onlyInViewport: true }}>
      {links.map((link, index) => <SwiperSlide key={`${link}-${index}`}>
        {({ isActive }) => <VideoPlayer videoId={youtubeVideoId(link)} index={index} active={isActive} onInteract={centerVideo} />}
      </SwiperSlide>)}
    </Swiper>
    {links.length > 1 && <motion.button type="button" className="video-gallery-arrow video-gallery-next" aria-label="Vídeo seguinte" title="Vídeo seguinte" onPointerDown={stopForInteraction} onFocus={stopForInteraction} whileHover={reducedMotion ? undefined : { scale: 1.19, x: 4 }} whileTap={reducedMotion ? undefined : { scale: 1.285, x: 6 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}><ChevronRight size={44} /></motion.button>}
    </div>
  </section>;
}