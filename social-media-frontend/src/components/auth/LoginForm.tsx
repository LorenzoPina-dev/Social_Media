import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/common/Inputs/Input';
import { Button } from '@/components/common/Buttons/Button';
import { useAuth } from '@/hooks/useAuth';
import styles from './LoginForm.module.css';

const loginSchema = z.object({
  username: z.string().min(1, 'Username obbligatorio'),
  password: z.string().min(1, 'Password obbligatoria'),
  mfaCode: z.string().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  onMFARequired?: (username: string, password: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onMFARequired }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await login(data.username, data.password, data.mfaCode);
      navigate('/');
    } catch (err: any) {
      if (err.message === 'MFA_REQUIRED' && onMFARequired) {
        onMFARequired(data.username, data.password);
      } else {
        setError(err.response?.data?.error || 'Credenziali non valide');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <h2 className={styles.title}>Accedi a SocialApp</h2>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}

      <Input
        label="Username o email"
        placeholder="Inserisci username o email"
        error={errors.username?.message}
        {...register('username')}
      />

      <Input
        type="password"
        label="Password"
        placeholder="Inserisci password"
        error={errors.password?.message}
        {...register('password')}
      />

      <Input
        label="Codice MFA (opzionale)"
        placeholder="Inserisci codice 2FA"
        error={errors.mfaCode?.message}
        {...register('mfaCode')}
      />

      <div className={styles.forgotPassword}>
        <Link to="/forgot-password">Password dimenticata?</Link>
      </div>

      <Button
        type="submit"
        fullWidth
        loading={isLoading}
      >
        Accedi
      </Button>

      <div className={styles.register}>
        Non hai un account?{' '}
        <Link to="/register">Registrati</Link>
      </div>
    </form>
  );
};