import { useState, useEffect } from 'react';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { getSuggestedUsers } from '@/api/users';
import { Profile } from '@/types/user.types';
import styles from './Stories.module.css';

export const Stories: React.FC = () => {
  const [stories, setStories] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStories = async () => {
      try {
        const response = await getSuggestedUsers({ limit: 10 });
        setStories(response.data.data);
      } catch (error) {
        console.error('Failed to load stories:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStories();
  }, []);

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
        <div key={user.id} className={styles.story}>
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
        </div>
      ))}
    </div>
  );
};