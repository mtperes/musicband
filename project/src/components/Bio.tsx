import React from 'react';
import '../index.css';
import BandCarousel from"./BandCarousel";
 import { b } from 'framer-motion/client';
import SectionTilte from './sectionTitle';

const Bio: React.FC = () => {
    return (
      
        <section  className='bio h-screen' id="bio"> 
           <SectionTilte titleText="O Cardume" />
              <BandCarousel/>
        
            <article className='md:-mt-40 lg:mx-70 -mt-20 z-10 p-10 relative bg-sky-500/85  rounded-4xl font-(family-name:--font1family) text-justify'> A Sardinhas Nômades é uma vibrante fanfarra formada em 2020, 
              composta por talentosos músicos que dominam percussão, saxofones, trompetes e trombones. 
              Com uma mistura eletrizante de ritmos brasileiros como carnaval, samba e axé, além de toques globais de funk e electro,
               nossos espetáculos são uma explosão de energia e irreverência que contagia qualquer plateia.
                Nosso principal objetivo é trazer a essência do carnaval brasileiro para Lisboa, 
                criando experiências inesquecíveis e unindo culturas através da música. Venha se divertir conosco e sentir 
                o verdadeiro espírito festivo que só a Sardinhas Nômades pode proporcionar!</article>
          
           
        </section>
    );
};


const styles = {
  
    // bio: {
    //     position:'relative' as const,
    //     textAlign: 'center' as const,
    //     height: '100vh',
    //     fontFamily: 'Barrio',

    // },
    // title: {
    //     fontSize: '74px',
    //     margin: 0,
    //     paddingTop: '2rem',
    //     paddingBottom: '2rem',
    //     zIndex: 2,
    // },
    //  text: {
    //      textAlign: 'center' as const,
    //     paddingTop: '2rem',
    //     paddingBottom: '2rem',
    //     zIndex: 2,
    // },
    // img:{
    //   position:'absolute' as const,
    //   top: '0',
    //   left: '0',
    //   opacity: '0.9',
    //   width: '100%',
    //   height: '100%',
      
    // },

};

export default Bio;