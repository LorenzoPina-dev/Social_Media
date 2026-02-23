import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { MFALogin } from '@/components/auth/MFALogin';
import { useAuth } from '@/hooks/useAuth';
import styles from './LoginPage.module.css';

const LoginPage = () => {
  const [mfaData, setMfaData] = useState<{ username: string; password: string } | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (username: string, password: string, mfaCode?: string) => {
    try {
      await login(username, password, mfaCode);
      navigate('/');
    } catch (error: any) {
      if (error.message === 'MFA_REQUIRED') {
        setMfaData({ username, password });
      }
    }
  };

  const handleMFAVerify = async (code: string) => {
    if (mfaData) {
      await handleLogin(mfaData.username, mfaData.password, code);
    }
  };

  const handleMFACancel = () => {
    setMfaData(null);
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.container}>
        <div className={styles.leftPanel}>
          <h1 className={styles.logo}>SocialApp</h1>
          <p className={styles.tagline}>
            Connettiti con il mondo
          </p>
        </div>

        <div className={styles.rightPanel}>
          {mfaData ? (
            <MFALogin
              username={mfaData.username}
              password={mfaData.password}
              onVerify={handleMFAVerify}
              onCancel={handleMFACancel}
            />
          ) : (
            <LoginForm onMFARequired={(username, password) => 
              setMfaData({ username, password })
            } />
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage