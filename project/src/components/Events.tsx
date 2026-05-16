// import { rect } from 'framer-motion/client';
import React from 'react';
// import { keyframes } from '@emotion/react';
import imgSrc from"../assets/carnaval-photo.jpg";
import imgSrc2 from"../assets/GalaCriCri-09-03-2023-008.jpeg";
import SectionTilte from './sectionTitle';

const Events: React.FC = () => {

    return (
        <section className='block justify-center' id='events'>

            <SectionTilte titleText="Eventos" />

            <article className=' md:mx-10   lg:mx-80   md:block lg:flex max-w-screen lg:max-w-6xl  p-0mt-10 mb-10 bg-sky-500/55 rounded-4xl overflow-clip '>
              <img className='h-112 w-240 ' src={imgSrc} alt="Carnaval de Lisboa" />
                
               <div className='p-7'>  
                <h2 className='text-3xl text-bold z-10 '>Carnaval de Lisboa</h2>
                <p className='font-(family-name:--font1family) text-1xl z-10 text-justify  text-2xl'>O Cortejo Sardélico já faz parte do calendário cultural de Lisboa,
                 trazendo irreverência, ritmo e muita animação para o carnaval lisboeta. 
                 Com performances vibrantes e envolventes, a Sardinhas Nômades transforma 
                 as ruas em um verdadeiro espetáculo de música e alegria, contagiando a todos com
                  a essência do carnaval brasileiro. Venha viver essa experiência única conosco! 
                </p>
                </div>
            </article>

            <article  className='md:mx-10 lg:mx-80  md:block lg:flex  max-w-screen  lg:max-w-6xl  p-0 mt-10 mb-10 bg-sky-500/55 rounded-4xl overflow-clip '>

               <div className='text-right p-7'>
                  <h2 className='text-3xl text-bold z-10 '>Galas e Festas</h2>
              <p className='font-(family-name:--font1family) text-justify text-2xl'>  A Sardinhas Nômades brilha nas galas e eventos
                 mais prestigiados, levando nosso som contagiante e performances
                  inesquecíveis para cada ocasião. Com uma mistura única de ritmos
                   e uma presença de palco inigualável, garantimos que cada festa se torne
                    uma celebração memorável. Junte-se a nós e sinta a energia vibrante que 
                    só a nossa fanfarra pode proporcionar! </p>
                
                </div> 
                      <img className='h-112 w-240 ' src={imgSrc2} alt="Carnaval de Lisboa" />
            </article>


        </section>
    );
};
 
export default Events;