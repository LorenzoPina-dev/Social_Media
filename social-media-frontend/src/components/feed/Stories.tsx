import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { getFollowing } from '@/api/users';
import { unwrapItems } from '@/api/envelope';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { Profile } from '@/types/user.types';
import styles from './Stories.module.css';

export const Stories: React.FC = () => {
  const [stories, setStories] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { socket } = useSocket();

  const loadStories = useCallback(async () => {
    if (!user?.id) {
      setStories([]);
      setIsLoading(false);
      return;
    }

    try {
      const response = await getFollowing(user.id, { limit: 20 });
      const users = unwrapItems<Profile>(response.data).filter((u) => u.id !== user.id);
      setStories(users);
    } catch (error) {
      console.error('Failed to load stories:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Caricamento iniziale
  useEffect(() => {
    loadStories();
  }, [loadStories]);

  // Aggiornamento real-time: quando l'utente segue qualcuno il backend
  // emette 'stories:refresh' e il carosello si aggiorna automaticamente.
  useEffect(() => {
    if (!socket) return;
    const onRefresh = () => loadStories();
    socket.on('stories:refresh', onRefresh);
    return () => { socket.off('stories:refresh', onRefresh); };
  }, [socket, loadStories]);

  if (isLoading) {
    return (
      <div className={styles.stories}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className={styles.storySkeleton}>
            <div className={styles.avatarSkeleton} />
            <div className={styles.nameSkeleton} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.stories}>
      {stories.map((user) => (
        <Link key={user.id} to={`/profile/${user.id}`} className={styles.story}>
          <div className={styles.storyRing}>
            <Avatar
              src={user.avatar_url}
              username={user.username}
              size="medium"
            />
          </div>
          <span className={styles.username}>
            {user.username.length > 10
              ? `${user.username.slice(0, 10)}...`
              : user.username}
          </span>
        </Link>
      ))}
    </div>
  );
};
