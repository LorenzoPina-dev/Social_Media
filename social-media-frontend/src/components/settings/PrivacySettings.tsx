import { useState, useEffect } from 'react';
import { Button } from '@/components/common/Buttons/Button';
import { getPrivacySettings, updatePrivacySettings } from '@/api/users';
import toast from 'react-hot-toast';
import styles from './PrivacySettings.module.css';

interface PrivacySettingsData {
  is_private: boolean;
  hide_activity_status: boolean;
  allow_tagging: boolean;
  allow_mentions: boolean;
  allow_direct_messages: 'everyone' | 'followers' | 'none';
  who_can_comment: 'everyone' | 'followers' | 'none';
  who_can_see_likes: 'everyone' | 'followers' | 'none';
}

export const PrivacySettings: React.FC = () => {
  const [settings, setSettings] = useState<PrivacySettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await getPrivacySettings();
      setSettings(response.data);
    } catch (error) {
      toast.error('Errore nel caricamento delle impostazioni');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (key: keyof PrivacySettingsData) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: !settings[key as keyof PrivacySettingsData],
    });
  };

  const handleSelect = (key: keyof PrivacySettingsData, value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      await updatePrivacySettings(settings);
      toast.success('Impostazioni privacy salvate!');
    } catch (error) {
      toast.error('Errore durante il salvataggio');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className={styles.loading}>Caricamento...</div>;
  }

  if (!settings) {
    return null;
  }

  return (
    <div className={styles.settings}>
      <h3 className={styles.title}>Impostazioni privacy</h3>

      <div className={styles.section}>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={settings.is_private}
            onChange={() => handleToggle('is_private')}
          />
          <div className={styles.optionInfo}>
            <span className={styles.optionLabel}>Account privato</span>
            <span className={styles.optionDescription}>
              Solo i follower approvati possono vedere i tuoi post
            </span>
          </div>
        </label>
      </div>

      <div className={styles.section}>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={settings.hide_activity_status}
            onChange={() => handleToggle('hide_activity_status')}
          />
          <div className={styles.optionInfo}>
            <span className={styles.optionLabel}>Nascondi stato attività</span>
            <span className={styles.optionDescription}>
              Gli altri non vedranno quando sei online
            </span>
          </div>
        </label>
      </div>

      <div className={styles.section}>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={settings.allow_tagging}
            onChange={() => handleToggle('allow_tagging')}
          />
          <div className={styles.optionInfo}>
            <span className={styles.optionLabel}>Consenti tag</span>
            <span className={styles.optionDescription}>
              Gli altri possono taggarti nei loro post
            </span>
          </div>
        </label>
      </div>

      <div className={styles.section}>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={settings.allow_mentions}
            onChange={() => handleToggle('allow_mentions')}
          />
          <div className={styles.optionInfo}>
            <span className={styles.optionLabel}>Consenti menzioni</span>
            <span className={styles.optionDescription}>
              Gli altri possono menzionarti nei commenti
            </span>
          </div>
        </label>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Chi può mandarti messaggi</h4>
        <div className={styles.radioGroup}>
          {[
            { value: 'everyone', label: 'Tutti' },
            { value: 'followers', label: 'Solo follower' },
            { value: 'none', label: 'Nessuno' },
          ].map((option) => (
            <label key={option.value} className={styles.radio}>
              <input
                type="radio"
                name="direct_messages"
                value={option.value}
                checked={settings.allow_direct_messages === option.value}
                onChange={(e) => handleSelect('allow_direct_messages', e.target.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Chi può commentare i tuoi post</h4>
        <div className={styles.radioGroup}>
          {[
            { value: 'everyone', label: 'Tutti' },
            { value: 'followers', label: 'Solo follower' },
            { value: 'none', label: 'Nessuno' },
          ].map((option) => (
            <label key={option.value} className={styles.radio}>
              <input
                type="radio"
                name="comment_permission"
                value={option.value}
                checked={settings.who_can_comment === option.value}
                onChange={(e) => handleSelect('who_can_comment', e.target.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Chi può vedere i tuoi like</h4>
        <div className={styles.radioGroup}>
          {[
            { value: 'everyone', label: 'Tutti' },
            { value: 'followers', label: 'Solo follower' },
            { value: 'none', label: 'Nessuno' },
          ].map((option) => (
            <label key={option.value} className={styles.radio}>
              <input
                type="radio"
                name="likes_visibility"
                value={option.value}
                checked={settings.who_can_see_likes === option.value}
                onChange={(e) => handleSelect('who_can_see_likes', e.target.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Button
        onClick={handleSave}
        loading={isSaving}
        className={styles.saveButton}
      >
        Salva impostazioni
      </Button>
    </div>
  );
};