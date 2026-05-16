import React from 'react';
import '../index.css';
// import imgSrc from"../assets/foto-sardinhas.jpg";
// import { b } from 'framer-motion/client';
import SectionTilte from './sectionTitle';

const Bio: React.FC = () => {
    return (
      
        <section style={styles.bio} className='bio' id="bio"> 
            {/* <div style={styles.fadeTop}></div> 
            <div style={styles.fadeBottom}></div>  
              <img style={styles.img} src={imgSrc} alt="Bio"/> */}
           <SectionTilte titleText="O Cardume" />
            <article style={styles.text} className='md:mx-10 lg:mx-80 p-5  bg-sky-500/55  rounded-4xl font-(family-name:--font1family) text-justify'> A Sardinhas Nômades é uma vibrante fanfarra formada em 2020, 
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
  
    bio: {
        position:'relative' as const,
        textAlign: 'center' as const,
        height: '100vh',
        fontFamily: 'Barrio',

    },
    title: {
        fontSize: '74px',
        margin: 0,
        paddingTop: '2rem',
        paddingBottom: '2rem',
        zIndex: 2,
    },
     text: {
         textAlign: 'center' as const,
        paddingTop: '2rem',
        paddingBottom: '2rem',
        zIndex: 2,
    },
    img:{
      position:'absolute' as const,
      top: '0',
      left: '0',
      opacity: '0.3',
      width: '100%',
      height: '100%',
      
    },
    fadeTop:{
      position:'absolute' as const,
      top: '0',
      width: '100%',
      height: '10rem',
      background: 'linear-gradient(to bottom, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0))',
      zIndex: 1,
      },
    fadeBottom:{
      position:'absolute' as const,
      bottom: '0',
      width: '100%',
      height: '10rem',
      background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0), rgba(255, 255, 255, 1))',
      zIndex: 1,
      }
};

export default Bio;