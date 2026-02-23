/**
 * HTTP Client — notification-service
 *
 * Chiamate HTTP best-effort verso altri microservizi per recuperare
 * informazioni di contesto necessarie alle notifiche (es. autore del post).
 *
 * Le chiamate sono non-bloccanti: un errore produce solo un warning
 * nel log e la notifica viene saltata, senza crashare il consumer.
 */

import { logger } from '../utils/logger';

const POST_SERVICE_URL  = process.env.POST_SERVICE_URL  || 'http://post-service:3003';
const USER_SERVICE_URL  = process.env.USER_SERVICE_URL  || 'http://user-service:3002';

const TIMEOUT_MS = 5000;

// ─── Post Service ─────────────────────────────────────────────────────────────

export interface PostInfo {
  id: string;
  userId: string;   // autore del post
  visibility: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
}

/**
 * Recupera le info essenziali di un post da post-service.
 * Restituisce null se il post non esiste o la chiamata fallisce.
 */
export async function fetchPostInfo(postId: string): Promise<PostInfo | null> {
  const url = `${POST_SERVICE_URL}/api/v1/posts/${postId}`;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.warn('post-service returned non-OK for post info', { postId, status: res.status });
      return null;
    }

    const body = (await res.json()) as { data: { id: string; user_id: string; visibility: string } };
    return {
      id: body.data.id,
      userId: body.data.user_id,
      visibility: body.data.visibility as PostInfo['visibility'],
    };
  } catch (err) {
    logger.error('Failed to fetch post info from post-service', { postId, err });
    return null;
  }
}

// ─── User Service ─────────────────────────────────────────────────────────────

export interface UserInfo {
  id: string;
  username: string;
  display_name: string | null;
}

/**
 * Recupera informazioni base di un utente da user-service.
 * Usato per personalizzare i messaggi di notifica (es. "Mario ti ha seguito").
 */
export async function fetchUserInfo(userId: string): Promise<UserInfo | null> {
  const url = `${USER_SERVICE_URL}/api/v1/users/${userId}`;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      logger.warn('user-service returned non-OK for user info', { userId, status: res.status });
      return null;
    }

    const body = (await res.json()) as { data: { id: string; username: string; display_name: string | null } };
    return {
      id: body.data.id,
      username: body.data.username,
      display_name: body.data.display_name,
    };
  } catch (err) {
    logger.error('Failed to fetch user info from user-service', { userId, err });
    return null;
  }
}
