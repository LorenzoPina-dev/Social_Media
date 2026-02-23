import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton } from '@/components/common/Buttons/IconButton';
import { ConfirmDialog } from '@/components/common/Modals/ConfirmDialog';
import { deletePost } from '@/api/posts';
import toast from 'react-hot-toast';
import styles from './PostMenu.module.css';

interface PostMenuProps {
  postId: string;
  onDelete?: () => void;
  onEdit?: () => void;
}

export const PostMenu: React.FC<PostMenuProps> = ({
  postId,
  onDelete,
  onEdit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePost(postId);
      toast.success('Post eliminato');
      onDelete?.();
      navigate('/');
    } catch (error) {
      toast.error('Errore durante l\'eliminazione');
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <div className={styles.container} ref={menuRef}>
        <IconButton
          onClick={() => setIsOpen(!isOpen)}
          label="Opzioni post"
          size="small"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
          </svg>
        </IconButton>

        {isOpen && (
          <div className={styles.dropdown}>
            <button
              className={styles.dropdownItem}
              onClick={() => {
                setIsOpen(false);
                onEdit?.();
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              <span>Modifica</span>
            </button>
            
            <button
              className={`${styles.dropdownItem} ${styles.danger}`}
              onClick={() => {
                setIsOpen(false);
                setShowConfirm(true);
              }}
            >
              <svg viewBox="0 0 24 24">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
              </svg>
              <span>Elimina</span>
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Elimina post"
        message="Sei sicuro di voler eliminare questo post? Questa azione non può essere annullata."
        confirmText={isDeleting ? 'Eliminazione...' : 'Elimina'}
        variant="danger"
      />
    </>
  );
};