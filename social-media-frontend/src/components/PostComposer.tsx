import React, { useState } from 'react';
import { useCreatePost } from '../lib/hooks/usePosts';

export default function PostComposer() {
  const [content, setContent] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC'|'FOLLOWERS'|'PRIVATE'>('PUBLIC');
  const mutation = useCreatePost();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    try {
      await mutation.mutateAsync({ content, visibility });
      setContent('');
    } catch (err) {
      // error handled elsewhere (toasts)
      console.error(err);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ border: '1px solid #ddd', padding: 12, borderRadius: 6 }}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's happening?"
        rows={4}
        style={{ width: '100%', resize: 'vertical' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <select value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
          <option value="PUBLIC">Public</option>
          <option value="FOLLOWERS">Followers</option>
          <option value="PRIVATE">Private</option>
        </select>
        <button type="submit" disabled={mutation.isLoading || !content.trim()}>
          {mutation.isLoading ? 'Posting...' : 'Post'}
        </button>
      </div>
    </form>
  );
}
