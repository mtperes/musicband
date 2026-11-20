import defaults from './siteDefaults.json';
import logo from '../assets/sardinhas-logo.svg';
import headingStart from '../assets/sardinhas-head-logo.svg';
import headingEnd from '../assets/sardinhas-logo-tail.svg';
import backgroundVideo from '../assets/w-bg.mp4';
import bannerVideo from '../assets/banner-video.mp4';
import { publicCalendarUrl } from './calendarSource';
import { youtubeVideoId } from './youtube';

export type SiteAsset = { url: string; alt: string; path?: string; bucket?: 'band-site-media' | 'band-site-drafts' };
export type SiteSection = { label: string; title: string; subtitle?: string; text: string; visible: boolean; media: SiteAsset[] };
export const sectionKeys = ['home', 'bio', 'calendar', 'socials', 'events', 'contact'] as const;
export type SectionKey = typeof sectionKeys[number];
export const fontOptions = ['Cubano', 'Rubik', 'Barrio', 'Limelight', 'Electrolize', 'Funnel Display'] as const;
export type Typeface = { font: typeof fontOptions[number]; color: string };
export type VideoGalleryContent = { label: string; title: string; text: string; visible: boolean; links: string[] };
export const defaultVideoGallery: VideoGalleryContent = { label: 'Videos', title: 'Videos', text: '', visible: true, links: [] };
export type SiteContent = {
  name: string;
  videos?: VideoGalleryContent;
  calendarUrl?: string;
  identity: { logo: SiteAsset; logoBackground: string; headingImagesVisible?: boolean; backgroundMode: 'color' | 'image' | 'video'; backgroundColor: string; backgroundImage: SiteAsset | null; backgroundVideo: SiteAsset | null; headingStart: SiteAsset; headingEnd: SiteAsset };
  typography: { titles: Typeface; subtitles: Typeface; text: Typeface };
  sections: Record<SectionKey, SiteSection>;
  events: { id: string; title: string; text: string; image: SiteAsset | null }[];
  instagramUrl: string;
  instagramLabel: string;
  footerText: string;
};

export function defaultSiteContent(): SiteContent {
  const content = structuredClone(defaults) as SiteContent;
  content.identity.logo.url = logo;
  content.identity.headingStart.url = headingStart;
  content.identity.headingEnd.url = headingEnd;
  content.identity.backgroundVideo!.url = backgroundVideo;
  content.sections.home.media[0].url = bannerVideo;
  return content;
}

export function mapSiteAssets(content: SiteContent, transform: (asset: SiteAsset) => SiteAsset): SiteContent {
  const result = structuredClone(content);
  result.identity.logo = transform(result.identity.logo);
  result.identity.headingStart = transform(result.identity.headingStart);
  result.identity.headingEnd = transform(result.identity.headingEnd);
  if (result.identity.backgroundImage) result.identity.backgroundImage = transform(result.identity.backgroundImage);
  if (result.identity.backgroundVideo) result.identity.backgroundVideo = transform(result.identity.backgroundVideo);
  for (const key of sectionKeys) result.sections[key].media = result.sections[key].media.map(transform);
  result.events = result.events.map(event => ({ ...event, image: event.image ? transform(event.image) : null }));
  return result;
}

export function safeSiteUrl(value: string): boolean {
  return /^\/(?!\/)/.test(value) || /^https:\/\//.test(value);
}

export function validateSiteContent(content: SiteContent): void {
  if (!content || typeof content.name !== 'string' || !content.name.trim() || content.name.length > 160) throw new Error('Indique o nome da banda (até 160 caracteres).');
  if (!content.identity || !['color', 'image', 'video'].includes(content.identity.backgroundMode)) throw new Error('Fundo inválido.');
  if (content.calendarUrl !== undefined) publicCalendarUrl(content.calendarUrl);
  if (content.identity.headingImagesVisible !== undefined && typeof content.identity.headingImagesVisible !== 'boolean') throw new Error('Visibilidade das imagens dos títulos inválida.');
  if (content.videos !== undefined) {
    const videos = content.videos;
    if (!videos || typeof videos.visible !== 'boolean' || typeof videos.label !== 'string' || !videos.label.trim() || videos.label.length > 100 || typeof videos.title !== 'string' || !videos.title.trim() || videos.title.length > 160 || typeof videos.text !== 'string' || videos.text.length > 20000 || !Array.isArray(videos.links) || videos.links.length > 20) throw new Error('Galeria de vídeos inválida (máximo de 20 vídeos).');
    for (const link of videos.links) { if (typeof link !== 'string' || link.length > 2000) throw new Error('Ligação do YouTube inválida.'); youtubeVideoId(link); }
  }
  for (const color of [content.identity.backgroundColor, content.identity.logoBackground, ...Object.values(content.typography).map(type => type.color)]) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Cor inválida.');
  }
  for (const key of ['titles', 'subtitles', 'text'] as const) {
    if (!fontOptions.includes(content.typography[key].font)) throw new Error('Tipo de letra inválido.');
  }
  for (const key of sectionKeys) {
    const section = content.sections[key];
    if (!section || typeof section.visible !== 'boolean' || typeof section.label !== 'string' || !section.label.trim() || section.label.length > 100 || typeof section.title !== 'string' || !section.title.trim() || section.title.length > 160 || typeof section.text !== 'string' || section.text.length > 20000 || (section.subtitle !== undefined && (typeof section.subtitle !== 'string' || section.subtitle.length > 500)) || !Array.isArray(section.media) || section.media.length > 50) throw new Error('Conteúdo de secção inválido.');
  }
  if (!Array.isArray(content.events) || content.events.length > 50) throw new Error('Máximo de 50 eventos.');
  for (const event of content.events) {
    if (typeof event.id !== 'string' || typeof event.title !== 'string' || !event.title.trim() || event.title.length > 160 || typeof event.text !== 'string' || event.text.length > 20000) throw new Error('Evento inválido.');
  }
  if (typeof content.footerText !== 'string' || content.footerText.length > 2000 || typeof content.instagramLabel !== 'string' || content.instagramLabel.length > 160 || typeof content.instagramUrl !== 'string' || (content.instagramUrl && !/^https:\/\//.test(content.instagramUrl))) throw new Error('Ligação ou rodapé inválido.');
  mapSiteAssets(content, asset => {
    if (!asset || !safeSiteUrl(asset.url) || typeof asset.alt !== 'string' || asset.alt.length > 500) throw new Error('Ficheiro ou descrição inválida.');
    if (asset.bucket && (!['band-site-media', 'band-site-drafts'].includes(asset.bucket) || !asset.path || !/^[0-9a-f-]{36}\/[a-zA-Z0-9._-]+$/.test(asset.path))) throw new Error('Caminho de ficheiro inválido.');
    return asset;
  });
}