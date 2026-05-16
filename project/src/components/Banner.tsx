import React, { useRef } from "react";

import { motion, useScroll, useTransform } from "framer-motion";
import videoSrc from "../assets/banner-video.mov";


const Banner: React.FC = () => {
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1.5, 0.75]);
  const y = useTransform(scrollYProgress, [0, 1], [250, -250]);

  const opacity = useTransform(scrollYProgress, [0.25, 0.5, 0.75], [1, 1, 0]);
  return (
    <section id='home' style={styles.banner}>
    
    <div className="relative h-screen overflow-clip"> 
        <motion.div
          style={{
            position: "relative" as const,
            backgroundImage: `url(${videoSrc})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            // height: `calc(100vh - 10px)`,
            // top: 5,
            opacity,
            y,
            borderRadius: "0px",
            overflow: "hidden",
            scale,
          }}
          ref={targetRef}
        >
          <video
            className="banner-video object-cover w-screen h-screen"
            src={videoSrc}
            title="Sardinahs nomades video"
            autoPlay
            loop
            muted
          ></video>
        </motion.div>
      </div>
    </section>
  );
};

const styles = {
  banner: {
    position: "relative" as const,
    textAlign: "left" as const,
    width: "100%",
    padding: "0",

   
  },
};

export default Banner;


