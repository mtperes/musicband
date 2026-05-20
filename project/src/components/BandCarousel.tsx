import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import {Autoplay, EffectFade, EffectFlip } from 'swiper/modules';


import 'swiper/swiper-bundle.css';

const BandCarousel: React.FC = () => {
  const posts = [
    '/band/band1.png',
    '/band/band2.png',
    '/band/band3.png',


  ];

  return (
  

      <div className="flex justify-center overflow-hidden -mt-10">  
      <Swiper
      
        modules={[ Autoplay,EffectFade, EffectFlip]}
        spaceBetween={0}
     
        direction={'vertical'}
        autoplay={{ delay: 1000, disableOnInteraction: false }}
        loop={true}
        speed={600}
        effect='fade'
        fadeEffect={{ crossFade: true }}
        className="h-[40vh] lg:h-[75vh] w-full justify-center items-center"
      >
        {posts.map((post, index) => (
          <SwiperSlide className='swiper-slide' key={`${post}-${index}`}
           style={{ backgroundImage: `url(${post})`, backgroundSize: 'contain', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', height: '100%'}}
          >
      
          </SwiperSlide>
        ))}
      </Swiper>
      </div>

  
  );
};

export default BandCarousel;
