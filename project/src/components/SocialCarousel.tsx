import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import SocialPost from './SocialPost';
import SectionTitle from './sectionTitle';

import 'swiper/swiper-bundle.css';

const SocialCarousel: React.FC = () => {
  const posts = [
    { url: 'https://www.instagram.com/p/DGlDfyhsl6C/?utm_source=ig_embed/?img_index=6' },
    { url: 'https://www.instagram.com/p/DGksWilsu1w/?utm_source=ig_embed' },
    { url: 'https://www.instagram.com/p/DGlDfyhsl6C/?utm_source=ig_embed/?img_index=7' },
    { url: 'https://www.instagram.com/p/DO8k5j6DajR/?utm_source=ig_embed' },
    { url: 'https://www.instagram.com/p/DGksWilsu1w/?utm_source=ig_embed' },
     { url: 'https://www.instagram.com/p/DGlGyrCsrmD/?utm_source=ig_embed' },
     
  
  ];

  return (
    <section className="h-screen mb-5" id="socials">
      <SectionTitle titleText="Socials" />
      
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        spaceBetween={10}
        slidesPerView={3}
        navigation={false}
        pagination={{ clickable: true }}
        autoplay={{ delay: 1000, disableOnInteraction: false }}
        loop={true}
        speed={5000}
        className="h-full"
      >
        {posts.map((post, index) => (
          <SwiperSlide key={`${post.url}-${index}`}>
            <div className="h-full">
              <SocialPost url={post.url} />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      <script async src="//www.instagram.com/embed.js"></script>
    </section>
  );
};

export default SocialCarousel;
