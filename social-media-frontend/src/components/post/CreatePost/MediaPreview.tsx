import { useEffect, useState } from 'react';
import { IconButton } from '@/components/common/Buttons/IconButton';
import styles from './MediaPreview.module.css';

interface MediaPreviewProps {
  file: File;
  onRemove: () => void;
  progress?: number;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({
  file,
  onRemove,
  progress,
}) => {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isVideo = file.type.startsWith('video/');

  return (
    <div className={styles.preview}>
      {isVideo ? (
        <video src={preview || undefined} className={styles.media} />
      ) : (
        <img src={preview || undefined} alt={file.name} className={styles.media} />
      )}

      <IconButton
        className={styles.removeButton}
        onClick={onRemove}
        label="Rimuovi"
        size="small"
      >
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </IconButton>

      {progress !== undefined && progress < 100 && (
        <div className={styles.progressOverlay}>
          <div
            className={styles.progressBar}
            style={{ width: `${progress}%` }}
          />
          <span className={styles.progressText}>{Math.round(progress)}%</span>
        </div>
      )}

      <div className={styles.fileInfo}>
        <span className={styles.fileName}>{file.name}</span>
        <span className={styles.fileSize}>
          {(file.size / 1024 / 1024).toFixed(2)} MB
        </span>
      </div>
    </div>
  );
};