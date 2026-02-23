import { RegisterForm } from '@/components/auth/RegisterForm';
import styles from './RegisterPage.module.css';

const RegisterPage = () => {
  return (
    <div className={styles.registerPage}>
      <div className={styles.container}>
        <div className={styles.leftPanel}>
          <h1 className={styles.logo}>SocialApp</h1>
          <p className={styles.tagline}>
            Unisciti alla community
          </p>
        </div>

        <div className={styles.rightPanel}>
          <RegisterForm />
        </div>
      </div>
    </div>
  );
};

export default RegisterPage