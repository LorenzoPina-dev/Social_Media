import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/common/Inputs/Input';
import { Button } from '@/components/common/Buttons/Button';
import { register as registerApi } from '@/api/auth';
import toast from 'react-hot-toast';
import styles from './RegisterForm.module.css';

const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username deve essere almeno 3 caratteri')
    .max(30, 'Username non può superare 30 caratteri')
    .regex(/^[a-zA-Z0-9_]+$/, 'Solo lettere, numeri e underscore'),
  email: z.string().email('Email non valida'),
  display_name: z.string().max(100, 'Nome visualizzato troppo lungo').optional(),
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

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);

    try {
      await registerApi({
        username: data.username,
        email: data.email,
        password: data.password,
        display_name: data.display_name,
      });
      
      toast.success('Registrazione completata! Ora puoi accedere.');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Errore durante la registrazione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
      <h2 className={styles.title}>Registrati su SocialApp</h2>

      <Input
        label="Username"
        placeholder="Scegli un username"
        error={errors.username?.message}
        {...register('username')}
      />

      <Input
        label="Email"
        type="email"
        placeholder="Inserisci la tua email"
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label="Nome visualizzato (opzionale)"
        placeholder="Come vuoi essere chiamato"
        error={errors.display_name?.message}
        {...register('display_name')}
      />

      <Input
        type="password"
        label="Password"
        placeholder="Crea una password"
        error={errors.password?.message}
        helper="Minimo 8 caratteri, almeno una maiuscola, un numero e un carattere speciale"
        {...register('password')}
      />

      <Input
        type="password"
        label="Conferma password"
        placeholder="Ripeti la password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button
        type="submit"
        fullWidth
        loading={isLoading}
      >
        Registrati
      </Button>

      <div className={styles.login}>
        Hai già un account?{' '}
        <Link to="/login">Accedi</Link>
      </div>
    </form>
  );
};