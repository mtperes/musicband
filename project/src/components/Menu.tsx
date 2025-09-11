
import React from "react";

function scrollTo(target: string) {
  const element = document.getElementById(target);           
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}



const Menu: React.FC = () => {
  return (
    <>
      <ul style={styles.menu}>
        <li style={styles.li}>
          <button onClick={() => scrollTo("bio")}> Quem Somos Nós</button>
        </li>
        <li style={styles.li}>
          <button onClick={() => scrollTo("calendar")}>Calendario</button>
        </li>
        <li style={styles.li}>
          <button onClick={() => scrollTo("socials")}>Redes Sociais</button>
        </li>
         <li style={styles.li}>
          <button onClick={() => scrollTo("events")}>Events</button>
        </li>
        <li style={styles.li}>
          <button onClick={() => scrollTo("gallery")}>Galeria de fotos</button>
        </li>
        <li style={styles.li}>
          <button onClick={() => scrollTo("video")}>Videos</button>
        </li>
        <li style={styles.li}>
         <button onClick={() => scrollTo("contact")}>Entre em Contato</button>
        </li>
      </ul>
     

    </>
  );
};

const styles = {
  menu: {
    position: "fixed" as const,
    backgroundColor: "transparent",
    padding: ".5rem",
    textAlign: "left" as const,
    display: "grid",
    top: "30vh",
    marginBottom: "-15rem",
    textDecoration: "none",
    listStyle: "none",
    zIndex: 20,
  },
  li: {
    margin: ".5rem",
    fontSize: "24px",
  },


};

export default Menu;
