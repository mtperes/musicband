import React from 'react';

import imgSrc from '../assets/sardinhas-head-logo.svg';
import imgSrc2 from '../assets/sardinhas-logo-tail.svg';
import { LettersPullUp } from '../effects/letters-pull-up';

const SectionTitle: React.FC<{ titleText: string }> = ({ titleText }) => {
  return (
    <>
      <h1 className="flex justify-center text-(--primary-color)">
        {' '}
        <img
          className="h-10 w-10 lg:h-12 lg:w-12 mt-3 opacity-25 "
          src={imgSrc}
          alt="head"
        />{' '}
           <LettersPullUp text={titleText} />{' '}
        <img className="h-10 w-10 lg:h-12 lg:w-12 mt-3 opacity-25" src={imgSrc2} alt="tail" />{' '}
      </h1>
    </>
  );
};

export default SectionTitle;