import { Profile } from '@/types/user.types';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { FollowButton } from '@/components/interactions/FollowButton';
import styles from './UserResult.module.css';

interface UserResultProps {
  user: Profile;
  onClick?: () => void;
}

export const UserResult: React.FC<UserResultProps> = ({ user, onClick }) => {
  return (
    <div className={styles.userResult} onClick={onClick}>
      <Avatar
        src={user.avatar_url}
        username={user.username}
        size="medium"
      />
      
      <div className={styles.info}>
        <div className={styles.names}>
          <span className={styles.username}>
            {user.username}
            {user.verified && (
              <span className={styles.verifiedBadge}>✓</span>
            )}
          </span>
          <span className={styles.displayName}>{user.display_name}</span>
        </div>
        
        <div className={styles.stats}>
          <span>{user.follower_count} follower</span>
          <span>•</span>
          <span>{user.post_count} post</span>
        </div>
      </div>

      <div className={styles.action}>
        <FollowButton
          userId={user.id}
          initialFollowing={user.is_following}
          size="small"
        />
      </div>
    </div>
  );
};