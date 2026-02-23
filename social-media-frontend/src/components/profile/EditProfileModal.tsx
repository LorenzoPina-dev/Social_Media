import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/common/Modals/Modal';
import { Input } from '@/components/common/Inputs/Input';
import { TextArea } from '@/components/common/Inputs/TextArea';
import { Button } from '@/components/common/Buttons/Button';
import { Profile } from '@/types/user.types';
import styles from './EditProfileModal.module.css';

const editProfileSchema = z.object({
  display_name: z.string().max(100, 'Nome troppo lungo').optional(),
  bio: z.string().max(500, 'Bio troppo lunga').optional(),
  website_url: z.string().url('URL non valido').optional().or(z.literal('')),
  location: z.string().max(100, 'Località troppo lunga').optional(),
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
      display_name: profile.display_name || '',
      bio: profile.bio || '',
      website_url: profile.website_url || '',
      location: profile.location || '',
    },
  });

  const onSubmit = async (data: EditProfileFormData) => {
    if (onSave) {
      await onSave(data);
      onClose();
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Modifica profilo" size="medium">
      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <Input
          label="Nome visualizzato"
          placeholder="Come vuoi essere chiamato"
          error={errors.display_name?.message}
          {...register('display_name')}
        />

        <TextArea
          label="Bio"
          placeholder="Parla di te..."
          error={errors.bio?.message}
          maxLength={500}
          showCount
          {...register('bio')}
        />

        <Input
          label="Sito web"
          placeholder="https://tuosito.com"
          error={errors.website_url?.message}
          {...register('website_url')}
        />

        <Input
          label="Località"
          placeholder="Dove vivi?"
          error={errors.location?.message}
          {...register('location')}
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