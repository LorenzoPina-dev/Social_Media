import { useParams } from 'react-router-dom';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import styles from './ResetPasswordPage.module.css';

const ResetPasswordPage = () => {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <div className={styles.error}>
        <p>Token non valido</p>
      </div>
    );
  }

  return (
    <div className={styles.resetPasswordPage}>
      <div className={styles.container}>
        <h1 className={styles.logo}>SocialApp</h1>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
};

export default ResetPasswordPage