import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/common/Modals/Modal';
import { TextArea } from '@/components/common/Inputs/TextArea';
import { Select } from '@/components/common/Inputs/Select';
import { Button } from '@/components/common/Buttons/Button';
import { usePost } from '@/hooks/usePost';
import { Post, Visibility } from '@/types/post.types';
import toast from 'react-hot-toast';
import styles from './EditPostModal.module.css';

const editPostSchema = z.object({
  content: z
    .string()
    .min(1, 'Il post non può essere vuoto')
    .max(2000, 'Il post non può superare 2000 caratteri'),
  visibility: z.enum(['PUBLIC', 'FOLLOWERS', 'PRIVATE'] as const),
});

type EditPostFormData = z.infer<typeof editPostSchema>;

interface EditPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  onSuccess?: () => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  isOpen,
  onClose,
  post,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { update } = usePost(post.id);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditPostFormData>({
    resolver: zodResolver(editPostSchema),
    defaultValues: {
      content: post.content,
      visibility: post.visibility,
    },
  });

  const onSubmit = async (data: EditPostFormData) => {
    setIsSubmitting(true);
    try {
      await update(post.id, data);
      toast.success('Post aggiornato!');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Errore durante l\'aggiornamento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibilityOptions = [
    { value: 'PUBLIC', label: 'Pubblico' },
    { value: 'FOLLOWERS', label: 'Solo follower' },
    { value: 'PRIVATE', label: 'Privato' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Modifica post"
      size="medium"
    >
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <TextArea
          label="Contenuto"
          placeholder="Modifica il tuo post..."
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

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Salva modifiche
          </Button>
        </div>
      </form>
    </Modal>
  );
};