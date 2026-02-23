import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { getPresignedUrl, uploadMedia, confirmUpload } from '@/api/media';
import { MediaPreview } from './MediaPreview';
import { Button } from '@/components/common/Buttons/Button';
import toast from 'react-hot-toast';
import styles from './MediaUpload.module.css';

interface MediaUploadProps {
  onUploadComplete: (mediaIds: string[]) => void;
  maxFiles?: number;
  maxSize?: number; // in MB
}

export const MediaUpload: React.FC<MediaUploadProps> = ({
  onUploadComplete,
  maxFiles = 10,
  maxSize = 10,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles = [...files, ...acceptedFiles].slice(0, maxFiles);
    setFiles(newFiles);
  }, [files, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.avi', '.webm'],
    },
    maxSize: maxSize * 1024 * 1024,
    maxFiles,
  });

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const mediaIds: string[] = [];

    try {
      for (const file of files) {
        // 1. Ottieni presigned URL
        const { data } = await getPresignedUrl({
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        });

        // 2. Upload a S3/MinIO con progress tracking
        await uploadMedia(data.uploadUrl, file, (progress) => {
          setUploadProgress(prev => ({
            ...prev,
            [data.mediaId]: progress,
          }));
        });

        // 3. Conferma upload completato
        await confirmUpload(data.mediaId);

        mediaIds.push(data.mediaId);
      }

      onUploadComplete(mediaIds);
      toast.success('File caricati con successo!');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Errore durante il caricamento');
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  return (
    <div className={styles.mediaUpload}>
      <div
        {...getRootProps()}
        className={`${styles.dropzone} ${isDragActive ? styles.active : ''}`}
      >
        <input {...getInputProps()} />
        <div className={styles.dropzoneContent}>
          <svg className={styles.uploadIcon} viewBox="0 0 24 24">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
          <p className={styles.dropzoneText}>
            {isDragActive
              ? 'Rilascia i file qui'
              : 'Trascina foto e video qui o clicca per selezionare'}
          </p>
          <p className={styles.dropzoneHint}>
            Massimo {maxFiles} file, fino a {maxSize} MB ciascuno
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className={styles.previewGrid}>
          {files.map((file, index) => (
            <MediaPreview
              key={`${file.name}-${index}`}
              file={file}
              onRemove={() => removeFile(index)}
              progress={uploadProgress[file.name]}
            />
          ))}
        </div>
      )}

      {files.length > 0 && !uploading && (
        <Button
          className={styles.uploadButton}
          onClick={uploadFiles}
          fullWidth
        >
          Carica {files.length} {files.length === 1 ? 'file' : 'file'}
        </Button>
      )}

      {uploading && (
        <div className={styles.uploadingStatus}>
          Caricamento in corso...
        </div>
      )}
    </div>
  );
};