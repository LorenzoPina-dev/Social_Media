/**
 * Post Event Consumer — media-service
 *
 * Consumes post_events:
 *  - post_deleted → soft-delete all media files associated with that post
 *    (relies on media_urls stored in the post payload)
 *
 * Registered handlers are injected into the shared Kafka config dispatcher.
 */

import { MediaFileModel } from '../../models/media.model';
import { StorageService } from '../../services/storage.service';
import { registerKafkaHandler } from '../../config/kafka';
import { logger } from '../../utils/logger';

export class PostEventConsumer {
  constructor(
    private readonly mediaModel: MediaFileModel,
    private readonly storageService: StorageService
  ) {}

  register(): void {
    registerKafkaHandler('post_deleted', this.handlePostDeleted.bind(this));
    logger.info('PostEventConsumer handlers registered');
  }

  /**
   * When a post is deleted, soft-delete any media files that were attached to it.
   *
   * NOTE: The post_events.post_deleted payload does not currently include
   * media_urls — this is an architectural gap. Ideally post-service sends
   * the list of storage keys or media IDs so we can clean up here.
   *
   * As a pragmatic solution we log the event and skip cleanup.
   * A production implementation would either:
   *  (a) store post_id on media_files and query by it, or
   *  (b) have post-service include media identifiers in the event payload.
   */
  async handlePostDeleted(event: {
    type: 'post_deleted';
    entityId: string;   // postId
    userId: string;
    timestamp: string;
    payload?: { media_urls?: string[]; media_storage_keys?: string[] };
  }): Promise<void> {
    const { entityId: postId, userId, payload } = event;
    logger.info('Handling post_deleted event', { postId, userId });

    const storageKeys = payload?.media_storage_keys ?? [];

    if (storageKeys.length === 0) {
      logger.info('No media storage keys in post_deleted event — skipping cleanup', { postId });
      return;
    }

    // Soft-delete all matching media files
    await this.mediaModel.softDeleteByStorageKeys(storageKeys);

    // Best-effort storage deletion
    for (const key of storageKeys) {
      try {
        await this.storageService.deleteObject(key);
      } catch (err) {
        logger.error('Failed to delete storage object for deleted post', { error: err, key, postId });
      }
    }

    logger.info('Media cleaned up for deleted post', { postId, count: storageKeys.length });
  }
}
