import { Profile } from '@/types/user.types';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { FollowButton } from '@/components/interactions/FollowButton';
import styles from './UserResult.module.css';

interface UserResultProps {
  user: Profile;
  onClick?: () => void;
}

export const UserResult: React.FC<UserResultProps> = ({ user, onClick }) => {
  const followersCount = user.follower_count ?? user.followers_count ?? 0;
  const postsCount = user.post_count ?? user.posts_count ?? 0;

  return (
    <div className={styles.userResult} onClick={onClick}>
      <Avatar src={user.avatar_url} username={user.username} size="medium" />

      <div className={styles.info}>
        <div className={styles.names}>
          <span className={styles.username}>
            {user.username}
            {user.verified && <span className={styles.verifiedBadge}>OK</span>}
          </span>
          <span className={styles.displayName}>{user.display_name}</span>
        </div>

        <div className={styles.stats}>
          <span>{followersCount} follower</span>
          <span>|</span>
          <span>{postsCount} post</span>
        </div>
      </div>

      <div className={styles.action}>
        <FollowButton userId={user.id} initialFollowing={user.is_following} size="small" />
      </div>
    </div>
  );
};
