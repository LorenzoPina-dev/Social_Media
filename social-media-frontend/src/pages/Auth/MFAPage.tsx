import { useLocation, useNavigate } from 'react-router-dom';
import { MFALogin } from '@/components/auth/MFALogin';
import { useAuth } from '@/hooks/useAuth';
import styles from './MFAPage.module.css';

const MFAPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { username, password } = location.state || {};

  if (!username || !password) {
    navigate('/login');
    return null;
  }

  const handleVerify = async (code: string) => {
    await login(username, password, code);
    navigate('/');
  };

  const handleCancel = () => {
    navigate('/login');
  };

  return (
    <div className={styles.mfaPage}>
      <div className={styles.container}>
        <MFALogin
          username={username}
          password={password}
          onVerify={handleVerify}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
};

export default MFAPage