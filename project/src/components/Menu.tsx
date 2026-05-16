
import React,{useEffect} from "react";
import {
  useMotionTemplate,
  useMotionValue,
  motion,
  animate,
} from "framer-motion";

function scrollTo(target: string) {
  const element = document.getElementById(target);           
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}



const COLORS_TOP = ["#13FFAA", "#e45300", "#DD335C"];
const Menu: React.FC = () => {
   const color = useMotionValue(COLORS_TOP[0]);

  useEffect(() => {
    animate(color, COLORS_TOP, {
      ease: "easeInOut",
      duration: 20,
      repeat: Infinity,
      repeatType: "mirror",
    });
  }, []);

  const backgroundImage = useMotionTemplate`radial-gradient( ellipse farthest-corner at 10px 50%,  ${color} 20%, #ffffff05 60%)`;
  // const border = useMotionTemplate`none`;
  // const boxShadow = useMotionTemplate`0px 4px 24px ${color}`;
 

  return (
    <>
      <motion.ul className="menu" style={{
              
                    backgroundImage,
                    ...styles.menu
                  }}>
       
        <motion.li 
                  whileHover={{
                    scale: 1.19,
                    x: 20,
                    opacity: 1,
                  }}
                
                   transition={{type:"spring", stiffness:300}}
                  whileTap={{
                    scale: 1.285,
                    x: 10,
                
                  }} >


                <button style={styles.button}  className="text-(--primary-color)" onClick={() => scrollTo("bio")}>O Cardume</button>

        </motion.li>
         <motion.li 
                   whileHover={{
                    scale: 1.19,
                    x: 20,
                    opacity: 1,
                  }}
                
                   transition={{type:"spring", stiffness:300}}
                  whileTap={{
                    scale: 1.285,
                    x: 10,
                
                  }} >
          <button style={styles.button}  className="text-(--primary-color)" onClick={() => scrollTo("calendar")}>Calendário</button>
         </motion.li>
       
       <motion.li 
                whileHover={{
                    scale: 1.19,
                    x: 20,
                    opacity: 1,
                  }}
                
                   transition={{type:"spring", stiffness:300}}
                  whileTap={{
                    scale: 1.285,
                    x: 10,
                
                  }} >
          <button style={styles.button}  className="text-(--primary-color)" onClick={() => scrollTo("socials")}>Socials</button>
         </motion.li>
           <motion.li 
                  whileHover={{
                    scale: 1.19,
                    x: 20,
                    opacity: 1,
                  }}
                
                   transition={{type:"spring", stiffness:300}}
                  whileTap={{
                    scale: 1.285,
                    x: 10,
                
                  }} >
          <button style={styles.button} className="text-(--primary-color)" onClick={() => scrollTo("events")}>Eventos</button>
         </motion.li>
      
         <motion.li
                   whileHover={{
                    scale: 1.19,
                    x: 20,
                    opacity: 1,
                  }}
                
                   transition={{type:"spring", stiffness:300}}
                  whileTap={{
                    scale: 1.285,
                    x: 10,
                
                  }} >
         <button style={styles.button} className="text-(--primary-color)" onClick={() => scrollTo("contact")}>Contato</button>
         </motion.li>
      </motion.ul>
     

    </>
  );
};

const styles = {
  menu: {
    position: "fixed" as const,
    backgroundPosition: "top left",
    padding: "1rem",
    textAlign: "left" as const,
    left: "0rem",  
    marginBottom: "-15rem",
    textDecoration: "none",
    listStyle: "none",
    zIndex: 10,
    overflow: "visible",
  },
  button: {
    backgroundColor: "transparent",
    border: "none",
    fontFamily: "Cubano, sans-serif",
    

  },


};

export default Menu;
