import React, { useState, useEffect } from "react";
// ... (rest of the imports)

import { motion, useScroll, useTransform } from "framer-motion";

import logo from "../assets/sardinhas-logo.svg";
function scrollTo(target: string) {
  const element = document.getElementById(target);           
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
  }

const Logo: React.FC = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const logoSize = isMobile ? 80 : 96;

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const { scrollY } = useScroll();
  const scrollYProgress = useTransform(scrollY, [0, viewport.height * (isMobile ? 0.5 : 0.65)], [0, 1]);
 
 
  const scaleLogo = useTransform(scrollYProgress, [0, 1], isMobile ? [3, 1] : [8, 1.2]);
  const y = useTransform(scrollYProgress, [0, 1], [(viewport.height - logoSize) / 2, 26]);
  const x = useTransform(scrollYProgress, [0, 1], [(viewport.width - logoSize) / 2, 26]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.7, 1]);
  // const opacitybg = useTransform(scrollYProgress, [0, 0.2, 1], [0 ,0.5, 1]);
  const rotateLogo = useTransform(scrollYProgress, [0, 0.7, 1], isMobile ? ["35deg", "25deg" , "0deg"] : ["35deg", "25deg" , "-10deg"]);
  return (

    <section  style={styles.logostyle}>

        <button aria-label="Voltar ao início" className='w-1.5 h-1.5' onClick={() => scrollTo("home")}>  <motion.img
        style={{
          position: "absolute" as const,
          top: 0,
          left: 0,
          width: logoSize,
          height: logoSize,
          padding: ".15rem",
          transition: "none",
          y,
          x,
          overflow: "visible",
          scale: scaleLogo,
          aspectRatio: "1 / 1",
          objectFit: "contain" as const,
          maxWidth: "none",
          zIndex: 150,
          rotate: rotateLogo,
          opacity: opacity,
          backgroundColor: "#EEEEEEff",
          borderRadius: "50%",
        }}
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
    left: "0",
    right: "0",
    overflow: "visible",
    display: "flex",
    padding: "0",
    zIndex: 150,
  },
};

export default Logo;