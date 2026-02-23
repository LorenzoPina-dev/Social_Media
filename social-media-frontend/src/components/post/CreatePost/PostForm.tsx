import { useState } from 'react';
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

  const onSubmit = async (data: PostFormData) => {
    try {
      await create({
        ...data,
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <TextArea
        label="Contenuto"
        placeholder="Cosa vuoi condividere?"
        error={errors.content?.message}
        maxLength={2000}
        showCount
        {...register('content')}
      />

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

      <div className={styles.preview}>
        <p className={styles.previewLabel}>Anteprima:</p>
        <div className={styles.previewContent}>
          {content || 'Il tuo post apparirà qui...'}
        </div>
      </div>

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