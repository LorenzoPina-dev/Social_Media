/**
 * Kafka Consumer — interaction_events
 *
 * Gestisce: like_created, comment_created, share_created
 *
 * NOTA: processMessage() è chiamato dal dispatcher centrale in app.ts.
 * Poiché il payload di interaction_events non include postAuthorId,
 * il consumer chiama post-service via HTTP per ottenere il proprietario
 * del contenuto e inviargli la notifica corretta.
 */

import { NotificationService } from '../../services/notification.service';
import { fetchPostInfo } from '../../services/http.service';
import { logger } from '../../utils/logger';
import {
  LikeCreatedEvent,
  CommentCreatedEvent,
  ShareCreatedEvent,
  KafkaBaseEvent,
} from '../../types';

export class InteractionConsumer {
  constructor(private readonly notificationService: NotificationService) {}

  async processMessage(event: unknown): Promise<void> {
    const e = event as KafkaBaseEvent;
    try {
      await this.handle(e);
    } catch (err) {
      logger.error('InteractionConsumer: failed to process message', { type: e.type, err });
    }
  }

  private async handle(event: KafkaBaseEvent): Promise<void> {
    switch (event.type) {
      case 'like_created':
        await this.handleLikeCreated(event as LikeCreatedEvent);
        break;
      case 'comment_created':
        await this.handleCommentCreated(event as CommentCreatedEvent);
        break;
      case 'share_created':
        await this.handleShareCreated(event as ShareCreatedEvent);
        break;
      default:
        // Ignora like_deleted, comment_deleted (nessuna notifica per rimozioni)
    }
  }

  private async handleLikeCreated(event: LikeCreatedEvent): Promise<void> {
    const { targetType, targetId } = event.payload;
    if (targetType !== 'POST') {
      // Per like su commenti: notifica non implementata nel MVP
      return;
    }

    // Recupera l'autore del post da post-service
    const postInfo = await fetchPostInfo(targetId);
    if (!postInfo) return;

    const postAuthorId = postInfo.userId;
    if (postAuthorId === event.userId) return; // non notificare se si mette like al proprio post

    await this.notificationService.notify({
      recipientId: postAuthorId,
      actorId: event.userId,
      type: 'LIKE',
      entityId: event.entityId,
      entityType: 'POST',
      title: 'Nuovo like',
      body: 'Qualcuno ha messo like al tuo post',
    });

    logger.debug('LikeCreated notification handled', { postAuthorId, actorId: event.userId });
  }

  private async handleCommentCreated(event: CommentCreatedEvent): Promise<void> {
    const { postId, parentId } = event.payload;

    // Recupera autore del post
    const postInfo = await fetchPostInfo(postId);
    if (postInfo && postInfo.userId !== event.userId) {
      await this.notificationService.notify({
        recipientId: postInfo.userId,
        actorId: event.userId,
        type: 'COMMENT',
        entityId: postId,
        entityType: 'POST',
        title: 'Nuovo commento',
        body: 'Qualcuno ha commentato il tuo post',
      });
    }

    // Se è una reply, notifica anche l'autore del commento padre
    // (postId lo conosciamo dal payload; parentId è il commentId padre)
    if (parentId) {
      // Non abbiamo l'autore del commento padre senza chiamare interaction-service.
      // Per ora skippiamo questa notifica — può essere aggiunta con una chiamata HTTP
      // a interaction-service GET /comments/:id
      logger.debug('CommentCreated: reply notification skipped (no parentAuthorId available)', {
        commentId: event.entityId,
        parentId,
      });
    }

    logger.debug('CommentCreated notification handled', { postId });
  }

  private async handleShareCreated(event: ShareCreatedEvent): Promise<void> {
    const postId = event.entityId; // per share_created, entityId = postId

    const postInfo = await fetchPostInfo(postId);
    if (!postInfo) return;

    const postAuthorId = postInfo.userId;
    if (postAuthorId === event.userId) return;

    await this.notificationService.notify({
      recipientId: postAuthorId,
      actorId: event.userId,
      type: 'SHARE',
      entityId: postId,
      entityType: 'POST',
      title: 'Post condiviso',
      body: 'Qualcuno ha condiviso il tuo post',
    });

    logger.debug('ShareCreated notification handled', { postAuthorId });
  }
}
