import React from "react";
import "../index.css";
import BandCarousel from "./BandCarousel";
import { useReducedMotion } from "framer-motion";
import SectionTilte from "./sectionTitle";
import { TextFade } from "../effects/TextFade"; 
import videoSrc from "/w-bg.mp4";
const Bio: React.FC = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  return (
    <section className="bio min-h-screen px-3 sm:px-5 md:px-8" id="bio" aria-labelledby="bio-heading">
      <SectionTilte titleText="O Cardume" id="bio-heading" />
      <BandCarousel />

      <article className="relative z-10 -mt-20 rounded-4xl bg-sky-500/20 p-4 text-justify sm:p-5 md:-mt-32 md:p-8 lg:mx-70 lg:-mt-40 lg:p-10 font-(family-name:--font1family)">
        <video
          className="video-bg "
          style={styles.bgVideo}
          src={videoSrc}
          autoPlay={!prefersReducedMotion}
          muted
          loop={!prefersReducedMotion}
          playsInline
          preload={prefersReducedMotion ? "none" : "metadata"}
          aria-hidden="true"
          tabIndex={-1}
        ></video>
        <TextFade direction="up">
              <h3 className="mb-3"> Sardinhas Nômades</h3>
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
