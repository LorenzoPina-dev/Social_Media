import { useParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { usePost } from '@/hooks/usePost';
import { FeedPost } from '@/components/feed/FeedPost';
import { PageLoader } from '@/components/common/Loading/PageLoader';
import { NotFound } from '@/components/common/Error/NotFound';
import { postToFeedItem } from '@/utils/postAdapter';
import styles from './PostDetailPage.module.css';

const PostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const { post, isLoading, fetchPost } = usePost(postId);
  const navigate = useNavigate();

  useEffect(() => {
    if (postId) fetchPost();
  }, [postId]);

  if (isLoading) return <PageLoader />;
  if (!post)     return <NotFound />;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <FeedPost
          item={postToFeedItem(post)}
          onDelete={() => navigate(-1)}
        />
      </div>
    </div>
  );
};

export default PostDetailPage;
