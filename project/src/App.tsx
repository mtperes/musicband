
import Header from './components/Header'
import Banner from './components/Banner'
import Menu from './components/Menu'
import './App.css'
import Calendar from './components/Calendar'
import Events from './components/Events'
import Bio from './components/Bio'
import Video from './components/Video'
import Contact from './components/Contact'
import Gallery from './components/Gallery'
import Socials from './components/Socials'
import videoSrc from './assets/w-bg.mp4';


function App() {
 

  return (
    <>
     
      <video style={styles.video} src={videoSrc}   autoPlay muted loop></video>
        <Header/>
        <Banner/>
        <Menu/>
        <Bio/>
        <Calendar/>
        
        <Socials/>
        <Events/>
        
        <Gallery/>
        <Video/>
        <Contact/>  
 
       
    
    </>
  )
}

const styles = {
    video: {
        position: 'fixed' as const,
        top: '0',
        left: '0',
        width: '100%',
        height: 'auto',
        objectFit: 'cover' as const,
        opacity: 0.3,
        zIndex: -1,
        filter: 'blur(2px)',
    },
};

export default App
