import { useState, KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextArea } from '@/components/common/Inputs/TextArea';
import { Select } from '@/components/common/Inputs/Select';
import { Button } from '@/components/common/Buttons/Button';
import { usePost } from '@/hooks/usePost';
import { Visibility } from '@/types/post.types';
import styles from './PostForm.module.css';

const postSchema = z.object({
  content: z
    .string()
    .min(1, 'Il post non può essere vuoto')
    .max(2000, 'Il post non può superare 2000 caratteri'),
  visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as const),
  scheduled_at: z.string().optional(),
});

type PostFormData = z.infer<typeof postSchema>;

interface PostFormProps {
  mediaIds: string[];
  onBack: () => void;
  onSuccess: () => void;
}

export const PostForm: React.FC<PostFormProps> = ({
  mediaIds,
  onBack,
  onSuccess,
}) => {
  const [isScheduled, setIsScheduled] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const { create } = usePost();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      visibility: 'PUBLIC',
    },
  });

  const content = watch('content', '');

  // Estrae gli hashtag già presenti nel contenuto
  const inlineHashtags = (content.match(/#(\w+)/g) || []).map(t => t.slice(1));

  const addHashtag = (raw: string) => {
    const tag = raw.replace(/^#+/, '').trim().toLowerCase();
    if (!tag) return;
    if (hashtags.includes(tag) || inlineHashtags.includes(tag)) return;
    setHashtags(prev => [...prev, tag]);
  };

  const handleHashtagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      addHashtag(hashtagInput);
      setHashtagInput('');
    } else if (e.key === 'Backspace' && hashtagInput === '' && hashtags.length > 0) {
      setHashtags(prev => prev.slice(0, -1));
    }
  };

  const removeHashtag = (tag: string) => {
    setHashtags(prev => prev.filter(t => t !== tag));
  };

  const onSubmit = async (data: PostFormData) => {
    try {
      // Appende gli hashtag extra al contenuto
      const extraTags = hashtags
        .filter(t => !inlineHashtags.includes(t))
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
      onSuccess();
    } catch (error) {
      console.error('Failed to create post:', error);
    }
  };

  const visibilityOptions = [
    { value: 'PUBLIC', label: 'Pubblico' },
    { value: 'FOLLOWERS', label: 'Solo follower' },
    { value: 'PRIVATE', label: 'Privato' },
  ];

  const allHashtags = [...new Set([...inlineHashtags, ...hashtags])];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <TextArea
        label="Descrizione"
        placeholder="Cosa vuoi condividere? Puoi usare #hashtag direttamente nel testo..."
        error={errors.content?.message}
        maxLength={2000}
        showCount
        {...register('content')}
      />

      {/* ── Hashtag input ── */}
      <div className={styles.hashtagSection}>
        <label className={styles.hashtagLabel}>
          <svg viewBox="0 0 24 24" className={styles.hashtagIcon}>
            <path d="M11 7H9V9H7V11H9V13H7V15H9V17H11V15H13V17H15V15H17V13H15V11H17V9H15V7H13V9H11V7ZM13 13H11V11H13V13Z"/>
          </svg>
          Hashtag
        </label>

        <div className={styles.hashtagInputWrapper}>
          {allHashtags.map(tag => (
            <span key={tag} className={`${styles.chip} ${inlineHashtags.includes(tag) ? styles.chipInline : ''}`}>
              #{tag}
              {!inlineHashtags.includes(tag) && (
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => removeHashtag(tag)}
                  aria-label={`Rimuovi #${tag}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
          <input
            type="text"
            className={styles.hashtagInput}
            placeholder={allHashtags.length === 0 ? 'Aggiungi hashtag... (premi Invio o Spazio)' : 'Altro...'}
            value={hashtagInput}
            onChange={e => setHashtagInput(e.target.value.replace(/\s/g, ''))}
            onKeyDown={handleHashtagKeyDown}
            onBlur={() => {
              if (hashtagInput) {
                addHashtag(hashtagInput);
                setHashtagInput('');
              }
            }}
          />
        </div>
        <p className={styles.hashtagHint}>
          Puoi aggiungere tag qui oppure scrivere #hashtag direttamente nella descrizione
        </p>
      </div>

      <Select
        label="Visibilità"
        options={visibilityOptions}
        error={errors.visibility?.message}
        {...register('visibility')}
      />

      <div className={styles.scheduledToggle}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={isScheduled}
            onChange={(e) => setIsScheduled(e.target.checked)}
          />
          <span>Programma pubblicazione</span>
        </label>
      </div>

      {isScheduled && (
        <input
          type="datetime-local"
          className={styles.datetime}
          min={new Date().toISOString().slice(0, 16)}
          {...register('scheduled_at')}
        />
      )}

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onBack}>
          Indietro
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Pubblica
        </Button>
      </div>
    </form>
  );
};
