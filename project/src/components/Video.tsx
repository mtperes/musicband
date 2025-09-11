import React from 'react';



const Video: React.FC = () => {
    return (
        <section id="video" style={styles.header}>

  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 919" preserveAspectRatio="xMidYMid" width="1920" height="919" ><g data-idx="1"><linearGradient y2="1" y1="0" x2="0" x1="0" id="lg-nq4q5u6dq7r-0" data-idx="2">
  <stop offset="0" stop-color="#081c54" data-idx="3"></stop>
  <stop offset="1" stop-color="#225ea8" data-idx="4"></stop>
</linearGradient><linearGradient y2="1" y1="0" x2="0" x1="0" id="lg-nq4q5u6dq7r-1" data-idx="5">
  <stop offset="0" stop-color="#225ea8" data-idx="6"></stop>
  <stop offset="1" stop-color="#1d91c0" data-idx="7"></stop>
</linearGradient><linearGradient y2="1" y1="0" x2="0" x1="0" id="lg-nq4q5u6dq7r-2" data-idx="8">
  <stop offset="0" stop-color="#1d91c0" data-idx="9"></stop>
  <stop offset="1" stop-color="#41b6c4" data-idx="10"></stop>
</linearGradient><linearGradient y2="1" y1="0" x2="0" x1="0" id="lg-nq4q5u6dq7r-3" data-idx="11">
  <stop offset="0" stop-color="#41b6c4" data-idx="12"></stop>
  <stop offset="1" stop-color="#7fcdbb" data-idx="13"></stop>
</linearGradient><linearGradient y2="1" y1="0" x2="0" x1="0" id="lg-nq4q5u6dq7r-4" data-idx="14">
  <stop offset="0" stop-color="#7fcdbb" data-idx="15"></stop>
  <stop offset="1" stop-color="#c7e9b4" data-idx="16"></stop>
</linearGradient><linearGradient y2="1" y1="0" x2="0" x1="0" id="lg-nq4q5u6dq7r-5" data-idx="17">
  <stop offset="0" stop-color="#c7e9b4" data-idx="18"></stop>
  <stop offset="1" stop-color="#f3f8cf" data-idx="19"></stop>
</linearGradient><linearGradient y2="1" y1="0" x2="0" x1="0" id="lg-nq4q5u6dq7r-6" data-idx="20">
  <stop offset="0" stop-color="#f3f8cf" data-idx="21"></stop>
  <stop offset="1" stop-color="#081c54" data-idx="22"></stop>
</linearGradient><path fill-opacity="0.88" fill="url(#lg-nq4q5u6dq7r-0)" d="M 0 0 L 0 939.136 Q 192 1014.53 384 976.259 T 768 778.99 T 1152 808.841 T 1536 759.998 T 1920 587.938 L 1920 0 Z" data-idx="23">
  
</path><path fill-opacity="0.88" fill="url(#lg-nq4q5u6dq7r-1)" d="M 0 0 L 0 735.15 Q 192 755.986 384 731.275 T 768 762.79 T 1152 699.756 T 1536 558.789 T 1920 606.603 L 1920 0 Z" data-idx="25">
  
</path><path fill-opacity="0.88" fill="url(#lg-nq4q5u6dq7r-2)" d="M 0 0 L 0 695.567 Q 192 647.798 384 616.461 T 768 533.714 T 1152 617.685 T 1536 459.997 T 1920 441.188 L 1920 0 Z" data-idx="27">
  
</path><path fill-opacity="0.88" fill="url(#lg-nq4q5u6dq7r-3)" d="M 0 0 L 0 535.266 Q 192 532.448 384 487.384 T 768 430.447 T 1152 493.915 T 1536 384.382 T 1920 332.813 L 1920 0 Z" data-idx="29">
  
</path><path fill-opacity="0.88" fill="url(#lg-nq4q5u6dq7r-4)" d="M 0 0 L 0 380.149 Q 192 367.246 384 335.789 T 768 291.729 T 1152 298.864 T 1536 294.161 T 1920 342.035 L 1920 0 Z" data-idx="31">
  
</path><path fill-opacity="0.88" fill="url(#lg-nq4q5u6dq7r-5)" d="M 0 0 L 0 115.771 Q 192 130.86 384 109.487 T 768 136.805 T 1152 196.375 T 1536 116.973 T 1920 148.256 L 1920 0 Z" data-idx="33">
  
</path><g data-idx="35"></g></g></svg>


            <h1 style={styles.title}>My App VIdeo text! hello world !</h1>
        </section>
    );
};

const styles = {
    header: {
        backgroundColor: 'transparent',
        textAlign: 'center' as const,
    },
    title: {
        color: 'tomato',
        fontSize: '24px',
        margin: 0,
    },
};

export default Video;