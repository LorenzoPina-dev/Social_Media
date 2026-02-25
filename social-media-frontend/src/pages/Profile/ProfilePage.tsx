import { useParams } from 'react-router-dom';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileTabs } from '@/components/profile/ProfileTabs';
import { useProfile } from '@/hooks/useProfile';
import { PageLoader } from '@/components/common/Loading/PageLoader';
import { NotFound } from '@/components/common/Error/NotFound';
import styles from './ProfilePage.module.css';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const {
    profile,
    posts,
    isLoading,
    error,
    isOwnProfile,
    updateProfile,
    follow,
    unfollow,
  } = useProfile(username);

  if (isLoading) {
    return <PageLoader />;
  }

  if (error || !profile) {
    return <NotFound />;
  }

  return (
    
    <div className={styles.profilePage}>
      <ProfileHeader
        profile={profile}
        isOwnProfile={isOwnProfile}
        onUpdateProfile={updateProfile}
        onFollow={follow}
        onUnfollow={unfollow}
      />

      <ProfileTabs
        posts={posts}
        profile={profile}
        isOwnProfile={isOwnProfile}
      />
    </div>
  );
};

export default ProfilePage