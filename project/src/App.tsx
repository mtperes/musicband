
import { useRef } from 'react';
import Banner from './components/Banner'
import Menu from './components/Menu'
import './App.css'
import Calendar from './components/Calendar'
import Events from './components/Events'
import Bio from './components/Bio'
import Contact from './components/Contact'
import SocialCarousel from './components/SocialCarousel'
// import videoSrc from './assets/w-bg.mp4';
import Logo from './components/Logo'
import VideoBackground from './components/VideoBrackground';

function App() {

  return (
    <>
     {/* <video id="bgVideo" ref={vidRef} style={styles.bgVideo} src={videoSrc}   autoPlay muted loop ></video>  */}
      <VideoBackground/>
       
         <Logo/> 
         <Banner/>
         <Menu/>
         <Bio/>
         <Calendar />
         <SocialCarousel/>
         <Events/>
         <Contact/> 
        
  
       
   
  
    </>
  )
}

const styles = {
    bgVideo: {
        position: 'fixed' as const,
        top: '0',
        left: '0',
        width: '100%',
        height: 'auto',
        objectFit: 'cover' as const,
        opacity: 1,
        zIndex: -1,
        filter: 'blur(45px)',
        playbackRate: 0.1,
    },
};

export default App
