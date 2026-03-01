import { forwardRef, useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { FeedItem } from '@/types/feed.types';
import { Avatar } from '@/components/common/Avatar/Avatar';
import { PostMenu } from '@/components/post/PostMenu';
import { CommentSection } from '@/components/interactions/CommentSection';
import { useAuth } from '@/hooks/useAuth';
import { likePost, unlikePost, sharePost, getLikes } from '@/api/interactions';
import { savePost, unsavePost } from '@/api/posts';
import { unwrapData } from '@/api/envelope';
import toast from 'react-hot-toast';
import styles from './FeedPost.module.css';

interface FeedPostProps {
  item: FeedItem;
  onDelete?: () => void;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return n.toString();
}

/** Estrae lo status code da un errore Axios */
function getStatus(err: unknown): number | null {
  if (err && typeof err === 'object' && 'response' in err) {
    const e = err as { response?: { status?: number } };
    return e.response?.status ?? null;
  }
  return null;
}

export const FeedPost = forwardRef<HTMLDivElement, FeedPostProps>(
  ({ item, onDelete }, ref) => {
    const { user, isAuthenticated } = useAuth();
    const post = item.post;

    // ── Like state ────────────────────────────────────────────────────────
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post?.likeCount ?? 0);
    const [likeLoading, setLikeLoading] = useState(false);
    const likedRef = useRef(liked);
    likedRef.current = liked;

    // ── Save state ────────────────────────────────────────────────────────
    const [saved, setSaved] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);

    // ── Share state ───────────────────────────────────────────────────────
    const [shareLoading, setShareLoading] = useState(false);

    // ── Comment state ─────────────────────────────────────────────────────
    const [showComments, setShowComments] = useState(false);
    const [commentCount, setCommentCount] = useState(post?.commentCount ?? 0);

    // ── Media ─────────────────────────────────────────────────────────────
    const [imgError, setImgError] = useState(false);

    const isOwner = user?.id === post?.userId;

    // ── Fetch initial like status from interaction-service ────────────────
    // GET /api/v1/posts/:postId/likes/count  →  { post_id, like_count, is_liked }
    useEffect(() => {
      if (!post?.id || !isAuthenticated) return;

      getLikes(post.id)
        .then((res) => {
          const data = unwrapData<{ post_id: string; like_count: number; is_liked: boolean }>(res.data);
          setLiked(data.is_liked ?? false);
          // Usa il contatore live dell'interaction-service se disponibile
          if (typeof data.like_count === 'number') {
            setLikeCount(data.like_count);
          }
        })
        .catch(() => {
          // non-critical: se fallisce, lo stato rimane false
        });
    }, [post?.id, isAuthenticated]);

    // ── Like ──────────────────────────────────────────────────────────────
    const handleLike = useCallback(async () => {
      if (!isAuthenticated) {
        toast.error('Devi essere loggato per mettere Mi piace');
        return;
      }
      if (!post || likeLoading) return;

      const wasLiked = likedRef.current;

      // Optimistic
      setLiked(!wasLiked);
      setLikeCount((c) => (wasLiked ? Math.max(0, c - 1) : c + 1));
      setLikeLoading(true);

      try {
        if (wasLiked) {
          await unlikePost(post.id);
        } else {
          await likePost(post.id);
        }
      } catch (err) {
        const status = getStatus(err);

        if (!wasLiked && status === 409) {
          // 409 = già messo like → sincronizza a true, non revertare
          setLiked(true);
          // il likeCount è già stato incrementato ottimisticamente, ok
        } else if (wasLiked && status === 404) {
          // 404 = like non trovato → sincronizza a false, non revertare
          setLiked(false);
        } else {
          // Errore reale: revert
          setLiked(wasLiked);
          setLikeCount((c) => (wasLiked ? c + 1 : Math.max(0, c - 1)));
          toast.error('Errore durante il Mi piace');
        }
      } finally {
        setLikeLoading(false);
      }
    }, [post, isAuthenticated, likeLoading]);

    // ── Save ──────────────────────────────────────────────────────────────
    const handleSave = useCallback(async () => {
      if (!isAuthenticated) {
        toast.error('Devi essere loggato per salvare');
        return;
      }
      if (!post || saveLoading) return;

      const wasSaved = saved;
      setSaved(!wasSaved);
      setSaveLoading(true);

      try {
        if (wasSaved) {
          await unsavePost(post.id);
          toast.success('Rimosso dai salvati');
        } else {
          await savePost(post.id);
          toast.success('Post salvato');
        }
      } catch (err) {
        const status = getStatus(err);
        // savePost usa ON CONFLICT IGNORE: non dovrebbe mai fallire
        // unsavePost elimina silenziosamente anche se non esiste
        // → se arriva un errore è reale, revert
        if (status !== 409 && status !== 404) {
          setSaved(wasSaved);
          toast.error('Errore durante il salvataggio');
        } else {
          // 409 su save = già salvato → sync a true
          // 404 su unsave = non trovato → sync a false
          setSaved(!wasSaved);
        }
      } finally {
        setSaveLoading(false);
      }
    }, [post, isAuthenticated, saved, saveLoading]);

    // ── Share ─────────────────────────────────────────────────────────────
    const handleShare = useCallback(async () => {
      if (!post) return;
      const url = `${window.location.origin}/p/${post.id}`;

      setShareLoading(true);
      try {
        if (navigator.share) {
          await navigator.share({ url });
        } else {
          await navigator.clipboard.writeText(url);
          toast.success('Link copiato negli appunti');
        }
        // Registra la condivisione sul backend — best-effort
        sharePost(post.id).catch(() => {});
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          toast.error('Errore durante la condivisione');
        }
      } finally {
        setShareLoading(false);
      }
    }, [post]);

    // ── Comment toggle ────────────────────────────────────────────────────
    const handleCommentClick = useCallback(() => {
      setShowComments((v) => !v);
    }, []);

    if (!post) return null;

    const author = post.author;
    const displayName = author?.displayName || author?.username || 'Utente';
    const username = author?.username || '';
    const avatarUrl = author?.avatarUrl ?? null;
    const verified = author?.verified ?? false;

    const publishedAt = post.publishedAt || post.createdAt;
    const timeAgo = publishedAt
      ? formatDistanceToNow(new Date(publishedAt), { addSuffix: true, locale: it })
      : '';

    const hasImage =
      !imgError &&
      !!post.imageUrl &&
      (post.imageType === 'image' || post.imageType?.startsWith('image'));

    const hasVideo =
      !!post.imageUrl &&
      (post.imageType === 'video' || post.imageType?.startsWith('video'));

    const hashtags = post.content.match(/#[\w\u0080-\uFFFF]+/g) ?? [];
    const contentWithoutTags = post.content.replace(/#[\w\u0080-\uFFFF]+/g, '').trim();

    return (
      <article className={styles.card} ref={ref}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <Link to={`/profile/${username || post.userId}`} className={styles.authorLink}>
            <Avatar
              src={avatarUrl}
              username={username}
              size="medium"
              className={styles.avatar}
            />
            <div className={styles.authorInfo}>
              <span className={styles.displayName}>
                {displayName}
                {verified && (
                  <span className={styles.verifiedBadge} title="Verificato">✓</span>
                )}
              </span>
              {username && (
                <span className={styles.username}>@{username}</span>
              )}
            </div>
          </Link>

          <div className={styles.headerRight}>
            <time className={styles.timestamp} dateTime={publishedAt}>
              {timeAgo}
            </time>
            {isOwner && (
              <PostMenu
                postId={post.id}
                onDelete={onDelete}
                onEdit={() => {}}
              />
            )}
          </div>
        </div>

        {/* ── Media ── */}
        {hasImage && (
          <div className={styles.mediaWrapper}>
            <img
              src={post.imageUrl!}
              alt={contentWithoutTags.slice(0, 80) || 'Post image'}
              className={styles.mediaImage}
              onError={() => setImgError(true)}
              loading="lazy"
            />
          </div>
        )}
        {hasVideo && !hasImage && (
          <div className={styles.mediaWrapper}>
            <video
              src={post.imageUrl!}
              className={styles.mediaImage}
              controls
              playsInline
              preload="metadata"
            />
          </div>
        )}

        {/* ── Actions bar ── */}
        <div className={styles.actions}>
          <div className={styles.actionsLeft}>
            {/* Like */}
            <button
              className={`${styles.actionBtn} ${liked ? styles.liked : ''}`}
              onClick={handleLike}
              disabled={likeLoading}
              aria-label={liked ? 'Tolgi Mi piace' : 'Mi piace'}
            >
              <svg
                viewBox="0 0 24 24"
                className={styles.actionIcon}
                fill={liked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </button>

            {/* Comment */}
            <button
              className={`${styles.actionBtn} ${showComments ? styles.activeComment : ''}`}
              onClick={handleCommentClick}
              aria-label="Commenta"
            >
              <svg
                viewBox="0 0 24 24"
                className={styles.actionIcon}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </button>

            {/* Share */}
            <button
              className={styles.actionBtn}
              onClick={handleShare}
              disabled={shareLoading}
              aria-label="Condividi"
            >
              <svg
                viewBox="0 0 24 24"
                className={styles.actionIcon}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </button>
          </div>

          {/* Save */}
          <button
            className={`${styles.actionBtn} ${saved ? styles.saved : ''}`}
            onClick={handleSave}
            disabled={saveLoading}
            aria-label={saved ? 'Rimuovi dai salvati' : 'Salva'}
          >
            <svg
              viewBox="0 0 24 24"
              className={styles.actionIcon}
              fill={saved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
        </div>

        {/* ── Like count ── */}
        {likeCount > 0 && (
          <div className={styles.likeCount}>
            <strong>{formatCount(likeCount)} Mi piace</strong>
          </div>
        )}

        {/* ── Content ── */}
        <div className={styles.content}>
          {contentWithoutTags && (
            <p className={styles.text}>
              <Link to={`/profile/${username || post.userId}`} className={styles.authorInline}>
                {displayName}
              </Link>{' '}
              {contentWithoutTags}
            </p>
          )}

          {hashtags.length > 0 && (
            <div className={styles.hashtags}>
              {hashtags.map((tag) => (
                <Link
                  key={tag}
                  to={`/explore?tag=${tag.slice(1)}`}
                  className={styles.hashtag}
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Comments count / link ── */}
        {commentCount > 0 && !showComments && (
          <button className={styles.commentsLink} onClick={handleCommentClick}>
            Vedi tutti i {commentCount.toLocaleString('it-IT')} commenti
          </button>
        )}

        {/* ── Share count ── */}
        {post.shareCount > 0 && (
          <div className={styles.shareCount}>
            {formatCount(post.shareCount)} condivisioni
          </div>
        )}

        {/* ── Inline comment section ── */}
        {showComments && (
          <div className={styles.commentsContainer}>
            <CommentSection
              postId={post.id}
              onClose={() => setShowComments(false)}
              onCommentAdded={() => setCommentCount((c) => c + 1)}
            />
          </div>
        )}
      </article>
    );
  }
);

FeedPost.displayName = 'FeedPost';
