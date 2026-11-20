import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, EffectFlip, Keyboard } from 'swiper/modules';
import { useReducedMotion } from 'framer-motion';
import { useSiteContent } from '../hooks/useSiteContent';


import 'swiper/swiper-bundle.css';

const BandCarousel: React.FC = () => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const posts = useSiteContent().sections.bio.media;
  if (!posts.length) return null;

  return (
  

      <div role="region" aria-label="Fotos da banda" className="flex justify-center overflow-hidden -mt-10">
      <Swiper
        modules={[Autoplay, EffectFade, EffectFlip, Keyboard]}
        spaceBetween={0}
        direction={'vertical'}
        autoplay={prefersReducedMotion ? false : { delay: 1000, disableOnInteraction: false }}
        keyboard={{ enabled: true, onlyInViewport: true }}
        loop={posts.length > 1}
        speed={prefersReducedMotion ? 0 : 600}
        effect='fade'
        fadeEffect={{ crossFade: true }}
        className="h-[40vh] w-full justify-center items-center lg:h-[75vh]"
      >
        {posts.map((post, index) => (
          <SwiperSlide
            className='swiper-slide'
            key={`${post.url}-${index}`}
            role="img"
            aria-label={post.alt}
            style={{ backgroundImage: `url("${post.url}")`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', height: '100%' }}
          >
          </SwiperSlide>
        ))}
      </Swiper>
      </div>

  
  );
};

export default BandCarousel;
