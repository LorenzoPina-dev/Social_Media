import React from 'react';
import { usePostLikeCount, useLikePost, useUnlikePost } from '../lib/hooks/useLikes';
import CommentComposer from './CommentComposer';

export default function PostCard({ post }: { post: any }) {
  const postId = post.id;
  const likeQuery = usePostLikeCount(postId);
  const like = likeQuery.data?.data ?? { like_count: post.like_count ?? 0, is_liked: false };

  const likeMut = useLikePost(postId);
  const unlikeMut = useUnlikePost(postId);

  const handleToggleLike = () => {
    if (like?.is_liked) {
      unlikeMut.mutate();
    } else {
      likeMut.mutate();
    }
  };

  return (
    <article style={{ border: '1px solid #eee', padding: 12, borderRadius: 6, marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <strong>{post.user?.username ?? post.user_id}</strong>
        <div style={{ color: '#555' }}>{new Date(post.created_at).toLocaleString()}</div>
      </div>
      <p>{post.content}</p>
      {post.media_urls && post.media_urls.length > 0 && (
        <div>
          
          {post.media_urls.map((u: string) => (
            <img key={u} src={u} alt="media" style={{ maxWidth: '100%', marginTop: 6 }} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
        <button onClick={handleToggleLike} aria-pressed={like?.is_liked}>
          {like?.is_liked ? 'Unlike' : 'Like'} ({like?.like_count ?? 0})
        </button>
        <button>Comment ({post.comment_count ?? 0})</button>
        <button>Save</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <CommentComposer postId={postId} />
      </div>
    </article>
  );
}
