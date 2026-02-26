import React from 'react';
import { renderHook, act } from '@testing-library/react';

// Ensure jsdom-like APIs exist
beforeAll(() => {
  // matchMedia mock
  if (!('matchMedia' in window)) {
    // @ts-ignore
    window.matchMedia = (query: string) => {
      let matches = false;
      const listeners = new Set<(e: MediaQueryListEvent) => void>();
      return {
        media: query,
        matches,
        onchange: null,
        addEventListener: (_: 'change', cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
        removeEventListener: (_: 'change', cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
        dispatch: (next: boolean) => {
          matches = next;
          listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
        },
      } as any;
    };
  }

  // IntersectionObserver mock
  // @ts-ignore
  global.IntersectionObserver = class IO {
    private _cb: IntersectionObserverCallback;
    constructor(cb: IntersectionObserverCallback) {
      this._cb = cb;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    // helper to trigger
    __trigger(entries: Partial<IntersectionObserverEntry>[]) {
      // @ts-ignore
      this._cb(entries as IntersectionObserverEntry[], this as any);
    }
  } as any;

  // localStorage mock
  const store: Record<string, string> = {};
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (k: string) => (k in store ? store[k] : null),
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    },
    configurable: true,
  });
});

// Virtual mocks for aliased modules used by hooks
jest.mock('@/api/envelope', () => ({
  unwrapData: (d: any) => d,
  unwrapItems: (d: any) => d.items ?? [],
  unwrapCursorPage: (d: any) => ({ items: d.items ?? [], cursor: d.cursor ?? null, has_more: !!d.cursor }),
}), { virtual: true });

// Minimal toast mock
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Context hooks passthrough mocks
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'u1' }, updateUser: jest.fn() }),
}), { virtual: true });

jest.mock('@/contexts/NotificationContext', () => ({
  useNotifications: () => ({ notifications: [], markAsRead: jest.fn() }),
}), { virtual: true });

jest.mock('@/contexts/SocketContext', () => ({
  useSocket: () => ({ socket: { on: jest.fn(), emit: jest.fn() }, isConnected: true }),
}), { virtual: true });

// Router navigate mock used by useProfile
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

// API mocks (virtual to avoid resolving aliases)
jest.mock('@/api/interactions', () => ({
  getComments: jest.fn(),
  createComment: jest.fn(),
  deleteComment: jest.fn(),
  likeComment: jest.fn(),
  unlikeComment: jest.fn(),
  getCommentThread: jest.fn(),
}), { virtual: true });

jest.mock('@/api/feed', () => ({
  getFeed: jest.fn(),
}), { virtual: true });

jest.mock('@/api/posts', () => ({
  getPost: jest.fn(),
  createPost: jest.fn(),
  updatePost: jest.fn(),
  deletePost: jest.fn(),
  savePost: jest.fn(),
  unsavePost: jest.fn(),
  getUserPosts: jest.fn(),
}), { virtual: true });

jest.mock('@/api/users', () => ({
  getUserProfile: jest.fn(),
  updateProfile: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
  getUsersBatch: jest.fn(),
  searchUsers: jest.fn(),
}), { virtual: true });

jest.mock('@/api/search', () => ({
  searchUsers: jest.fn(),
  searchPosts: jest.fn(),
  getAutocompleteSuggestions: jest.fn(),
  normalizeSuggestionItems: (d: any) => Array.isArray(d?.items) ? d.items : [],
}), { virtual: true });

