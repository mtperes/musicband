import React from 'react';




const Banner: React.FC = () => {
    return (
        <section style={styles.banner}>

        
            
            

            <h1 style={styles.title}>A fanfarra mais divertida de Lisboa</h1>
            <h3 style={styles.subtitle}>Desde 2019 Fazendo Carnaval em Lisboa!</h3>
        </section>
    );
};

const styles = {
    banner: {
      
        textAlign: 'left' as const,
        padding: '10%',
        border: '3px solid teal',
    },
    title: {

        color: 'teal',
        fontSize: '74px',
        marginTop: "20%",
    },
     subtitle: {
        color: 'midnightblue',
        fontSize: '34px',
        margin: 0,
    },
    logo:{
        position: 'absolute' as const,
        top: '0',
        left: '0',    
        width: '30rem',
        height: '30rem',
        objectFit: 'cover' as const,
        opacity: 1,
        zIndex: -1,
        
        
    },
     video: {
        position: 'absolute' as const,
        top: '0',
        left: '0',
        width: '100%',
        height: 'auto',
        objectFit: 'cover' as const,
        opacity: 0,
        zIndex: -1,
        filter: 'blur(2px)',
    },
};

export default Banner;