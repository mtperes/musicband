import React from "react";
import "../index.css";
import BandCarousel from "./BandCarousel";
import { useReducedMotion } from "framer-motion";
import SectionTilte from "./sectionTitle";
import { TextFade } from "../effects/TextFade"; 
import { useSiteContent } from '../hooks/useSiteContent';
const Bio: React.FC = () => {
  const { sections, identity } = useSiteContent();
  const section = sections.bio;
  const prefersReducedMotion = useReducedMotion() ?? false;
  return (
    <section className="bio min-h-screen px-3 sm:px-5 md:px-8" id="bio" aria-labelledby="bio-heading">
      <SectionTilte titleText={section.title} id="bio-heading" />
      <BandCarousel />

      <article className="relative z-10 -mt-20 rounded-4xl bg-sky-500/20 p-4 text-justify m-auto max-w-screen-2xl sm:p-5 md:-mt-32 lg:-mt-40 lg:p-10 font-(family-name:--font1family)">
        {identity.backgroundMode === 'video' && identity.backgroundVideo && <video
          className="video-bg "
          style={styles.bgVideo}
          src={identity.backgroundVideo.url}
          autoPlay={!prefersReducedMotion}
          muted
          loop={!prefersReducedMotion}
          playsInline
          preload={prefersReducedMotion ? "none" : "metadata"}
          aria-hidden="true"
          tabIndex={-1}
        ></video>}
        <TextFade direction="up">
                <h3 className="mb-3">{section.subtitle}</h3>
              <p className="mb-10 whitespace-pre-line">{section.text}</p>
        </TextFade>
      </article>
    </section>
  );
};
const styles = {
  bgVideo: {
    position: "absolute" as const,
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
    zIndex: -1,
    borderRadius: "30px",
    opacity: 0.6,
  },
};
export default Bio;