// Import hooks under test
import { useDebounce } from '../useDebounce';
import { useInfiniteScroll } from '../useInfiniteScroll';
import { useLocalStorage } from '../useLocalStorage';
import { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from '../useMediaQuery';
import { useAuth } from '../useAuth';
import { useNotifications } from '../useNotifications';
import { useSocket } from '../useSocket';
import { useFeed } from '../useFeed';
import { usePost } from '../usePost';
import { useProfile } from '../useProfile';
import { useSearch } from '../useSearch';

// Grab mocked APIs
import * as interactionsApi from '@/api/interactions';
import * as feedApi from '@/api/feed';
import * as postsApi from '@/api/posts';
import * as usersApi from '@/api/users';
import * as searchApi from '@/api/search';
import * as envelope from '@/api/envelope';
import toast from 'react-hot-toast';

// Helpers
const makePost = (overrides: any = {}) => ({ id: overrides.id ?? 'p1', content: 'x', is_saved: false, ...overrides });
const makeComment = (overrides: any = {}) => ({ id: overrides.id ?? 'c1', content: 'c', is_liked: false, like_count: 0, replies: [], ...overrides });
const makeProfile = (overrides: any = {}) => ({ id: overrides.id ?? 'u1', username: 'john', follower_count: 0, is_following: false, ...overrides });

// --------------------
// useDebounce
// --------------------
describe('useDebounce', () => {
  jest.useFakeTimers();

  test('debounces value updates by delay', () => {
    const { result, rerender } = renderHook(({ v, d }) => useDebounce(v, d), {
      initialProps: { v: 'a', d: 300 },
    });

    expect(result.current).toBe('a');

    rerender({ v: 'b', d: 300 });
    expect(result.current).toBe('a'); // still old until timer flushes

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current).toBe('b');
  });
});

// --------------------
// useLocalStorage
// --------------------
describe('useLocalStorage', () => {
  test('reads initial value from localStorage and writes updates', () => {
    window.localStorage.setItem('k', JSON.stringify('seed'));
    const { result } = renderHook(() => useLocalStorage<string>('k', 'fallback'));

    expect(result.current[0]).toBe('seed');

    act(() => {
      result.current[1]('next');
    });

    expect(JSON.parse(window.localStorage.getItem('k') as string)).toBe('next');
  });
});

// --------------------
// useMediaQuery (+ helpers)
// --------------------
describe('useMediaQuery', () => {
  test('returns current match and updates on change', () => {
    const mm = window.matchMedia('(max-width: 768px)') as any;
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));

    expect(result.current).toBe(false);
    act(() => {
      mm.dispatch(true);
    });
    expect(result.current).toBe(true);
  });

  test('predefined hooks map to media queries', () => {
    const mob = window.matchMedia('(max-width: 768px)') as any;
    const tab = window.matchMedia('(min-width: 769px) and (max-width: 1024px)') as any;
    const desk = window.matchMedia('(min-width: 1025px)') as any;

    const r1 = renderHook(() => useIsMobile());
    const r2 = renderHook(() => useIsTablet());
    const r3 = renderHook(() => useIsDesktop());

    expect(r1.result.current).toBe(false);
    expect(r2.result.current).toBe(false);
    expect(r3.result.current).toBe(false);

    act(() => mob.dispatch(true));
    expect(r1.result.current).toBe(true);

    act(() => {
      mob.dispatch(false);
      tab.dispatch(true);
    });
    expect(r2.result.current).toBe(true);

    act(() => {
      tab.dispatch(false);
      desk.dispatch(true);
    });
    expect(r3.result.current).toBe(true);
  });
});

// --------------------
// useInfiniteScroll
// --------------------
describe('useInfiniteScroll', () => {
  test('calls loadMore when intersecting and hasMore', async () => {
    const loadMore = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useInfiniteScroll(loadMore, true));

    // Attach a dummy element to observe
    const el = document.createElement('div');
    result.current.lastElementRef.current = el as any;

    // Trigger intersection
    const io = new (global as any).IntersectionObserver(() => {});
    io.__trigger([{ isIntersecting: true }]);

    expect(loadMore).toHaveBeenCalled();
  });
});

// --------------------
// Context passthrough hooks
// --------------------
describe('context passthrough hooks', () => {
  test('useAuth returns context values', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual({ id: 'u1' });
  });

  test('useNotifications returns context values', () => {
    const { result } = renderHook(() => useNotifications());
    expect(Array.isArray(result.current.notifications)).toBe(true);
  });

  test('useSocket returns context values', () => {
    const { result } = renderHook(() => useSocket());
    expect(result.current.isConnected).toBe(true);
  });
});

