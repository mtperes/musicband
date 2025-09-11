

import React from "react";
import logo from "../assets/sardinhas-logo.svg";

const Header: React.FC = () => {
  return (
    <header style={styles.header}>
     <img style={styles.logoImg} src={logo} alt="" />
    </header>
  );
};

const styles = {
  header: {
    position:"sticky" as const,
    backgroundColor: "transparent",
    padding: "2rem",
    textAlign: "center" as const,
    display: "flex",
    marginBottom: "-29rem",
  
    
  },
    logoImg: {

    width: "25rem",
    height: "25rem",
    
},

  title: {
    color: "white",
    fontSize: "24px",
    margin: 0,
  },
};

export default Header;
