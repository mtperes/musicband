'use client';
// import { cn } from '@/lib/utils';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import * as React from 'react';
 
export function LettersPullUp({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  const splittedText = text.split('');
  const prefersReducedMotion = useReducedMotion() ?? false;
 
  const pullupVariant = {
    initial: { y: 10, opacity: 0 },
    animate: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: {
        ...(prefersReducedMotion ? { duration: 0 } : { delay: i * 0.1 }),
      },
    }),
  };
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  return (
    <span ref={ref} className={`flex justify-center ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="flex justify-center">
      {splittedText.map((current, i) => (
        <motion.span
          key={i}
          variants={pullupVariant}
          initial={prefersReducedMotion ? false : 'initial'}
          animate={prefersReducedMotion || isInView ? 'animate' : ''}
          custom={i}
          className="text-center font-bold"
           
         
        >
          {current == ' ' ? <span>&nbsp;</span> : current}
        </motion.span>
      ))}
      </span>
    </span>
  );
}