import { useState } from 'react';
import { IconButton } from '@/components/common/Buttons/IconButton';
import { Modal } from '@/components/common/Modals/Modal';
import { sharePost } from '@/api/interactions';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import styles from './ShareButton.module.css';

interface ShareButtonProps {
  postId: string;
  onShare?: () => void;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  postId,
  onShare,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [comment, setComment] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleShare = async () => {
    if (!isAuthenticated) {
      toast.error('Devi essere loggato per condividere');
      return;
    }

    setIsSharing(true);
    try {
      await sharePost(postId, comment || undefined);
      toast.success('Post condiviso!');
      setShowModal(false);
      setComment('');
      onShare?.();
    } catch (error) {
      toast.error('Errore durante la condivisione');
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/p/${postId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiato!');
    setShowModal(false);
  };

  return (
    <>
      <IconButton
        onClick={() => setShowModal(true)}
        label="Condividi"
        className={styles.shareButton}
      >
        <svg viewBox="0 0 24 24">
          <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/>
        </svg>
      </IconButton>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Condividi post"
        size="small"
      >
        <div className={styles.modalContent}>
          <button
            className={styles.option}
            onClick={handleCopyLink}
          >
            <svg viewBox="0 0 24 24">
              <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1 0 1.71-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
            </svg>
            <span>Copia link</span>
          </button>

          <div className={styles.divider}>o</div>

          <textarea
            className={styles.comment}
            placeholder="Aggiungi un commento (opzionale)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />

          <button
            className={styles.shareAction}
            onClick={handleShare}
            disabled={isSharing}
          >
            {isSharing ? 'Condivisione...' : 'Condividi'}
          </button>
        </div>
      </Modal>
    </>
  );
};