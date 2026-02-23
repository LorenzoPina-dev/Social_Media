import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PostCard } from '@/components/post/PostCard';
import { CommentSection } from '@/components/interactions/CommentSection';
import { usePost } from '@/hooks/usePost';
import { PageLoader } from '@/components/common/Loading/PageLoader';
import { NotFound } from '@/components/common/Error/NotFound';
import styles from './PostDetailPage.module.css';

const PostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const { post, isLoading, fetchPost } = usePost(postId);

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (!post) {
    return <NotFound />;
  }

  return (
    <div className={styles.postDetailPage}>
      <div className={styles.container}>
        <PostCard
          post={post}
          onLike={() => fetchPost()}
          onComment={() => {}}
          onShare={() => {}}
          onSave={() => fetchPost()}
        />
        
        <div className={styles.commentsSection}>
          <CommentSection postId={post.id} />
        </div>
      </div>
    </div>
  );
};

export default PostDetailPage