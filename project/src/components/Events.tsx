import { useReducedMotion } from 'framer-motion';
import SectionTitle from './sectionTitle';
import MediaImage from './MediaImage';
import { TextFade } from '../effects/TextFade';
import { useSiteContent } from '../hooks/useSiteContent';

export default function Events() {
    const prefersReducedMotion = useReducedMotion() ?? false;
    const { sections, events, identity } = useSiteContent();
    return (
        <section className="block justify-center px-2 sm:px-6 lg:px-10" id="events" aria-labelledby="events-heading">
            <SectionTitle titleText={sections.events.title} id="events-heading" />
            {sections.events.text && <p className="mx-auto max-w-4xl whitespace-pre-line">{sections.events.text}</p>}
            {events.map((event, index) => (
                <article key={event.id} className={`relative isolate mx-auto my-10 grid max-w-screen-2xl grid-cols-1 overflow-hidden rounded-4xl bg-sky-500/25 p-0 ${event.image ? 'lg:grid-cols-2' : ''}`}>
                    {event.image && <MediaImage className={`order-1 h-64 w-full object-cover sm:h-80 lg:h-full lg:min-h-[30rem] ${index % 2 ? 'lg:order-2' : ''}`} src={event.image.url} alt={event.image.alt} loading="lazy" decoding="async" />}
                    <div className={`relative isolate order-2 bg-sky-500/25 p-5 sm:p-8 lg:flex lg:items-center lg:p-10 ${index % 2 ? 'lg:order-1' : ''}`}>
                        {identity.backgroundMode === 'video' && identity.backgroundVideo && <video className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25" src={identity.backgroundVideo.url} poster={event.image?.url} autoPlay={!prefersReducedMotion} muted loop={!prefersReducedMotion} playsInline preload={prefersReducedMotion ? 'none' : 'metadata'} aria-hidden="true" tabIndex={-1} />}
                        <TextFade className="relative z-10" direction="up"><h3 className="mb-3 text-2xl font-bold md:text-3xl">{event.title}</h3><p className="whitespace-pre-line text-justify text-base sm:text-lg">{event.text}</p></TextFade>
                    </div>
                </article>
            ))}
        </section>
    );
}