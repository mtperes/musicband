import React from 'react';

import imgSrc from '../assets/sardinhas-head-logo.svg';
import imgSrc2 from '../assets/sardinhas-logo-tail.svg';
import { LettersPullUp } from '../effects/letters-pull-up';

const SectionTitle: React.FC<{ titleText: string; id?: string }> = ({ titleText, id }) => {
  return (
    <>
      <h2 id={id} className="flex justify-center text-(--primary-color)">
        {' '}
        <img
          className="mt-3 h-7 w-7 opacity-25 sm:h-10 sm:w-10 lg:h-12 lg:w-12"
          src={imgSrc}
          alt=""
          aria-hidden="true"
        />{' '}
           <LettersPullUp text={titleText} />{' '}
        <img className="mt-3 h-7 w-7 opacity-25 sm:h-10 sm:w-10 lg:h-12 lg:w-12" src={imgSrc2} alt="" aria-hidden="true" />{' '}
      </h2>
    </>
  );
};

export default SectionTitle;