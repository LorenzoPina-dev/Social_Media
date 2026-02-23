import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import { Input } from '@/components/common/Inputs/Input';
import { Button } from '@/components/common/Buttons/Button';
import { forgotPassword } from '@/api/auth';
import toast from 'react-hot-toast';
import styles from './ForgotPasswordForm.module.css';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email non valida'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

interface ForgotPasswordFormProps {
  onSuccess: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);

    try {
      await forgotPassword({ email: data.email });
      setSent(true);
      toast.success('Email di recupero inviata!');
      setTimeout(onSuccess, 3000);
    } catch (err) {
      toast.error('Errore durante l\'invio dell\'email');
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className={styles.success}>
        <h3 className={styles.title}>Email inviata!</h3>
        <p className={styles.message}>
          Controlla la tua casella di posta e segui le istruzioni per reimpostare la password.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <h3 className={styles.title}>Recupera password</h3>
      
      <p className={styles.message}>
        Inserisci l'email associata al tuo account. Ti invieremo un link per reimpostare la password.
      </p>

      <Input
        label="Email"
        type="email"
        placeholder="tua@email.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <div className={styles.actions}>
        <Link to="/login" className={styles.backLink}>
          Torna al login
        </Link>
        <Button type="submit" loading={isLoading}>
          Invia email
        </Button>
      </div>
    </form>
  );
};