import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { getFollowing } from '@/api/users';
import { unwrapItems } from '@/api/envelope';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/user.types';
import styles from './Stories.module.css';

export const Stories: React.FC = () => {
  const [stories, setStories] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadStories = async () => {
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
    };

    loadStories();
  }, [user?.id]);

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
