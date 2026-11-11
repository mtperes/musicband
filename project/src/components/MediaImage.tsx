import { useState, type ComponentProps } from 'react';

type MediaImageProps = Omit<ComponentProps<'img'>, 'onError'>;

const MediaImage = ({ alt, className = '', ...imageProps }: MediaImageProps) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        role="img"
        aria-label={`${alt}: imagem indisponível`}
        className={`flex items-center justify-center bg-black/20 text-(--primary-color) ${className}`}
      >
        <span className="rounded bg-black/60 px-3 py-2 text-sm">Imagem indisponível</span>
      </div>
    );
  }

  return <img {...imageProps} alt={alt} className={className} onError={() => setHasError(true)} />;
};

export default MediaImage;