import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import {Parallax, Navigation, Pagination, Autoplay } from 'swiper/modules';
import SectionTitle from './sectionTitle';

import 'swiper/swiper-bundle.css';

const SocialCarousel: React.FC = () => {
  const posts = [
    '/gallery/photo1.jpg',
    '/gallery/photo2.jpg',
    '/gallery/photo3.jpg',
    '/gallery/photo4.jpg',
    '/gallery/photo5.jpg',
    '/gallery/photo6.jpg',
    '/gallery/photo2.jpg',
    '/gallery/photo3.jpg',
    '/gallery/photo4.jpg',
    '/gallery/photo5.jpg',
    '/gallery/photo6.jpg',
  ];

  return (
    <section className="h-screen mb-5 justify-center items-center  " id="socials">
      <SectionTitle titleText="Socials" />
      <div className="flex justify-center  overflow-visible">  
      <Swiper
      
        modules={[Parallax,Navigation, Pagination, Autoplay]}
        parallax={true}
        centeredSlides={true}
        spaceBetween={0}
        //slidesPerView={1}
        navigation={false}
        autoplay={{ delay: 0, disableOnInteraction: false }}
        loop={true}
        speed={3000}
        pagination={{
          clickable: true,
        }}
          breakpoints={{768: {slidesPerView: 2,spaceBetween: 0 ,autoplay:{ delay: 0} },1024: {slidesPerView: 2,spaceBetween: 0 ,autoplay:{ delay: 0}}}}
      
        className=" h-[90vh] w-full justify-center items-center overflow-visible"


      >
        {posts.map((post, index) => (
          <SwiperSlide  key={`${post}-${index}`}
           style={{ backgroundImage: `url(${post})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          >
            
      
          </SwiperSlide>
        ))}
      </Swiper>
      </div>

      
    </section>
  );
};

export default SocialCarousel;
