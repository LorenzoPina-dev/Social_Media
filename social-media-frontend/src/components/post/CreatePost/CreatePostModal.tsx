import { useState } from 'react';
import { Modal } from '@/components/common/Modals/Modal';
import { PostForm } from './PostForm';
import { MediaUpload } from './MediaUpload';
import styles from './CreatePostModal.module.css';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'upload' | 'details';

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [mediaIds, setMediaIds] = useState<string[]>([]);

  const handleUploadComplete = (ids: string[]) => {
    setMediaIds(ids);
    setStep('details');
  };

  const handleBack = () => {
    setStep('upload');
    setMediaIds([]);
  };

  const handleSuccess = () => {
    onSuccess?.();
    onClose();
    setStep('upload');
    setMediaIds([]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'upload' ? 'Carica foto e video' : 'Dettagli post'}
      size="large"
    >
      <div className={styles.container}>
        {step === 'upload' && (
          <MediaUpload onUploadComplete={handleUploadComplete} />
        )}
        
        {step === 'details' && (
          <PostForm
            mediaIds={mediaIds}
            onBack={handleBack}
            onSuccess={handleSuccess}
          />
        )}
      </div>
    </Modal>
  );
};