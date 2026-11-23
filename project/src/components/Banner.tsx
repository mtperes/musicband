import React, { useEffect, useRef } from "react";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useSiteContent } from '../hooks/useSiteContent';


const Banner: React.FC = () => {
  const { sections } = useSiteContent();
  const section = sections.home;
  const asset = section.media[0];
  const prefersReducedMotion = useReducedMotion() ?? false;
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const playBanner = () => {
      if (video.paused) void video.play().catch(() => {});
    };

    playBanner();
    document.addEventListener("visibilitychange", playBanner);
    return () => document.removeEventListener("visibilitychange", playBanner);
  }, [asset?.url]);

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
          {asset && /\.(mp4|webm)(?:\?|$)/i.test(asset.url) ? <video
            ref={videoRef}
            className="banner-video h-full w-full object-cover"
            src={asset.url}
            poster="/events/events1.jpg"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            tabIndex={-1}
          /> : asset ? <img src={asset.url} alt={asset.alt} className="h-full w-full object-cover" fetchPriority="high" /> : null}
        </motion.div>
        {section.text && <div className="absolute inset-x-0 bottom-12 z-10 mx-auto max-w-4xl px-6 text-center"><h2>{section.title}</h2><p className="whitespace-pre-line">{section.text}</p></div>}
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


