// import { rect } from 'framer-motion/client';
import React from 'react';
import { useRef } from 'react';
// import { keyframes } from '@emotion/react';
import imgSrc from"../assets/carnaval-photo.jpg";
import imgSrc2 from"../assets/GalaCriCri-09-03-2023-008.jpeg";
import SectionTilte from './sectionTitle';
import VideoBackground from './VideoBrackground';
import videoSrc from '/public/w-bg.mp4';
const Events: React.FC = () => {
const vidRef = useRef<HTMLVideoElement | null>(null);


    if (vidRef.current) {
      vidRef.current.playbackRate = 0.4;
    }

    return (
        <section className='block justify-center' id='events'>

            <SectionTilte titleText="Eventos" />

            <article className=' h-1/3 md:mx-10 top-auto bg-sky-500/55      md:block lg:flex max-w-screen  p-0 mt-10 mb-10 rounded-4xl overflow-clip '>
              <img className=' z-1' src={imgSrc} alt="Carnaval de Lisboa" />
                
               <div className='p-7 md:mx-10 lg:mt-[45%]    z-10 rounded-4xl lg:absolute lg:w-[60vw] right-0 '>  
                  <video className='video-bg 'style={styles.bgVideo} id="bgVideo" ref={vidRef}  src={videoSrc}   autoPlay muted loop ></video>  
                <h2 className=' text-bold z-10 '>Carnaval de Lisboa</h2>
                <p className='z-10 text-justify  text-1xl'>O Cortejo Sardélico já faz parte do calendário cultural de Lisboa,
                 trazendo irreverência, ritmo e muita animação para o carnaval lisboeta. 
                 Com performances vibrantes e envolventes, a Sardinhas Nômades transforma 
                 as ruas em um verdadeiro espetáculo de música e alegria, contagiando a todos com
                  a essência do carnaval brasileiro. Venha viver essa experiência única conosco! 
                </p>
                </div> 
            </article>

            <article  className=' h-1/3 md:mx-10  md:block lg:flex  max-w-screen    p-0 mt-10 mb-10 bg-sky-500/55 rounded-4xl overflow-clip '>

               <div className='text-right  lg:mt-[50%] p-7 lg:absolute lg:w-[60vw] left-0 z-10 rounded-4xl lg:bg-sky-500/55 lg:mx-10'>
               <video className='video-bg 'style={styles.bgVideo} id="bgVideo" ref={vidRef}  src={videoSrc}   autoPlay muted loop ></video>  
                  <h2 className='text-3xl text-bold z-10 '>Galas e Festas</h2>
              <p className='font-(family-name:--font1family) text-justify text-2xl'>  A Sardinhas Nômades brilha nas galas e eventos
                 mais prestigiados, levando nosso som contagiante e performances
                  inesquecíveis para cada ocasião. Com uma mistura única de ritmos
                   e uma presença de palco inigualável, garantimos que cada festa se torne
                    uma celebração memorável. Junte-se a nós e sinta a energia vibrante que 
                    só a nossa fanfarra pode proporcionar! </p>
                
                </div> 
                      <img className='' src={imgSrc2} alt="Carnaval de Lisboa" />
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
        opacity: .8,
        zIndex: -1,
        borderRadius: '30px',
       
    },
};


 
export default Events;