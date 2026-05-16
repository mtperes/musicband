import React from 'react';

import imgSrc from '../assets/sardinhas-head-logo.svg';
import imgSrc2 from '../assets/sardinhas-logo-tail.svg';

const SectionTitle: React.FC<{ titleText: string }> = ({ titleText }) => {
  return (
    <>
      <h1 className="flex justify-center text-(--primary-color)">
        {' '}
        <img
          className="h-12 w-12 mt-3 "
          src={imgSrc}
          alt="head"
        />{' '}
            {titleText}{' '}
        <img className="h-12 w-12 mt-3" src={imgSrc2} alt="tail" />{' '}
      </h1>
    </>
  );
};

export default SectionTitle;