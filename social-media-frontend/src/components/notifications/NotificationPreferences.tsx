import { useState, useEffect } from 'react';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/api/notifications';
import { Button } from '@/components/common/Buttons/Button';
import toast from 'react-hot-toast';
import styles from './NotificationPreferences.module.css';

interface Preferences {
  likes_push: boolean;
  likes_email: boolean;
  comments_push: boolean;
  comments_email: boolean;
  follows_push: boolean;
  follows_email: boolean;
  mentions_push: boolean;
  mentions_email: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

export const NotificationPreferences: React.FC = () => {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [enableQuietHours, setEnableQuietHours] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await getNotificationPreferences();
      setPreferences(response.data);
      setEnableQuietHours(
        !!(response.data.quiet_hours_start && response.data.quiet_hours_end)
      );
    } catch (error) {
      toast.error('Errore nel caricamento delle preferenze');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (key: keyof Preferences) => {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  const handleSave = async () => {
    if (!preferences) return;

    setIsSaving(true);
    try {
      await updateNotificationPreferences(preferences);
      toast.success('Preferenze salvate!');
    } catch (error) {
      toast.error('Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Caricamento...</div>;
  }

  if (!preferences) {
    return null;
  }

  return (
    <div className={styles.preferences}>
      <h3 className={styles.title}>Preferenze notifiche</h3>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Like</h4>
        <div className={styles.options}>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={preferences.likes_push}
              onChange={() => handleToggle('likes_push')}
            />
            <span>Notifiche push</span>
          </label>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={preferences.likes_email}
              onChange={() => handleToggle('likes_email')}
            />
            <span>Notifiche email</span>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Commenti</h4>
        <div className={styles.options}>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={preferences.comments_push}
              onChange={() => handleToggle('comments_push')}
            />
            <span>Notifiche push</span>
          </label>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={preferences.comments_email}
              onChange={() => handleToggle('comments_email')}
            />
            <span>Notifiche email</span>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Follow</h4>
        <div className={styles.options}>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={preferences.follows_push}
              onChange={() => handleToggle('follows_push')}
            />
            <span>Notifiche push</span>
          </label>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={preferences.follows_email}
              onChange={() => handleToggle('follows_email')}
            />
            <span>Notifiche email</span>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Menzioni</h4>
        <div className={styles.options}>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={preferences.mentions_push}
              onChange={() => handleToggle('mentions_push')}
            />
            <span>Notifiche push</span>
          </label>
          <label className={styles.option}>
            <input
              type="checkbox"
              checked={preferences.mentions_email}
              onChange={() => handleToggle('mentions_email')}
            />
            <span>Notifiche email</span>
          </label>
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Ore di silenzio</h4>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={enableQuietHours}
            onChange={(e) => {
              setEnableQuietHours(e.target.checked);
              if (!e.target.checked) {
                setPreferences({
                  ...preferences,
                  quiet_hours_start: null,
                  quiet_hours_end: null,
                });
              }
            }}
          />
          <span>Attiva ore di silenzio</span>
        </label>

        {enableQuietHours && (
          <div className={styles.quietHours}>
            <input
              type="time"
              value={preferences.quiet_hours_start || ''}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  quiet_hours_start: e.target.value,
                })
              }
              className={styles.timeInput}
            />
            <span>a</span>
            <input
              type="time"
              value={preferences.quiet_hours_end || ''}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  quiet_hours_end: e.target.value,
                })
              }
              className={styles.timeInput}
            />
          </div>
        )}
      </div>

      <Button
        onClick={handleSave}
        loading={isSaving}
        className={styles.saveButton}
      >
        Salva preferenze
      </Button>
    </div>
  );
};