import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, EffectFlip, Keyboard } from 'swiper/modules';
import { useReducedMotion } from 'framer-motion';


import 'swiper/swiper-bundle.css';

const BandCarousel: React.FC = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const posts = [
    '/band/band1.png',
    '/band/band2.png',
    '/band/band3.png',


  ];

  return (
  

      <div role="region" aria-label="Fotos da banda" className="flex justify-center overflow-hidden -mt-10">
      <Swiper
        modules={[Autoplay, EffectFade, EffectFlip, Keyboard]}
        spaceBetween={0}
        direction={'vertical'}
        autoplay={prefersReducedMotion ? false : { delay: 1000, disableOnInteraction: false }}
        keyboard={{ enabled: true, onlyInViewport: true }}
        loop={true}
        speed={prefersReducedMotion ? 0 : 600}
        effect='fade'
        fadeEffect={{ crossFade: true }}
        className="h-[40vh] w-full justify-center items-center lg:h-[75vh]"
      >
        {posts.map((post, index) => (
          <SwiperSlide
            className='swiper-slide'
            key={`${post}-${index}`}
            role="img"
            aria-label={`Foto da banda Sardinhas Nômades ${index + 1}`}
            style={{ backgroundImage: `url(${post})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', height: '100%' }}
          >
          </SwiperSlide>
        ))}
      </Swiper>
      </div>

  
  );
};

export default BandCarousel;
