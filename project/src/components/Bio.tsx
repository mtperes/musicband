import React from 'react';
import '../index.css';
import imgSrc from"../assets/foto-sardinhas.jpg";

const Bio: React.FC = () => {
    return (
      
        <section style={styles.bio} className='bio' id="bio"> 
            <div style={styles.fadeTop}></div> 
            <div style={styles.fadeBottom}></div>  
            
            <h1 style={styles.title}>My App BIO text! hello world !</h1>
            <article> Pork chop boudin beef cow. Ball tip meatball frankfurter beef hamburger, leberkas beef ribs jowl spare ribs venison. Chuck meatloaf meatball pork chop ground round ball tip drumstick salami rump chicken. Jerky shank doner corned beef, tri-tip turkey shoulder boudin ham hock. Beef chislic ham hock corned beef spare ribs short ribs jerky biltong fatback sausage meatball porchetta.</article>
            <img style={styles.img} src={imgSrc} alt="Bio" />
           
        </section>
    );
};

document.body.addEventListener("pointermove", (e)=>{
  const { currentTarget: el, clientX: x, clientY: y } = e;
  if (el instanceof HTMLElement) {
    const { top: t, left: l, width: w, height: h } = el.getBoundingClientRect();
    el.style.setProperty('--posX', `${x - l - w / 2}`);
    el.style.setProperty('--posY', `${y - t - h / 2}`);
  }
})
const styles = {
  
    bio: {
        position:'relative' as const,
        textAlign: 'center' as const,
    },
    title: {
        color: 'tomato',
        fontSize: '74px',
        margin: 0,
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