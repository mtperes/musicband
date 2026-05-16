import React, { useRef, useState, useEffect } from "react";
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

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", handleResize);
    handleResize(); // Initial check
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const targetRefLogo = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRefLogo,
    offset: ["start end", "end start"],
   
  });
 
 
  const scaleLogo = useTransform(scrollYProgress, [0, 1], isMobile ? [50, 1] : [40, 1]);
  const y = useTransform(scrollYProgress, [0, 0.2, 1], isMobile ? ['660%', '2500%', '60%'] : ['2000%', '2200%', '10%']);
  const x = useTransform(scrollYProgress, [0, 0.2, 1], isMobile ? ['660%', '1800%', '15%'] : ['4000%','4300%', '14%']);
  const opacity = useTransform(scrollYProgress, [0, 0.8, 1], isMobile ? [0 ,0.0001, 1] : [0 ,0.0001, 1]);
  // const opacitybg = useTransform(scrollYProgress, [0, 0.2, 1], [0 ,0.5, 1]);
  const rotateLogo = useTransform(scrollYProgress, [0, 0.7, 1], isMobile ? ["95deg", "125deg" , "-20deg"] : ["95deg", "25deg" , "0deg"]);
  return (

    <section  style={styles.logostyle}>

        <button className=' w-1.5 h-1.5' onClick={() => scrollTo("home")}>  <motion.img
style={{
          position: "absolute" as const,
          translateY: y,
          translateX: x,
          overflow: "hidden",
          scale: scaleLogo,
          zIndex: 25,
          rotate: rotateLogo,
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
    left: "0",
    right: "0",
    overflow: "visible",
    display: "flex",
    padding: "0",
    zIndex: 25,
  },
};

export default Logo;

