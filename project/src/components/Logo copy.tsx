import React, { useRef } from "react";

import { motion, useScroll, useTransform } from "framer-motion";

import logo from "../assets/sardinhas-logo.svg";
function scrollTo(target: string) {
  const element = document.getElementById(target);           
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

const Logo: React.FC = () => {
 

  const targetRefLogo = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRefLogo,
    offset: ["start end", "end start"],
   
  });
 
 
  const scaleLogo = useTransform(scrollYProgress, [0, 1], [2.75, 0.25]);
  const y = useTransform(scrollYProgress, [0, 0.2, 1], [0, '35%', '-7%']);
  const x = useTransform(scrollYProgress, [0, 0.2, 1], [0,'190%', '-35%']);
    const opacity = useTransform(scrollYProgress, [0, 0.2, 1], [0 ,0.012, 1]);
    // const opacitybg = useTransform(scrollYProgress, [0, 0.2, 1], [0 ,0.5, 1]);

  const rotateLogo = useTransform(scrollYProgress, [0, 0.7, 1], ["50deg", "15deg" , "0deg"]); 
  return (

    <section style={styles.logostyle}>

        <button className='position-fixed w-1.5 h-1.5' onClick={() => scrollTo("home")}>  <motion.img
        style={{
          position: "fixed" as const,
          translateY: y,
          translateX: x,
          overflow: "hidden",
          scale: scaleLogo,
          zIndex: 2,
          rotate: rotateLogo,
          padding: "1.7rem",
          opacity: opacity,
          backgroundColor: "#EEEEEEff",
          borderRadius: "50%",
         
        }}
        ref={targetRefLogo}
        className="logo"
        src={logo}
        alt=""

      /></button>

      
    
    
    </section>
  );
};

const styles = {
  logostyle: {
    position: "fixed" as const,
    top: "0",
    left:"0",
    textAlign: "center" as const,
    // width: "100%",
    // height: "700vh",
    paddingTop: "1rem",
    marginTop: "1rem",
    marginBottom: "10rem",
  
    zIndex: 2,
  },
};

export default Logo;

