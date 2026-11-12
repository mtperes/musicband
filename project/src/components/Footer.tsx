import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full py-8 mt-10 bg-black/20 backdrop-blur-sm text-white text-center font-(family-name:--font1family)">
      <div className="container mx-auto px-4">
        <p className="text-lg mb-2">© {currentYear} Sardinhas Nômades</p>
        <p className="text-sm opacity-75">
          Lisboa, Portugal • A essência do carnaval brasileiro.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
