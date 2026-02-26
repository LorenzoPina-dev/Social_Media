import { useState } from 'react';
import { MediaType } from '@/types/post.types';
import styles from './MediaGallery.module.css';

interface MediaGalleryProps {
  mediaUrls: string[];
  mediaTypes: string[];
  className?: string;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  mediaUrls,
  mediaTypes,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isMultiple = mediaUrls.length > 1;

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : mediaUrls.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < mediaUrls.length - 1 ? prev + 1 : 0));
  };

  if (mediaUrls.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.gallery} ${className}`}>
      <div className={styles.mainMedia} >
        {mediaTypes[currentIndex] === 'video' ? (
          <video
            src={mediaUrls[currentIndex]}
            controls
            className={styles.mediaItem}
          />
        ) : (
          <img
            src={mediaUrls[currentIndex]}
            alt={`Media ${currentIndex + 1}`}
            className={styles.media}
            loading="lazy"
          />
        )}

        {isMultiple && (
          <>
            <button
              className={`${styles.navButton} ${styles.prev}`}
              onClick={handlePrevious}
            >
              <svg viewBox="0 0 24 24">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>
            <button
              className={`${styles.navButton} ${styles.next}`}
              onClick={handleNext}
            >
              <svg viewBox="0 0 24 24">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {isMultiple && (
        <div className={styles.indicators}>
          {mediaUrls.map((_, index) => (
            <button
              key={index}
              className={`${styles.indicator} ${
                index === currentIndex ? styles.active : ''
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};