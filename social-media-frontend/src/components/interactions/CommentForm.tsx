import { useState } from 'react';
import { Button } from '@/components/common/Buttons/Button';
import styles from './CommentForm.module.css';

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
  isLoading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export const CommentForm: React.FC<CommentFormProps> = ({
  onSubmit,
  isLoading = false,
  placeholder = 'Aggiungi un commento...',
  autoFocus = false,
}) => {
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || isLoading) return;

    await onSubmit(content);
    setContent('');
  };

  return (
    <form className={styles.commentForm} onSubmit={handleSubmit}>
      <input
        type="text"
        className={styles.input}
        placeholder={placeholder}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={isLoading}
        autoFocus={autoFocus}
      />
      <Button
        type="submit"
        size="small"
        disabled={!content.trim() || isLoading}
        loading={isLoading}
      >
        Invia
      </Button>
    </form>
  );
};