import { useState } from 'react';
import { Input } from '@/components/common/Inputs/Input';
import { Button } from '@/components/common/Buttons/Button';
import styles from './MFALogin.module.css';

interface MFALoginProps {
  username: string;
  password: string;
  onVerify: (code: string) => Promise<void>;
  onCancel: () => void;
}

export const MFALogin: React.FC<MFALoginProps> = ({
  username,
  password,
  onVerify,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!code) {
      setError('Inserisci il codice');
      return;
    }

    setIsLoading(true);
    try {
      await onVerify(code);
    } catch (err) {
      setError('Codice non valido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h3 className={styles.title}>Verifica a Due Fattori</h3>
      
      <p className={styles.message}>
        Inserisci il codice a 6 cifre generato dalla tua app di autenticazione
        o uno dei tuoi codici di backup.
      </p>

      <Input
        label="Codice MFA"
        placeholder="000000"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={error}
        maxLength={6}
        autoFocus
      />

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Annulla
        </Button>
        <Button type="submit" loading={isLoading}>
          Verifica
        </Button>
      </div>
    </form>
  );
};