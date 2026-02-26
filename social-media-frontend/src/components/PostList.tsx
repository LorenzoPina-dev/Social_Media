import React from 'react';
import PostCard from './PostCard';
import { useUserPosts } from '../lib/hooks/usePosts';

export default function PostList({ userId }: { userId: string }) {
  const { data, isLoading } = useUserPosts(userId);
  const items = data?.data?.items ?? [];

  if (isLoading) return <div>Loading posts...</div>;
  if (!items.length) return <div>No posts yet.</div>;

  return (
    <div>
      {items.map((p: any) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}
