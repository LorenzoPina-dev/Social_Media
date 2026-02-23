/**
 * Kafka Consumer — moderation_events
 *
 * Gestisce: content_rejected → notifica il proprietario del contenuto rimosso
 *           content_approved → notifica approvazione (se precedentemente segnalato)
 *
 * NOTA: processMessage() è chiamato dal dispatcher centrale in app.ts.
 */

import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import { ContentRejectedEvent, ContentApprovedEvent, KafkaBaseEvent } from '../../types';

export class ModerationConsumer {
  constructor(private readonly notificationService: NotificationService) {}

  async processMessage(event: unknown): Promise<void> {
    const e = event as KafkaBaseEvent;
    try {
      await this.handle(e);
    } catch (err) {
      logger.error('ModerationConsumer: failed to process message', { type: e.type, err });
    }
  }

  private async handle(event: KafkaBaseEvent): Promise<void> {
    switch (event.type) {
      case 'content_rejected':
        await this.handleContentRejected(event as ContentRejectedEvent);
        break;
      case 'content_approved':
        await this.handleContentApproved(event as ContentApprovedEvent);
        break;
      case 'content_flagged':
        // Solo logging — non genera notifica all'utente per flagging automatico
        logger.debug('Content flagged by moderation system', { entityId: event.entityId });
        break;
      default:
    }
  }

  private async handleContentRejected(event: ContentRejectedEvent): Promise<void> {
    const ownerId = event.payload?.ownerId || event.userId;
    if (!ownerId) {
      logger.warn('content_rejected: missing ownerId/userId', { event });
      return;
    }

    await this.notificationService.notify({
      recipientId: ownerId,
      type: 'SYSTEM',
      entityId: event.entityId,
      entityType: (event.payload?.entityType as 'POST' | 'COMMENT') || 'POST',
      title: 'Contenuto rimosso',
      body: `Il tuo contenuto è stato rimosso per violazione delle linee guida. Motivo: ${event.payload?.reason || 'non specificato'}`,
    });

    logger.info('ContentRejected notification sent', { ownerId, entityId: event.entityId });
  }

  private async handleContentApproved(event: ContentApprovedEvent): Promise<void> {
    const ownerId = event.payload?.ownerId || event.userId;
    if (!ownerId) return;

    await this.notificationService.notify({
      recipientId: ownerId,
      type: 'SYSTEM',
      entityId: event.entityId,
      entityType: (event.payload?.entityType as 'POST' | 'COMMENT') || 'POST',
      title: 'Contenuto approvato',
      body: 'Il tuo contenuto è stato revisionato e approvato.',
    });

    logger.debug('ContentApproved notification sent', { ownerId, entityId: event.entityId });
  }
}
