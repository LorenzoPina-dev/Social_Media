import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/common/Inputs/Input';
import { Button } from '@/components/common/Buttons/Button';
import { resetPassword } from '@/api/auth';
import toast from 'react-hot-toast';
import styles from './ResetPasswordForm.module.css';

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password deve essere almeno 8 caratteri')
    .regex(/[A-Z]/, 'Almeno una lettera maiuscola')
    .regex(/[a-z]/, 'Almeno una lettera minuscola')
    .regex(/[0-9]/, 'Almeno un numero')
    .regex(/[^A-Za-z0-9]/, 'Almeno un carattere speciale'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Le password non coincidono",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

interface ResetPasswordFormProps {
  token: string;
}

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ token }) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);

    try {
      await resetPassword({
        token,
        newPassword: data.password,
      });
      
      toast.success('Password aggiornata! Ora puoi accedere.');
      navigate('/login');
    } catch (err) {
      toast.error('Errore durante il reset della password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <h3 className={styles.title}>Reimposta password</h3>
      
      <p className={styles.message}>
        Inserisci la nuova password per il tuo account.
      </p>

      <Input
        type="password"
        label="Nuova password"
        placeholder="Inserisci nuova password"
        error={errors.password?.message}
        {...register('password')}
      />

      <Input
        type="password"
        label="Conferma password"
        placeholder="Conferma nuova password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button type="submit" fullWidth loading={isLoading}>
        Reimposta password
      </Button>
    </form>
  );
};