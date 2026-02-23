import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AccountSettings } from '@/components/settings/AccountSettings';
import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { MFASettings } from '@/components/settings/MFASettings';
import { GDPRSettings } from '@/components/settings/GDPRSettings';
import styles from './SettingsPage.module.css';

type SettingsTab = 'account' | 'privacy' | 'notifications' | 'mfa' | 'gdpr';

const SettingsPage = () => {
  const { tab = 'account' } = useParams<{ tab: SettingsTab }>();
  const navigate = useNavigate();

  const tabs = [
    { id: 'account', label: 'Account', icon: '👤' },
    { id: 'privacy', label: 'Privacy', icon: '🔒' },
    { id: 'notifications', label: 'Notifiche', icon: '🔔' },
    { id: 'mfa', label: 'MFA', icon: '🔐' },
    { id: 'gdpr', label: 'GDPR', icon: '📋' },
  ] as const;

  const renderContent = () => {
    switch (tab) {
      case 'account':
        return <AccountSettings />;
      case 'privacy':
        return <PrivacySettings />;
      case 'notifications':
        return <NotificationPreferences />;
      case 'mfa':
        return <MFASettings />;
      case 'gdpr':
        return <GDPRSettings />;
      default:
        return <AccountSettings />;
    }
  };

  return (
    <div className={styles.settingsPage}>
      <div className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Impostazioni</h2>
        <nav className={styles.nav}>
          {tabs.map((item) => (
            <button
              key={item.id}
              className={`${styles.navItem} ${tab === item.id ? styles.active : ''}`}
              onClick={() => navigate(`/settings/${item.id}`)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className={styles.content}>
        {renderContent()}
      </div>
    </div>
  );
};

export default SettingsPage