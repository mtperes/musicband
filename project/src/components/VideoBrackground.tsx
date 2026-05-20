import React from 'react';
import { useRef } from 'react';
import videoSrc from '/public/w-bg.mp4';

const VideoBackground: React.FC = () => {
 const vidRef = useRef<HTMLVideoElement | null>(null);


    if (vidRef.current) {
      vidRef.current.playbackRate = 0.4;
    }

return (
    <>
     <video id="bgVideo" ref={vidRef} style={styles.bgVideo} src={videoSrc}   autoPlay muted loop ></video> 
    </>
  );
}
const styles = {
    bgVideo: {
        position: 'fixed' as const,
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        opacity: 1,
        zIndex: -1,
     
    },
};

export default VideoBackground;