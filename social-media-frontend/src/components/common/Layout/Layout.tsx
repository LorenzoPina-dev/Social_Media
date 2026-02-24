import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { MobileNav } from './MobileNav';
import { useIsMobile } from '@/hooks/useMediaQuery';
import styles from './Layout.module.css';

export const Layout = () => {
  const isMobile = useIsMobile();

  return (
    <div className={styles.layout}>
      <Navbar />
      <div className={styles.container}>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      {isMobile && <MobileNav />}
    </div>
  );
};
