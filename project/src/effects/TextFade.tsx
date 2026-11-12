'use client';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import * as React from 'react';
 
export function TextFade({
  direction,
  children,
  className = '',
  staggerChildren = 0.5,
}: {
  direction: 'up' | 'down';
  children: React.ReactNode;
  className?: string;
  staggerChildren?: number;
}) {
  const FADE_DOWN = {
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const } },
    hidden: { opacity: 0, y: direction === 'down' ? -18 : 18 },
  };
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true });
  const prefersReducedMotion = useReducedMotion() ?? false;
  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate={prefersReducedMotion || isInView ? 'show' : ''}
      
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: prefersReducedMotion ? 0 : staggerChildren,
          },
        },
      }}
      className={className}
    >
      {React.Children.map(children, (child) =>
        React.isValidElement(child) ? (
          <motion.div variants={FADE_DOWN}>{child}</motion.div>
        ) : (
          child
        )
      )}
    </motion.div>
  );
}