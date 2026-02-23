import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/common/Inputs/Input';
import { Button } from '@/components/common/Buttons/Button';
import { ConfirmDialog } from '@/components/common/Modals/ConfirmDialog';
import { useAuth } from '@/hooks/useAuth';
import { updateProfile, deleteAccount } from '@/api/users';
import { resetPassword } from '@/api/auth';
import toast from 'react-hot-toast';
import styles from './AccountSettings.module.css';

const profileSchema = z.object({
  display_name: z.string().max(100, 'Nome troppo lungo').optional(),
  email: z.string().email('Email non valida'),
  bio: z.string().max(500, 'Bio troppo lunga').optional(),
  website_url: z.string().url('URL non valido').optional().or(z.literal('')),
  location: z.string().max(100, 'Località troppo lunga').optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Password attuale obbligatoria'),
  newPassword: z
    .string()
    .min(8, 'Password deve essere almeno 8 caratteri')
    .regex(/[A-Z]/, 'Almeno una lettera maiuscola')
    .regex(/[a-z]/, 'Almeno una lettera minuscola')
    .regex(/[0-9]/, 'Almeno un numero')
    .regex(/[^A-Za-z0-9]/, 'Almeno un carattere speciale'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Le password non coincidono',
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export const AccountSettings: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      display_name: user?.display_name || '',
      email: user?.email || '',
      bio: '',
      website_url: '',
      location: '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPassword,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsSavingProfile(true);
    try {
      await updateProfile(data);
      updateUser(data);
      toast.success('Profilo aggiornato!');
    } catch (error) {
      toast.error('Errore durante l\'aggiornamento');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsChangingPassword(true);
    try {
      await resetPassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success('Password cambiata!');
      resetPassword();
    } catch (error) {
      toast.error('Errore durante il cambio password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      toast.success('Account eliminato');
      await logout();
    } catch (error) {
      toast.error('Errore durante l\'eliminazione');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className={styles.settings}>
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Informazioni profilo</h3>
        <form onSubmit={handleSubmitProfile(onProfileSubmit)} className={styles.form}>
          <Input
            label="Nome visualizzato"
            placeholder="Come vuoi essere chiamato"
            error={profileErrors.display_name?.message}
            {...registerProfile('display_name')}
          />

          <Input
            label="Email"
            type="email"
            placeholder="tua@email.com"
            error={profileErrors.email?.message}
            {...registerProfile('email')}
          />

          <Input
            label="Bio"
            placeholder="Parla di te..."
            error={profileErrors.bio?.message}
            {...registerProfile('bio')}
          />

          <Input
            label="Sito web"
            placeholder="https://tuosito.com"
            error={profileErrors.website_url?.message}
            {...registerProfile('website_url')}
          />

          <Input
            label="Località"
            placeholder="Dove vivi?"
            error={profileErrors.location?.message}
            {...registerProfile('location')}
          />

          <Button
            type="submit"
            loading={isSavingProfile}
            className={styles.submitButton}
          >
            Salva modifiche
          </Button>
        </form>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Cambia password</h3>
        <form onSubmit={handleSubmitPassword(onPasswordSubmit)} className={styles.form}>
          <Input
            type="password"
            label="Password attuale"
            placeholder="Inserisci password attuale"
            error={passwordErrors.currentPassword?.message}
            {...registerPassword('currentPassword')}
          />

          <Input
            type="password"
            label="Nuova password"
            placeholder="Inserisci nuova password"
            error={passwordErrors.newPassword?.message}
            {...registerPassword('newPassword')}
          />

          <Input
            type="password"
            label="Conferma password"
            placeholder="Conferma nuova password"
            error={passwordErrors.confirmPassword?.message}
            {...registerPassword('confirmPassword')}
          />

          <Button
            type="submit"
            loading={isChangingPassword}
            className={styles.submitButton}
          >
            Cambia password
          </Button>
        </form>
      </section>

      <section className={`${styles.section} ${styles.dangerZone}`}>
        <h3 className={styles.sectionTitle}>Zona pericolosa</h3>
        <p className={styles.warning}>
          Una volta eliminato l'account, non potrai più recuperare i tuoi dati.
        </p>
        <Button
          variant="danger"
          onClick={() => setShowDeleteConfirm(true)}
        >
          Elimina account
        </Button>
      </section>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="Elimina account"
        message="Sei sicuro di voler eliminare il tuo account? Questa azione è irreversibile e tutti i tuoi dati verranno persi."
        confirmText={isDeleting ? 'Eliminazione...' : 'Elimina definitivamente'}
        variant="danger"
      />
    </div>
  );
};