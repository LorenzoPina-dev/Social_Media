import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { Button } from '@/components/common/Buttons/Button';
import { getSuggestedUsers, followUser } from '@/api/users';
import { Profile } from '@/types/user.types';
import toast from 'react-hot-toast';
import styles from './Suggestions.module.css';

export const Suggestions: React.FC = () => {
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const response = await getSuggestedUsers({ limit: 5 });
      const users = response.data?.data ?? response.data?.items ?? response.data ?? [];
      setSuggestions(Array.isArray(users) ? users : []);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    try {
      await followUser(userId);
      setSuggestions(prev => prev.filter(user => user.id !== userId));
      toast.success('Utente seguito!');
    } catch (error) {
      toast.error('Errore durante il follow');
    }
  };

  if (isLoading) {
    return (
      <div className={styles.suggestions}>
        <h3 className={styles.title}>Suggerimenti per te</h3>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.suggestionSkeleton}>
            <div className={styles.avatarSkeleton} />
            <div className={styles.infoSkeleton}>
              <div className={styles.nameSkeleton} />
              <div className={styles.usernameSkeleton} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={styles.suggestions}>
      <div className={styles.header}>
        <h3 className={styles.title}>Suggerimenti per te</h3>
        <Link to="/explore" className={styles.seeAll}>
          Vedi tutti
        </Link>
      </div>
      
      {suggestions.map((user) => (
        <div key={user.id} className={styles.suggestion}>
          <Link to={`/profile/${user.id}`} className={styles.userInfo}>
            <Avatar
              src={user.avatar_url}
              username={user.username}
              size="small"
            />
            <div className={styles.userDetails}>
              <span className={styles.username}>{user.username}</span>
              <span className={styles.name}>{user.display_name}</span>
            </div>
          </Link>
          
          <Button
            size="small"
            variant="primary"
            onClick={() => handleFollow(user.id)}
          >
            Segui
          </Button>
        </div>
      ))}
    </div>
  );
};
