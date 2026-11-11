import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Keyboard, Parallax, Navigation, Pagination, Autoplay } from 'swiper/modules';
import { useReducedMotion } from 'framer-motion';
import SectionTitle from './sectionTitle';

import 'swiper/swiper-bundle.css';

const SocialCarousel: React.FC = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const posts = [
    '/gallery/photo1.jpg',
    '/gallery/photo2.jpg',
    '/gallery/photo3.jpg',
    '/gallery/photo4.jpg',
    '/gallery/photo5.jpg',
    '/gallery/photo6.jpg',
    '/gallery/photo1.jpg',
    '/gallery/photo2.jpg',
    '/gallery/photo3.jpg',
    '/gallery/photo4.jpg',
    '/gallery/photo5.jpg',
    '/gallery/photo6.jpg',
  ];

  return (
    <section className="h-screen mb-5 justify-center items-center overflow-x-clip" id="socials" aria-labelledby="socials-heading">
      <SectionTitle titleText="Fotos" id="socials-heading" />
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
        loop={true}
        speed={prefersReducedMotion ? 0 : 3000}
        pagination={{
          clickable: true,
        }}
        breakpoints={{ 768: { slidesPerView: 2, spaceBetween: 0 }, 1024: { slidesPerView: 4, spaceBetween: 0 } }}
        className="h-[90vh] w-full justify-center items-center overflow-visible"
      >
        {posts.map((post, index) => (
          <SwiperSlide
            key={`${post}-${index}`}
            role="img"
            aria-label={`Foto da galeria da banda ${index + 1}`}
            style={{ backgroundImage: `url(${post})`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat' }}
          >
          </SwiperSlide>
        ))}
      </Swiper>
      </div>
      
      <div className="flex flex-row justify-around items-center mt-[-15vh] position-static relative z-10 w-full">
   
        <a href="https://www.instagram.com/sardinhas.nomades/" target="_blank" rel="noopener noreferrer">
          <button className="mt-2 px-6 py-2 text-white border border-white/20 rounded-4xl bg-gradient-to-br from-white/25 via-white/10 to-white/5 backdrop-blur-md shadow-lg shadow-black/20 hover:from-white/35 hover:to-white/10 transition-colors text-[35px]">Instagram @sardinhas.nomades</button>
        </a>
      </div>
    </section>
  );
};

export default SocialCarousel;
