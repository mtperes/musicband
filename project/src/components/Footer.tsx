import React from 'react';
import { useSiteContent } from '../hooks/useSiteContent';

const Footer: React.FC = () => {
  const { name, footerText } = useSiteContent();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-8 mt-10 bg-black/20 backdrop-blur-sm text-white text-center font-(family-name:--font1family)">
      <div className="container mx-auto px-4">
        <p className="text-lg mb-2">© {currentYear} {name}</p>
        <p className="text-sm opacity-75">
          {footerText}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
