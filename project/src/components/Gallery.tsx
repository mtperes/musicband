import React from 'react';
import imgSrc1 from '../assets/gallery/photo1.jpg';
import imgSrc2 from '../assets/gallery/photo2.jpg';
import imgSrc3 from '../assets/gallery/photo3.jpg';
import imgSrc4 from '../assets/gallery/photo4.jpg';
import imgSrc5 from '../assets/gallery/photo5.jpg';
import imgSrc6 from '../assets/gallery/photo6.jpg';
import imgSrc7 from '../assets/gallery/photo7.jpg';
import imgSrc8 from '../assets/gallery/photo8.jpg';
import imgSrc9 from '../assets/gallery/photo9.jpg';

const imgSources = [imgSrc1, imgSrc2, imgSrc3, imgSrc4, imgSrc5, imgSrc6, imgSrc7, imgSrc8, imgSrc9];
import { useEffect } from 'react';

const Gallery: React.FC = () => {
    useEffect(() => {
        imgSources.forEach((src, index) => {
            const img = document.createElement('img');
            img.src = src;
            img.alt = `Photo ${index + 1}`;
            img.style.margin = '10px';
            document.getElementById('gallery')?.appendChild(img);
        });
    }, []);

    return (
        <section id='gallery' style={styles.header}>
             

            <h1 style={styles.title}>My App Gallery text! hello world !</h1>
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

export default Gallery;