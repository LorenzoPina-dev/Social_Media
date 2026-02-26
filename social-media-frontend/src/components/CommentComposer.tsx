import React, { useState } from 'react';
import { useCreateComment } from '../lib/hooks/useComments';

export default function CommentComposer({ postId, parentId, onSuccess }: { postId: string; parentId?: string | null; onSuccess?: () => void }) {
  const [content, setContent] = useState('');
  const mutation = useCreateComment(postId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await mutation.mutateAsync({ content, parent_id: parentId ?? null });
      setContent('');
      onSuccess?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 8 }}>
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write a comment..."
        style={{ width: '100%', padding: 8 }}
      />
      <div style={{ textAlign: 'right', marginTop: 6 }}>
        <button type="submit" disabled={mutation.isLoading || !content.trim()}>
          {mutation.isLoading ? 'Sending...' : 'Comment'}
        </button>
      </div>
    </form>
  );
}
