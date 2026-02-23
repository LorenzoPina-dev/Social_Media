import { useState } from 'react';
import { IconButton } from '@/components/common/Buttons/IconButton';
import { savePost, unsavePost } from '@/api/posts';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';
import styles from './SaveButton.module.css';

interface SaveButtonProps {
  postId: string;
  initialSaved?: boolean;
  onSave?: (saved: boolean) => void;
}

export const SaveButton: React.FC<SaveButtonProps> = ({
  postId,
  initialSaved = false,
  onSave,
}) => {
  const [saved, setSaved] = useState(initialSaved);
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleClick = async () => {
    if (!isAuthenticated) {
      toast.error('Devi essere loggato per salvare');
      return;
    }

    setIsLoading(true);
    try {
      if (saved) {
        await unsavePost(postId);
      } else {
        await savePost(postId);
      }
      setSaved(!saved);
      onSave?.(!saved);
    } catch (error) {
      toast.error('Errore durante l\'operazione');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <IconButton
      onClick={handleClick}
      disabled={isLoading}
      label={saved ? 'Rimuovi dai salvati' : 'Salva'}
      className={`${styles.saveButton} ${saved ? styles.saved : ''}`}
    >
      <svg viewBox="0 0 24 24">
        {saved ? (
          <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        ) : (
          <path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        )}
      </svg>
    </IconButton>
  );
};