import React from 'react';

const SocialPost: React.FC<{ url: string }> = ({ url }) => {
  return (
    <blockquote
      className="instagram-media rounded-lg overflow-hidden"
      data-instgrm-permalink={url}
      data-instgrm-version="14"
      style={{
        flex: "0 0 auto",
        width: "min(30rem, 90vw)",
        minWidth: "28rem",
        minHeight: "35vh",
        paddingLeft: "1.5rem",
        paddingRight: "1.5rem",
      }}
    ></blockquote>
  );
};

export default SocialPost;