import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Keyboard, Parallax, Navigation, Pagination, Autoplay } from 'swiper/modules';
import { useReducedMotion } from 'framer-motion';
import SectionTitle from './sectionTitle';
import { useSiteContent } from '../hooks/useSiteContent';

import 'swiper/swiper-bundle.css';

const SocialCarousel: React.FC = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const { sections, instagramUrl, instagramLabel } = useSiteContent();
  const section = sections.socials;
  const posts = section.media.length > 1 && section.media.length < 8 ? [...section.media, ...section.media, ...section.media] : section.media;

  return (
    <section className="h-screen mb-5 justify-center items-center overflow-x-clip" id="socials" aria-labelledby="socials-heading">
      <SectionTitle titleText={section.title} id="socials-heading" />
      {section.text && <p className="mx-auto max-w-4xl px-4 whitespace-pre-line">{section.text}</p>}
      {posts.length > 0 && <>
      <div role="region" aria-label="Fotos da banda" className="flex justify-center overflow-x-clip">
      <Swiper
        modules={[Keyboard, Parallax, Navigation, Pagination, Autoplay]}
        parallax={true}
        centeredSlides={true}
        slidesPerView={1}
        spaceBetween={0}
        keyboard={{ enabled: true, onlyInViewport: true }}
        navigation={false}
        autoplay={prefersReducedMotion ? false : { delay: 0, disableOnInteraction: false }}
        loop={posts.length > 1}
        speed={prefersReducedMotion ? 0 : 3000}
        pagination={{
          clickable: true,
        }}
        breakpoints={{ 768: { slidesPerView: 2, spaceBetween: 0 }, 1024: { slidesPerView: 4, spaceBetween: 0 } }}
        className="h-[90vh] w-full justify-center items-center overflow-visible"
      >
        {posts.map((post, index) => (
          <SwiperSlide
            key={`${post.url}-${index}`}
            role="img"
            aria-label={post.alt}
            style={{ backgroundImage: `url("${post.url}")`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat' }}
          >
          </SwiperSlide>
        ))}
      </Swiper>
      </div>
      </>}
      
      <div className="flex flex-row justify-around items-center mt-[-15vh] position-static relative z-10 w-full">
   
        {instagramUrl && <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="gallery-link mt-2 max-w-full px-6 py-2 text-white border border-white/20 rounded-4xl bg-white/10 backdrop-blur-md text-xl sm:text-3xl wrap-break-word">{instagramLabel}</a>}
      </div>
    </section>
  );
};

export default SocialCarousel;