// --------------------
// useFeed
// --------------------
describe('useFeed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('loads posts and paginates with cursor', async () => {
    (feedApi.getFeed as jest.Mock).mockResolvedValueOnce({ data: { items: [makePost({ id: 'p1' })], cursor: 'c2' } });
    (feedApi.getFeed as jest.Mock).mockResolvedValueOnce({ data: { items: [makePost({ id: 'p2' })], cursor: null } });

    const { result } = renderHook(() => useFeed());

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.posts.map(p => p.id)).toEqual(['p1']);
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.posts.map(p => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.hasMore).toBe(false);
  });

  test('update/remove/add post mutates list', async () => {
    const { result } = renderHook(() => useFeed());

    act(() => {
      result.current.addPost(makePost({ id: 'x' }));
    });
    expect(result.current.posts[0].id).toBe('x');

    act(() => {
      result.current.updatePost('x', { content: 'changed' });
    });
    expect(result.current.posts[0].content).toBe('changed');

    act(() => {
      result.current.removePost('x');
    });
    expect(result.current.posts.find(p => p.id === 'x')).toBeUndefined();
  });
});

// --------------------
// usePost
// --------------------
describe('usePost', () => {
  beforeEach(() => jest.clearAllMocks());

  test('fetchPost loads a post by id', async () => {
    (postsApi.getPost as jest.Mock).mockResolvedValue({ data: makePost({ id: 'p1' }) });
    const { result } = renderHook(() => usePost('p1'));

    await act(async () => {
      await result.current.fetchPost();
    });

    expect(result.current.post?.id).toBe('p1');
  });

  test('create and update set post and show toast', async () => {
    (postsApi.createPost as jest.Mock).mockResolvedValue({ data: makePost({ id: 'n1' }) });
    (postsApi.updatePost as jest.Mock).mockResolvedValue({ data: makePost({ id: 'u1' }) });

    const { result } = renderHook(() => usePost());

    await act(async () => {
      const created = await result.current.create({});
      expect(created.id).toBe('n1');
    });
    expect((toast as any).success).toHaveBeenCalled();

    await act(async () => {
      const updated = await result.current.update('u1', {});
      expect(updated.id).toBe('u1');
    });
  });

  test('toggleSave toggles saved state', async () => {
    (postsApi.savePost as jest.Mock).mockResolvedValue({});
    (postsApi.unsavePost as jest.Mock).mockResolvedValue({});

    const { result } = renderHook(() => usePost());

    act(() => {
      // seed
      (result as any).current.setPost?.(makePost({ id: 'p1', is_saved: false }));
    });

    await act(async () => {
      await result.current.toggleSave('p1');
    });
    expect(result.current.post?.is_saved).toBe(true);

    await act(async () => {
      await result.current.toggleSave('p1');
    });
    expect(result.current.post?.is_saved).toBe(false);
  });
});

// --------------------
// useProfile
// --------------------
describe('useProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  test('fetchProfile and posts pagination work', async () => {
    (usersApi.getUserProfile as jest.Mock).mockResolvedValue({ data: makeProfile({ id: 'u2', username: 'alice' }) });
    (postsApi.getUserPosts as jest.Mock)
      .mockResolvedValueOnce({ data: { items: [makePost({ id: 'p1' })], cursor: 'c2' } })
      .mockResolvedValueOnce({ data: { items: [makePost({ id: 'p2' })], cursor: null } });

    const { result } = renderHook(() => useProfile('u2'));

    // initial effects fire
    await act(async () => {});

    expect(result.current.profile?.username).toBe('alice');
    expect(result.current.posts.map(p => p.id)).toEqual(['p1']);

    await act(async () => {
      await result.current.fetchPosts();
    });

    expect(result.current.posts.map(p => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.hasMorePosts).toBe(false);
  });

  test('follow and unfollow update follower counts and flags', async () => {
    const profile = makeProfile({ id: 'u3', username: 'bob', follower_count: 1, is_following: false });

    (usersApi.getUserProfile as jest.Mock).mockResolvedValue({ data: profile });
    (postsApi.getUserPosts as jest.Mock).mockResolvedValueOnce({ data: { items: [], cursor: null } });

    const { result } = renderHook(() => useProfile('u3'));
    await act(async () => {});

    (usersApi.followUser as jest.Mock).mockResolvedValue({});
    await act(async () => {
      await result.current.follow();
    });
    expect(result.current.profile?.is_following).toBe(true);
    expect(result.current.profile?.follower_count).toBe(2);

    (usersApi.unfollowUser as jest.Mock).mockResolvedValue({});
    await act(async () => {
      await result.current.unfollow();
    });
    expect(result.current.profile?.is_following).toBe(false);
    expect(result.current.profile?.follower_count).toBe(1);
  });
});

