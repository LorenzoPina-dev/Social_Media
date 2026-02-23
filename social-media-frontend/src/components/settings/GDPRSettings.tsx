import { useState } from 'react';
import { Button } from '@/components/common/Buttons/Button';
import { ConfirmDialog } from '@/components/common/Modals/ConfirmDialog';
import { exportGDPRData, deleteAccount } from '@/api/users';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import styles from './GDPRSettings.module.css';

export const GDPRSettings: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { logout } = useAuth();

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await exportGDPRData();
      
      // Create download link
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `socialapp-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Dati esportati con successo!');
    } catch (error) {
      toast.error('Errore durante l\'esportazione');
    } finally {
      setIsExporting(false);
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
      <h3 className={styles.title}>GDPR e Privacy</h3>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Esporta i tuoi dati</h4>
        <p className={styles.description}>
          Puoi richiedere una copia di tutti i tuoi dati in formato JSON.
          Questa operazione potrebbe richiedere alcuni minuti.
        </p>
        <Button
          onClick={handleExportData}
          loading={isExporting}
          variant="outline"
        >
          Esporta dati
        </Button>
      </section>

      <section className={`${styles.section} ${styles.dangerZone}`}>
        <h4 className={styles.sectionTitle}>Elimina account</h4>
        <p className={styles.warning}>
          L'eliminazione del tuo account è irreversibile. Tutti i tuoi post,
          commenti e like verranno permanentemente rimossi.
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
        message="Sei sicuro di voler eliminare definitivamente il tuo account? Questa azione non può essere annullata e tutti i tuoi dati verranno persi."
        confirmText={isDeleting ? 'Eliminazione...' : 'Elimina definitivamente'}
        variant="danger"
      />
    </div>
  );
};