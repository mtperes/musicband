// import { rect } from 'framer-motion/client';
import React from 'react';
import { useReducedMotion } from 'framer-motion';
import imgSrc from"/public/events/events1.jpg";
import imgSrc2 from"/public/events/events2.jpg";
import SectionTilte from './sectionTitle';
import MediaImage from './MediaImage';
import videoSrc from '/w-bg.mp4';
import { TextFade } from '../effects/TextFade';
const Events: React.FC = () => {
        const prefersReducedMotion = useReducedMotion() ?? false;

    return (
                <section className='block justify-center px-2 sm:px-6 lg:px-10' id='events' aria-labelledby='events-heading'>

                        <SectionTilte titleText="Eventos" id="events-heading" />

                        <article className='relative isolate mx-auto mt-10 mb-10 grid max-w-screen-2xl grid-cols-1 overflow-hidden rounded-4xl bg-sky-500/25 p-0 lg:grid-cols-2'>
                              <MediaImage className='order-1 h-64 w-full object-cover sm:h-80 lg:h-full lg:min-h-[30rem]' src={imgSrc} alt="Sardinhas Nômades no Carnaval de Lisboa" loading="lazy" decoding="async" />
                
                             <div className='relative isolate order-2 bg-sky-500/25 p-5 sm:p-8 lg:flex lg:items-center lg:p-10'>  
                                    <video className='pointer-events-none absolute inset-0 h-full w-full object-cover' style={styles.bgVideo} src={videoSrc} poster="/events/events1.jpg" autoPlay={!prefersReducedMotion} muted loop={!prefersReducedMotion} playsInline preload={prefersReducedMotion ? "none" : "metadata"} aria-hidden="true" tabIndex={-1} />
                                <TextFade className="relative z-10" direction="up">  
                                <h3 className='mb-3 text-2xl font-bold md:text-3xl'>Carnaval de Lisboa</h3>
                                <p className='text-justify text-base sm:text-lg'>O Cortejo Sardélico já faz parte do calendário cultural de Lisboa,
                 trazendo irreverência, ritmo e muita animação para o carnaval lisboeta. 
                 Com performances vibrantes e envolventes, a Sardinhas Nômades transforma 
                 as ruas em um verdadeiro espetáculo de música e alegria, contagiando a todos com
                  a essência do carnaval brasileiro. Venha viver essa experiência única conosco! 
                </p>
                </TextFade>
                </div> 
            </article>

                <article className='relative isolate mx-auto mt-10 mb-10 grid max-w-screen-2xl grid-cols-1 overflow-hidden rounded-4xl bg-sky-500/25 p-0 lg:grid-cols-2'>

                    <div className='relative isolate order-2 bg-sky-500/25 p-5 sm:p-8 lg:order-1 lg:flex lg:items-center lg:p-10'>
                    <video className='pointer-events-none absolute inset-0 h-full w-full object-cover' style={styles.bgVideo} src={videoSrc} poster="/events/events2.jpg" autoPlay={!prefersReducedMotion} muted loop={!prefersReducedMotion} playsInline preload={prefersReducedMotion ? "none" : "metadata"} aria-hidden="true" tabIndex={-1} />
                    <TextFade className="relative z-10" direction="up">
                        <h3 className='mb-3 text-2xl font-bold md:text-3xl'>Galas e Festas</h3>
                  <p className='text-justify text-base font-(family-name:--font1family) sm:text-lg'>A Sardinhas Nômades brilha nas galas e eventos
                 mais prestigiados, levando nosso som contagiante e performances
                  inesquecíveis para cada ocasião. Com uma mistura única de ritmos
                   e uma presença de palco inigualável, garantimos que cada festa se torne
                    uma celebração memorável. Junte-se a nós e sinta a energia vibrante que 
                    só a nossa fanfarra pode proporcionar! </p></TextFade>
                
                </div> 
                      <MediaImage className='order-1 h-64 w-full object-cover sm:h-80 lg:order-2 lg:h-full lg:min-h-[30rem]' src={imgSrc2} alt="Sardinhas Nômades em uma gala ou festa" loading="lazy" decoding="async" />
            </article>


        </section>
    );
}
    const styles = {
    bgVideo: {
        position: 'absolute' as const,
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        opacity: .25,
        zIndex: 0,
        borderRadius: '30px',
       
    },
};


 
export default Events;