import { useState } from 'react';
import { Button } from '@/components/common/Buttons/Button';
import { Modal } from '@/components/common/Modals/Modal';
import { MFASetup } from '@/components/auth/MFASetup';
import { disableMFA } from '@/api/auth';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import styles from './MFASettings.module.css';

export const MFASettings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);

  const handleDisableMFA = async () => {
    setIsDisabling(true);
    try {
      await disableMFA();
      await refreshUser();
      toast.success('MFA disattivata');
      setShowDisableConfirm(false);
    } catch (error) {
      toast.error('Errore durante la disattivazione');
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <div className={styles.settings}>
      <h3 className={styles.title}>Autenticazione a Due Fattori (MFA)</h3>

      <div className={styles.content}>
        <p className={styles.description}>
          L'autenticazione a due fattori aggiunge un ulteriore livello di sicurezza
          al tuo account, richiedendo un codice aggiuntivo oltre alla password.
        </p>

        {user?.mfa_enabled ? (
          <div className={styles.enabled}>
            <div className={styles.status}>
              <span className={styles.statusIcon}>✅</span>
              <span className={styles.statusText}>MFA attiva</span>
            </div>
            <Button
              variant="danger"
              onClick={() => setShowDisableConfirm(true)}
            >
              Disattiva MFA
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            onClick={() => setShowSetupModal(true)}
          >
            Attiva MFA
          </Button>
        )}
      </div>

      <Modal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        title="Configura MFA"
        size="medium"
      >
        <MFASetup
          onComplete={() => {
            setShowSetupModal(false);
            refreshUser();
          }}
          onClose={() => setShowSetupModal(false)}
        />
      </Modal>

      <Modal
        isOpen={showDisableConfirm}
        onClose={() => setShowDisableConfirm(false)}
        title="Disattiva MFA"
        size="small"
      >
        <div className={styles.disableConfirm}>
          <p>Sei sicuro di voler disattivare l'autenticazione a due fattori?</p>
          <p className={styles.warning}>
            Il tuo account sarà meno sicuro senza MFA.
          </p>
          <div className={styles.actions}>
            <Button
              variant="ghost"
              onClick={() => setShowDisableConfirm(false)}
            >
              Annulla
            </Button>
            <Button
              variant="danger"
              onClick={handleDisableMFA}
              loading={isDisabling}
            >
              Disattiva
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};