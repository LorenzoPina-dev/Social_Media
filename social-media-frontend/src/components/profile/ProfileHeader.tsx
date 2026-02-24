import { useState } from 'react';
import { Profile } from '@/types/user.types';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { FollowButton } from '@/components/interactions/FollowButton';
import { Button } from '@/components/common/Buttons/Button';
import { EditProfileModal } from './EditProfileModal';
import styles from './ProfileHeader.module.css';

interface ProfileHeaderProps {
  profile: Profile;
  isOwnProfile: boolean;
  onUpdateProfile?: (data: any) => Promise<void>;
  onFollow?: () => void;
  onUnfollow?: () => void;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  isOwnProfile,
  onUpdateProfile,
  onFollow,
  onUnfollow,
}) => {
  const [showEditModal, setShowEditModal] = useState(false);

  return (
    <>
      <div className={styles.header}>
        <div className={styles.avatarSection}>
          <Avatar
            src={profile.avatar_url}
            username={profile.username}
            size="xlarge"
          />
        </div>

        <div className={styles.infoSection}>
          <div className={styles.usernameRow}>
            <h2 className={styles.username}>{profile.username}</h2>
            {profile.verified && (
              <span className={styles.verifiedBadge}>✓</span>
            )}
          </div>

          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{profile.post_count}</span>
              <span className={styles.statLabel}>post</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{profile.follower_count}</span>
              <span className={styles.statLabel}>follower</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{profile.following_count}</span>
              <span className={styles.statLabel}>following</span>
            </div>
          </div>

          <div className={styles.bio}>
            <h3 className={styles.displayName}>{profile.display_name}</h3>
            {profile.bio && <p className={styles.bioText}>{profile.bio}</p>}
          </div>

          <div className={styles.actions}>
            {isOwnProfile ? (
              <Button onClick={() => setShowEditModal(true)}>
                Modifica profilo
              </Button>
            ) : (
              <FollowButton
                userId={profile.id}
                initialFollowing={profile.is_following}
                onFollow={onFollow}
                onUnfollow={onUnfollow}
              />
            )}
          </div>
        </div>
      </div>

      {showEditModal && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSave={onUpdateProfile}
        />
      )}
    </>
  );
};
