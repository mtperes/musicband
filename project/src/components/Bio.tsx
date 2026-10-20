import React from "react";
import "../index.css";
import BandCarousel from "./BandCarousel";
import { b } from "framer-motion/client";
import SectionTilte from "./sectionTitle";
import { TextFade } from "../effects/TextFade"; 
import videoSrc from "/public/w-bg.mp4";
import { useRef } from "react";
const Bio: React.FC = () => {
  const vidRef = useRef<HTMLVideoElement | null>(null);
  if (vidRef.current) {
    vidRef.current.playbackRate = 1;
  }
  return (
    <section className="bio h-screen" id="bio">
      <SectionTilte titleText="O Cardume" />
      <BandCarousel />

      <article className="md:-mt-40 lg:mx-70 -mt-20 z-10 p-4 lg:p-10 relative bg-sky-500/20 rounded-4xl font-(family-name:--font1family) text-justify">
        <video
          className="video-bg "
          style={styles.bgVideo}
          id="bgVideo"
          ref={vidRef}
          src={videoSrc}
          autoPlay
          muted
          loop
        ></video>
        <TextFade direction="up">
              <h2 className="mb-3"> Sardinhas Nômades</h2>
          <p className="mb-10">
             Compomos uma vibrante
            fanfarra formada em 2020, composta por talentosos músicos que
            dominam percussão, saxofones, trompetes e trombones. Com uma mistura
            eletrizante de ritmos brasileiros como carnaval, samba e axé, além
            de toques globais de funk e electro, nossos espetáculos são uma
            explosão de energia e irreverência que contagia qualquer plateia.
            Nosso principal objetivo é trazer a essência do carnaval brasileiro
            para Lisboa, criando experiências inesquecíveis e unindo culturas
            através da música. Venha se divertir conosco e sentir o verdadeiro
            espírito festivo que só a Sardinhas Nômades pode proporcionar!
            
          </p>
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
