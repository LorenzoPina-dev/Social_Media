import React from 'react';
import { renderHook, act } from '@testing-library/react';
import toast from 'react-hot-toast';
import { useComments } from '../useComments';
import * as interactionsApi from '@/api/interactions';
import * as envelope from '@/api/envelope';

// Mock toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock useAuth to control authentication state
jest.mock('../useAuth', () => ({
  useAuth: jest.fn(() => ({ isAuthenticated: true })),
}));

// Helpers for envelope unwrapping
const unwrapDataSpy = jest.spyOn(envelope, 'unwrapData');
const unwrapItemsSpy = jest.spyOn(envelope, 'unwrapItems');

// Utility to create a comment object
const makeComment = (overrides: Partial<any> = {}) => ({
  id: overrides.id ?? Math.random().toString(36).slice(2),
  content: overrides.content ?? 'hello',
  is_liked: overrides.is_liked ?? false,
  like_count: overrides.like_count,
  likes_count: overrides.likes_count,
  reply_count: overrides.reply_count,
  replies_count: overrides.replies_count,
  replies: overrides.replies ?? [],
  user: { id: 'u1', username: 'john', avatar_url: null },
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('useComments', () => {
  const postId = 'post-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchComments paginates and sets hasMore based on cursor', async () => {
    const page1 = [makeComment({ id: 'c1' }), makeComment({ id: 'c2' })];
    const page2 = [makeComment({ id: 'c3' })];

    jest.spyOn(interactionsApi, 'getComments').mockResolvedValueOnce({ data: { items: page1, pagination: { cursor: 'next' } } } as any)
      .mockResolvedValueOnce({ data: { items: page2, pagination: { cursor: null } } } as any);

    unwrapItemsSpy.mockImplementation((d: any) => d.items);
    unwrapDataSpy.mockImplementation((d: any) => d);

    const { result } = renderHook(() => useComments(postId));

    await act(async () => {
      await result.current.fetchComments(true); // reset
    });

    expect(result.current.comments).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.fetchComments(); // next page
    });

    expect(result.current.comments.map(c => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(result.current.hasMore).toBe(false);
  });

  test('addComment adds root comment to the beginning and shows toast', async () => {
    const newComment = makeComment({ id: 'nc1' });

    jest.spyOn(interactionsApi, 'createComment').mockResolvedValue({ data: newComment } as any);
    unwrapDataSpy.mockImplementation((d: any) => d);

    const { result } = renderHook(() => useComments(postId));

    await act(async () => {
      const created = await result.current.addComment('content');
      expect(created).toEqual(newComment);
    });

    expect(result.current.comments[0]).toEqual(newComment);
    expect((toast as any).success).toHaveBeenCalled();
  });

  test('addComment as reply increments reply_count and replies_count', async () => {
    const parent = makeComment({ id: 'p1', reply_count: 0, replies_count: 0, replies: [] });
    const reply = makeComment({ id: 'r1' });

    jest.spyOn(interactionsApi, 'createComment').mockResolvedValue({ data: reply } as any);
    unwrapDataSpy.mockImplementation((d: any) => d);

    const { result } = renderHook(() => useComments(postId));

    // Seed parent comment
    await act(async () => {
      (result as any).current['setComments']?.((prev: any) => [parent, ...prev]);
    });

    await act(async () => {
      await result.current.addComment('reply here', 'p1');
    });

    const updatedParent = result.current.comments.find(c => c.id === 'p1')!;
    expect(updatedParent.replies).toHaveLength(1);
    expect(updatedParent.reply_count).toBe(1);
    expect(updatedParent.replies_count).toBe(1);
  });

  test('toggleLike performs optimistic update and rollback on failure', async () => {
    const c = makeComment({ id: 'c1', is_liked: false, like_count: 0 });

    jest.spyOn(interactionsApi, 'likeComment').mockRejectedValueOnce(new Error('fail'));

    const { result } = renderHook(() => useComments(postId));

    // Seed with one comment
    await act(async () => {
      (result as any).current['setComments']?.((prev: any) => [c, ...prev]);
    });

    await act(async () => {
      await result.current.toggleLike('c1');
    });

    const updated = result.current.comments.find(x => x.id === 'c1')!;
    // After rollback should be original state
    expect(updated.is_liked).toBe(false);
    expect(updated.like_count).toBe(0);
    expect((toast as any).error).toHaveBeenCalled();
  });

  test('loadReplies fills replies from thread API', async () => {
    const parent = makeComment({ id: 'p1', replies: [] });
    const replies = [makeComment({ id: 'r1' }), makeComment({ id: 'r2' })];

    jest.spyOn(interactionsApi, 'getCommentThread').mockResolvedValue({ data: { items: replies } } as any);
    unwrapItemsSpy.mockImplementation((d: any) => d.items);

    const { result } = renderHook(() => useComments(postId));

    await act(async () => {
      (result as any).current['setComments']?.(() => [parent]);
    });

    await act(async () => {
      await result.current.loadReplies('p1');
    });

    const updatedParent = result.current.comments.find(c => c.id === 'p1')!;
    expect(updatedParent.replies?.map(r => r.id)).toEqual(['r1', 'r2']);
  });

  test('addComment shows auth error when not authenticated', async () => {
    const { useAuth } = jest.requireMock('../useAuth');
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });

    const { result } = renderHook(() => useComments(postId));

    await act(async () => {
      await result.current.addComment('nope');
    });

    expect((toast as any).error).toHaveBeenCalled();
  });
});
