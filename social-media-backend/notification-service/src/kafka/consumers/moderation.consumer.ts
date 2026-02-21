/**
 * Kafka Consumer — moderation_events
 *
 * Gestisce: content_rejected, content_approved
 * Notifica il proprietario del contenuto con l'esito della moderazione.
 */

import { getKafkaConsumer } from '../../config/kafka';
import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import { ContentRejectedEvent, ContentApprovedEvent, KafkaBaseEvent } from '../../types';

export class ModerationConsumer {
  private started = false;

  constructor(private readonly notificationService: NotificationService) {}

  async start(): Promise<void> {
    if (this.started) return;
    try {
      const consumer = getKafkaConsumer();
      await consumer.subscribe({ topics: ['moderation_events'], fromBeginning: false });
      this.started = true;
      logger.info('ModerationConsumer subscribed to moderation_events');

      await consumer.run({
        eachMessage: async ({ message }) => {
          const raw = message.value?.toString();
          if (!raw) return;
          try {
            const event = JSON.parse(raw) as KafkaBaseEvent;
            await this.handle(event);
          } catch (err) {
            logger.error('ModerationConsumer: failed to process message', { err });
          }
        },
      });
    } catch (err) {
      logger.warn('ModerationConsumer: could not subscribe', { err });
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
      default:
    }
  }

  private async handleContentRejected(event: ContentRejectedEvent): Promise<void> {
    const ownerId = event.payload?.ownerId || event.userId;
    if (!ownerId) return;

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

    // Notifica di approvazione: opzionale, invia solo se era stato segnalato
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
