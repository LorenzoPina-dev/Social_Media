/**
 * IndexerService — indicizza/aggiorna/elimina documenti in Elasticsearch.
 * Chiamato dai Kafka consumers quando arrivano eventi user_events e post_events.
 */

import { ElasticsearchService } from './elasticsearch.service';
import { INDEX } from '../utils/setupElasticsearch';
import { TrendingService } from './trending.service';
import { logger } from '../utils/logger';
import {
  UserDocument,
  PostDocument,
  UserCreatedEvent,
  UserUpdatedEvent,
  PostCreatedEvent,
  PostUpdatedEvent,
} from '../types';

export class IndexerService {
  constructor(
    private readonly esService: ElasticsearchService,
    private readonly trendingService: TrendingService,
  ) {}

  // ── Users ────────────────────────────────────────────────────────────────

  async indexUser(event: UserCreatedEvent): Promise<void> {
    const doc: UserDocument = {
      id: event.entityId,
      username: event.payload.username,
      display_name: undefined,
      bio: undefined,
      avatar_url: undefined,
      verified: false,
      follower_count: 0,
      status: 'ACTIVE',
      created_at: event.timestamp,
    };

    await this.esService.indexDocument(INDEX.USERS, event.entityId, doc as unknown as Record<string, unknown>);
    logger.info('User indexed', { userId: event.entityId });
  }

  async updateUser(event: UserUpdatedEvent): Promise<void> {
    const { changedFields, ...rest } = event.payload;
    const fieldsToUpdate: Partial<UserDocument> = {};

    // Aggiorna solo i campi presenti nell'evento
    for (const field of changedFields) {
      if (field in rest) {
        (fieldsToUpdate as any)[field] = (rest as any)[field];
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) return;

    await this.esService.updateDocument(INDEX.USERS, event.entityId, fieldsToUpdate as Record<string, unknown>);
    logger.info('User updated in index', { userId: event.entityId, fields: changedFields });
  }

  async deleteUser(userId: string): Promise<void> {
    await this.esService.deleteDocument(INDEX.USERS, userId);
    logger.info('User deleted from index', { userId });
  }

  // ── Posts ────────────────────────────────────────────────────────────────

  async indexPost(event: PostCreatedEvent): Promise<void> {
    // Non indicizza post non-PUBLIC o con moderation_status REJECTED
    if (event.payload.visibility !== 'PUBLIC') return;
    if (event.payload.moderation_status === 'REJECTED') return;

    const doc: PostDocument = {
      id: event.entityId,
      user_id: event.payload.user_id,
      content: event.payload.content,
      hashtags: event.payload.hashtags,
      visibility: 'PUBLIC',
      like_count: event.payload.like_count,
      comment_count: event.payload.comment_count,
      moderation_status: event.payload.moderation_status as PostDocument['moderation_status'],
      created_at: event.timestamp,
    };

    await this.esService.indexDocument(INDEX.POSTS, event.entityId, doc as unknown as Record<string, unknown>);

    // Aggiorna hashtag in ES e trending in Redis
    if (event.payload.hashtags.length > 0) {
      await Promise.allSettled([
        this.indexHashtags(event.payload.hashtags),
        this.trendingService.incrementHashtags(event.payload.hashtags),
      ]);
    }

    logger.info('Post indexed', { postId: event.entityId });
  }

  async updatePost(event: PostUpdatedEvent): Promise<void> {
    const fieldsToUpdate: Partial<PostDocument> = {};

    if (event.payload.content !== undefined) fieldsToUpdate.content = event.payload.content;
    if (event.payload.hashtags !== undefined) fieldsToUpdate.hashtags = event.payload.hashtags;
    if (event.payload.moderation_status !== undefined) {
      fieldsToUpdate.moderation_status = event.payload.moderation_status as PostDocument['moderation_status'];
    }

    // Se il post viene rifiutato dalla moderazione, lo eliminiamo dall'indice
    if (event.payload.moderation_status === 'REJECTED') {
      await this.esService.deleteDocument(INDEX.POSTS, event.entityId);
      return;
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      await this.esService.updateDocument(INDEX.POSTS, event.entityId, fieldsToUpdate as Record<string, unknown>);
    }

    logger.info('Post updated in index', { postId: event.entityId });
  }

  async deletePost(postId: string): Promise<void> {
    await this.esService.deleteDocument(INDEX.POSTS, postId);
    logger.info('Post deleted from index', { postId });
  }

  // ── Hashtags ─────────────────────────────────────────────────────────────

  private async indexHashtags(tags: string[]): Promise<void> {
    await Promise.allSettled(
      tags.map((tag) =>
        this.esService.indexDocument(INDEX.HASHTAGS, tag, {
          tag,
          post_count: 1,
          suggest: { input: [tag], weight: 1 },
        }),
      ),
    );
  }
}
