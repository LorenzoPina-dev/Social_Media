import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/common/Modals/Modal';
import { TextArea } from '@/components/common/Inputs/TextArea';
import { Button } from '@/components/common/Buttons/Button';
import { Profile } from '@/types/user.types';
import styles from './EditProfileModal.module.css';

const editProfileSchema = z.object({
  bio: z.string().max(500, 'Bio troppo lunga').optional(),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

interface EditProfileModalProps {
  profile: Profile;
  onClose: () => void;
  onSave?: (data: EditProfileFormData) => Promise<void>;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  profile,
  onClose,
  onSave,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      bio: profile.bio || '',
    },
  });

  const onSubmit = async (data: EditProfileFormData) => {
    if (onSave) {
      await onSave({ bio: data.bio || '' });
      onClose();
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Modifica profilo" size="medium">
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <TextArea
          label="Bio"
          placeholder="Parla di te..."
          error={errors.bio?.message}
          maxLength={500}
          showCount
          {...register('bio')}
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
