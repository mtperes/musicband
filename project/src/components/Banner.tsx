import React, { useEffect, useRef, useState } from "react";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import videoSrc from "../assets/banner-video.mov";
import mobileVideoSrc from "../assets/w-bg.mp4";


const Banner: React.FC = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [isNarrowViewport, setIsNarrowViewport] = useState(() =>
    window.matchMedia("(max-width: 767px)").matches,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const activeVideoSrc = isNarrowViewport ? mobileVideoSrc : videoSrc;

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsNarrowViewport(mobileQuery.matches);
    mobileQuery.addEventListener("change", updateViewport);
    return () => mobileQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playBanner = () => {
      if (video.paused) void video.play().catch(() => {});
    };

    playBanner();
    document.addEventListener("visibilitychange", playBanner);
    return () => document.removeEventListener("visibilitychange", playBanner);
  }, [activeVideoSrc]);

  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [1, 1] : [1.5, 0.75]);
  const y = useTransform(scrollYProgress, [0, 1], prefersReducedMotion ? [0, 0] : [250, -250]);

  const opacity = useTransform(scrollYProgress, [0.25, 0.5, 0.75], [1, 1, 0]);
  return (
    <section id='home' style={styles.banner}>
    
    <div className="relative h-dvh min-h-[32rem] overflow-hidden md:h-screen">
        <motion.div
          className="absolute inset-0 h-full w-full"
          style={{
            opacity: prefersReducedMotion ? 1 : opacity,
            y,
            borderRadius: "0px",
            overflow: "hidden",
            scale,
          }}
          ref={targetRef}
        >
          <video
            key={activeVideoSrc}
            ref={videoRef}
            className="banner-video h-full w-full object-cover"
            src={activeVideoSrc}
            poster="/events/events1.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          />
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


