import { useNavigate } from 'react-router-dom';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import styles from './ForgotPasswordPage.module.css';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();

  const handleSuccess = () => {
    setTimeout(() => {
      navigate('/login');
    }, 3000);
  };

  return (
    <div className={styles.forgotPasswordPage}>
      <div className={styles.container}>
        <h1 className={styles.logo}>SocialApp</h1>
        <ForgotPasswordForm onSuccess={handleSuccess} />
      </div>
    </div>
  );
};

export default ForgotPasswordPage