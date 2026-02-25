import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/common/Modals/Modal';
import { Button } from '@/components/common/Buttons/Button';
import { TextArea } from '@/components/common/Inputs/TextArea';
import { Select } from '@/components/common/Inputs/Select';
import { getPresignedUrl, uploadMedia, confirmUpload } from '@/api/media';
import { usePost } from '@/hooks/usePost';
import toast from 'react-hot-toast';
import styles from './CreatePostModal.module.css';

/* ── schema ── */
const postSchema = z.object({
  content: z
    .string()
    .min(1, 'Scrivi qualcosa prima di pubblicare')
    .max(2000, 'Massimo 2000 caratteri'),
  visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as const),
});
type PostFormData = z.infer<typeof postSchema>;

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface FilePreview {
  file: File;
  previewUrl: string;
  progress: number; // 0-100, -1 = error
  mediaId?: string;
  uploaded: boolean;
}

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC',    label: '🌍 Pubblico' },
  { value: 'FOLLOWERS', label: '👥 Solo follower' },
  { value: 'PRIVATE',   label: '🔒 Privato' },
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { create } = usePost();

  /* ── form ── */
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: { visibility: 'PUBLIC' },
  });
  const content = watch('content', '');

  /* ── hashtag chips ── */
  const [hashtags, setHashtags]       = useState<string[]>([]);
  const [hashInput, setHashInput]     = useState('');
  const inlineHashes = (content?.match(/#(\w+)/g) ?? []).map(t => t.slice(1).toLowerCase());

  const commitHash = (raw: string) => {
    const tag = raw.replace(/^#+/, '').trim().toLowerCase();
    if (!tag || hashtags.includes(tag) || inlineHashes.includes(tag)) return;
    setHashtags(prev => [...prev, tag]);
  };

  const onHashKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ' ', ','].includes(e.key)) {
      e.preventDefault();
      commitHash(hashInput);
      setHashInput('');
    } else if (e.key === 'Backspace' && hashInput === '' && hashtags.length > 0) {
      setHashtags(prev => prev.slice(0, -1));
    }
  };

  /* ── media files ── */
  const [files, setFiles]           = useState<FilePreview[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    setUploadError(null);
    const newEntries: FilePreview[] = accepted.map(f => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      progress: 0,
      uploaded: false,
    }));
    setFiles(prev => [...prev, ...newEntries].slice(0, 10));
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.mov', '.webm'],
    },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 10,
  });

  const removeFile = (idx: number) => {
    setFiles(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── upload all pending files and return mediaIds ── */
  const uploadPendingFiles = async (): Promise<string[]> => {
    const pending = files.filter(f => !f.uploaded);
    const ids: string[] = files.filter(f => f.uploaded && f.mediaId).map(f => f.mediaId!);

    for (const entry of pending) {
      const idx = files.indexOf(entry);
      try {
        const { data } = await getPresignedUrl({
          filename: entry.file.name,
          contentType: entry.file.type,
          sizeBytes: entry.file.size,
        });

        await uploadMedia(data.uploadUrl, entry.file, (progress) => {
          setFiles(prev =>
            prev.map((f, i) => i === idx ? { ...f, progress } : f)
          );
        });

        await confirmUpload(data.mediaId);

        setFiles(prev =>
          prev.map((f, i) => i === idx ? { ...f, progress: 100, uploaded: true, mediaId: data.mediaId } : f)
        );
        ids.push(data.mediaId);
      } catch {
        setFiles(prev =>
          prev.map((f, i) => i === idx ? { ...f, progress: -1 } : f)
        );
        throw new Error('upload_failed');
      }
    }
    return ids;
  };

  /* ── submit ── */
  const onSubmit = async (data: PostFormData) => {
    let mediaIds: string[] = [];

    // Tenta upload media se ci sono file — ma non blocca la pubblicazione
    if (files.length > 0) {
      try {
        mediaIds = await uploadPendingFiles();
      } catch {
        setUploadError(
          'Impossibile caricare i file multimediali (servizio non disponibile). ' +
          'Puoi pubblicare solo testo oppure riprovare più tardi.'
        );
        return; // blocca: l'utente sceglie se rimuovere le immagini o annullare
      }
    }

    try {
      const extraTags = hashtags
        .filter(t => !inlineHashes.includes(t))
        .map(t => `#${t}`)
        .join(' ');

      const finalContent = extraTags
        ? `${data.content}\n\n${extraTags}`
        : data.content;

      await create({
        ...data,
        content: finalContent,
        media_ids: mediaIds,
      });

      toast.success('Post pubblicato!');
      handleClose();
      onSuccess?.();
    } catch {
      toast.error('Errore durante la pubblicazione');
    }
  };

  /* ── reset & close ── */
  const handleClose = () => {
    reset();
    setHashtags([]);
    setHashInput('');
    files.forEach(f => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    setUploadError(null);
    onClose();
  };

  /* ── char count color ── */
  const charCount = content?.length ?? 0;
  const charColor = charCount > 1800 ? 'var(--error, #e53e3e)' : charCount > 1500 ? 'var(--warning, #d69e2e)' : 'var(--text-secondary)';

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Crea post" size="large">
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>

        {/* ── TESTO ── */}
        <div className={styles.textSection}>
          <TextArea
            placeholder="Cosa vuoi condividere?"
            error={errors.content?.message}
            {...register('content')}
            className={styles.textarea}
          />
          <span className={styles.charCount} style={{ color: charColor }}>
            {charCount}/2000
          </span>
        </div>

        {/* ── HASHTAG ── */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>
            <svg viewBox="0 0 24 24" className={styles.labelIcon}>
              <path d="M11 7H9V9H7V11H9V13H7V15H9V17H11V15H13V17H15V15H17V13H15V11H17V9H15V7H13V9H11V7ZM13 13H11V11H13V13Z"/>
            </svg>
            Hashtag
          </p>
          <div className={styles.chipBox}>
            {[...new Set([...inlineHashes, ...hashtags])].map(tag => (
              <span
                key={tag}
                className={`${styles.chip} ${inlineHashes.includes(tag) ? styles.chipAuto : ''}`}
              >
                #{tag}
                {!inlineHashes.includes(tag) && (
                  <button type="button" className={styles.chipX} onClick={() => setHashtags(p => p.filter(t => t !== tag))}>×</button>
                )}
              </span>
            ))}
            <input
              className={styles.chipInput}
              placeholder={hashtags.length + inlineHashes.length === 0 ? 'Aggiungi tag… (Invio o Spazio)' : '+tag'}
              value={hashInput}
              onChange={e => setHashInput(e.target.value.replace(/\s/g, ''))}
              onKeyDown={onHashKeyDown}
              onBlur={() => { if (hashInput) { commitHash(hashInput); setHashInput(''); } }}
            />
          </div>
          {inlineHashes.length > 0 && (
            <p className={styles.hintText}>I tag grigi sono rilevati automaticamente dal testo</p>
          )}
        </div>

        {/* ── MEDIA ── */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>
            <svg viewBox="0 0 24 24" className={styles.labelIcon}>
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
            Foto / Video
            <span className={styles.optional}>(opzionale)</span>
          </p>

          {uploadError && (
            <div className={styles.uploadError}>
              <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              <span>{uploadError}</span>
              <button type="button" className={styles.uploadErrorDismiss} onClick={() => { setUploadError(null); setFiles([]); }}>
                Rimuovi media e pubblica solo testo
              </button>
            </div>
          )}

          <div
            {...getRootProps()}
            className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''} ${files.length > 0 ? styles.dropzoneCompact : ''}`}
          >
            <input {...getInputProps()} />
            {files.length === 0 ? (
              <div className={styles.dropzonePlaceholder}>
                <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                <span>{isDragActive ? 'Rilascia qui' : 'Trascina o clicca per aggiungere'}</span>
              </div>
            ) : (
              <span className={styles.dropzoneAdd}>+ Aggiungi altri</span>
            )}
          </div>

          {files.length > 0 && (
            <div className={styles.previewGrid}>
              {files.map((f, i) => (
                <div key={i} className={styles.previewItem}>
                  {f.file.type.startsWith('video/') ? (
                    <video src={f.previewUrl} className={styles.previewThumb} muted />
                  ) : (
                    <img src={f.previewUrl} alt="" className={styles.previewThumb} />
                  )}

                  {/* progress bar */}
                  {f.progress > 0 && f.progress < 100 && (
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${f.progress}%` }} />
                    </div>
                  )}

                  {/* error overlay */}
                  {f.progress === -1 && (
                    <div className={styles.previewError}>
                      <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    </div>
                  )}

                  {/* done overlay */}
                  {f.uploaded && (
                    <div className={styles.previewDone}>
                      <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                    </div>
                  )}

                  <button
                    type="button"
                    className={styles.previewRemove}
                    onClick={() => removeFile(i)}
                    aria-label="Rimuovi"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── VISIBILITÀ ── */}
        <Select
          label="Visibilità"
          options={VISIBILITY_OPTIONS}
          {...register('visibility')}
        />

        {/* ── AZIONI ── */}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={handleClose}>
            Annulla
          </button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={charCount === 0}
          >
            {files.length > 0 && !files.every(f => f.uploaded)
              ? `Carica e pubblica (${files.length} file)`
              : 'Pubblica'}
          </Button>
        </div>

      </form>
    </Modal>
  );
};