// --------------------
// useSearch
// --------------------
describe('useSearch', () => {
  beforeEach(() => jest.clearAllMocks());

  test('search merges users and builds hashtags', async () => {
    const userA = makeProfile({ id: 'u10', follower_count: 5, is_following: false });
    const userB = makeProfile({ id: 'u20', follower_count: 7, is_following: true });

    // Indexed users returns empty -> fallback users used
    (searchApi.searchUsers as jest.Mock).mockResolvedValueOnce({ data: { items: [] } });
    (usersApi.searchUsers as jest.Mock).mockResolvedValueOnce({ data: { items: [userA, userB] } });

    // Hydration batch returns canonical counts
    ;(usersApi.getUsersBatch as jest.Mock).mockResolvedValue({ data: { items: [
      { ...userA, follower_count: 6 },
      { ...userB, follower_count: 8 },
    ] } });

    // Posts
    ;(searchApi.searchPosts as jest.Mock).mockResolvedValueOnce({ data: { items: [
      { id: 'p1', hashtags: ['#Hello', 'world'] },
      { id: 'p2', hashtags: ['hello', 'foo'] },
    ] } });

    // Hashtag suggestions
    ;(searchApi.getAutocompleteSuggestions as jest.Mock).mockResolvedValueOnce({ data: { items: [ { text: 'bar' } ] } });

    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.search('hel');
    });

    // Users present (hydrated)
    expect(result.current.users.map(u => u.id).sort()).toEqual(['u10', 'u20']);
    // Hashtags include normalized and suggestions, deduped by logic
    const tags = result.current.hashtags.map(h => h.tag);
    expect(tags).toEqual(expect.arrayContaining(['hello', 'world', 'bar']));
  });

  test('setUserFollowState updates counts consistently', async () => {
    const u = makeProfile({ id: 'x', follower_count: 0, is_following: false });

    (searchApi.searchUsers as jest.Mock).mockResolvedValueOnce({ data: { items: [u] } });
    (usersApi.searchUsers as jest.Mock).mockResolvedValueOnce({ data: { items: [u] } });
    (usersApi.getUsersBatch as jest.Mock).mockResolvedValue({ data: { items: [u] } });
    (searchApi.searchPosts as jest.Mock).mockResolvedValueOnce({ data: { items: [] } });
    (searchApi.getAutocompleteSuggestions as jest.Mock).mockResolvedValueOnce({ data: { items: [] } });

    const { result } = renderHook(() => useSearch());
    await act(async () => {
      await result.current.search('x');
    });

    act(() => {
      result.current.setUserFollowState('x', true);
    });
    expect(result.current.users[0].is_following).toBe(true);
    expect(result.current.users[0].follower_count).toBe(1);

    act(() => {
      result.current.setUserFollowState('x', false);
    });
    expect(result.current.users[0].is_following).toBe(false);
    expect(result.current.users[0].follower_count).toBe(0);
  });

  test('clear resets state', () => {
    const { result } = renderHook(() => useSearch());

    act(() => {
      // force some state
      (result as any).current.setUserFollowState?.('z', true);
      result.current.clear();
    });

    expect(result.current.users).toEqual([]);
    expect(result.current.posts).toEqual([]);
    expect(result.current.hashtags).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});

// --------------------
// useComments (basic smoke - more detailed tests in dedicated file)
// --------------------
describe('useComments (smoke)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('add root comment prepends and toasts', async () => {
    (interactionsApi.createComment as jest.Mock).mockResolvedValue({ data: makeComment({ id: 'nc' }) });
    const { result } = renderHook(() => require('../useComments').useComments('p1'));

    await act(async () => {
      await result.current.addComment('hi');
    });

    expect(result.current.comments[0].id).toBe('nc');
    expect((toast as any).success).toHaveBeenCalled();
  });

  test('toggleLike rollback on failure', async () => {
    (interactionsApi.likeComment as jest.Mock).mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => require('../useComments').useComments('p1'));

    act(() => {
      (result as any).current.setComments?.([makeComment({ id: 'c1', is_liked: false, like_count: 0 })]);
    });

    await act(async () => {
      await result.current.toggleLike('c1');
    });

    const c = result.current.comments.find((x: any) => x.id === 'c1');
    expect(c.is_liked).toBe(false);
    expect(c.like_count).toBe(0);
  });
});
