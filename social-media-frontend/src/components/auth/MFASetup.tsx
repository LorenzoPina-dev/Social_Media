import { useState, useEffect } from 'react';
import QRCode from 'qrcode.react';
import { Input } from '@/components/common/Inputs/Input';
import { Button } from '@/components/common/Buttons/Button';
import { setupMFA, verifyMFA } from '@/api/auth';
import toast from 'react-hot-toast';
import styles from './MFASetup.module.css';
import { Spinner } from '../common/Loading/Spinner';

interface MFASetupProps {
  onComplete: () => void;
  onClose: () => void;
}

export const MFASetup: React.FC<MFASetupProps> = ({ onComplete, onClose }) => {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup'>('setup');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    handleSetup();
  }, []);

  const handleSetup = async () => {
    setIsLoading(true);
    try {
      const response = await setupMFA();
      setSecret(response.data.secret);
      setQrCode(response.data.qr_code);
      setBackupCodes(response.data.backup_codes);
      setStep('verify');
    } catch (err) {
      toast.error('Errore durante il setup MFA');
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationCode) {
      setError('Inserisci il codice');
      return;
    }

    setIsLoading(true);
    try {
      await verifyMFA({ code: verificationCode });
      setStep('backup');
    } catch (err) {
      setError('Codice non valido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    toast.success('MFA attivata con successo!');
    onComplete();
  };

  const downloadBackupCodes = () => {
    const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading && step === 'setup') {
    return (
      <div className={styles.loading}>
        <Spinner size="large" />
        <p>Preparazione MFA in corso...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {step === 'verify' && (
        <>
          <h3 className={styles.title}>Configura Autenticazione a Due Fattori</h3>
          
          <div className={styles.qrContainer}>
            <QRCode value={qrCode} size={200} level="H" />
          </div>
          
          <p className={styles.secret}>
            Codice segreto: <code>{secret}</code>
          </p>
          
          <p className={styles.instruction}>
            Scansiona il QR code con la tua app di autenticazione (Google Authenticator, Authy, ecc.)
            e inserisci il codice generato.
          </p>

          <Input
            label="Codice di verifica"
            placeholder="Inserisci il codice a 6 cifre"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            error={error}
            maxLength={6}
          />

          <div className={styles.actions}>
            <Button variant="ghost" onClick={onClose}>
              Annulla
            </Button>
            <Button onClick={handleVerify} loading={isLoading}>
              Verifica
            </Button>
          </div>
        </>
      )}

      {step === 'backup' && (
        <>
          <h3 className={styles.title}>Codici di Backup</h3>
          
          <p className={styles.instruction}>
            Salva questi codici in un luogo sicuro. Possono essere usati per accedere
            al tuo account se perdi l'accesso all'app di autenticazione.
          </p>

          <div className={styles.backupCodes}>
            {backupCodes.map((code, index) => (
              <code key={index} className={styles.backupCode}>
                {code}
              </code>
            ))}
          </div>

          <div className={styles.actions}>
            <Button variant="outline" onClick={downloadBackupCodes}>
              Scarica codici
            </Button>
            <Button onClick={handleComplete}>
              Completa
            </Button>
          </div>
        </>
      )}
    </div>
  );
};