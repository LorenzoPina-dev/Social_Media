/**
 * Kafka Consumer — post_events
 *
 * Gestisce: post_created (notifica follower se configurato)
 * Nota: il fan-out dei follower richiede che il payload contenga la lista
 * oppure che venga effettuata una chiamata a user-service.
 * Per ora il consumer salva un log; l'integrazione con user-service
 * andrà aggiunta nella Fase 6 completa.
 */

import { getKafkaConsumer } from '../../config/kafka';
import { NotificationService } from '../../services/notification.service';
import { logger } from '../../utils/logger';
import { PostCreatedEvent, KafkaBaseEvent } from '../../types';

export class PostEventConsumer {
  private started = false;
  // notificationService sarà usato nella Fase 6 per il fan-out ai follower
  private readonly notificationService: NotificationService;

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  async start(): Promise<void> {
    if (this.started) return;
    try {
      const consumer = getKafkaConsumer();
      await consumer.subscribe({ topics: ['post_events'], fromBeginning: false });
      this.started = true;
      logger.info('PostEventConsumer subscribed to post_events');

      await consumer.run({
        eachMessage: async ({ message }) => {
          const raw = message.value?.toString();
          if (!raw) return;
          try {
            const event = JSON.parse(raw) as KafkaBaseEvent;
            await this.handle(event);
          } catch (err) {
            logger.error('PostEventConsumer: failed to process message', { err });
          }
        },
      });
    } catch (err) {
      logger.warn('PostEventConsumer: could not subscribe', { err });
    }
  }

  private async handle(event: KafkaBaseEvent): Promise<void> {
    if (event.type === 'post_created') {
      await this.handlePostCreated(event as PostCreatedEvent);
    }
    // post_deleted / post_updated: nessuna notifica necessaria qui
  }

  /**
   * Notifica ai follower quando un utente pubblica un post.
   * In produzione: recuperare la lista follower da user-service via HTTP
   * o via un payload enriched incluso nell'evento.
   */
  private async handlePostCreated(event: PostCreatedEvent): Promise<void> {
    logger.info('PostCreated received by notification-service', {
      postId: event.entityId,
      userId: event.userId,
      visibility: event.payload?.visibility,
    });

    // Solo post pubblici generano notifiche ai follower
    if (event.payload?.visibility !== 'PUBLIC') return;

    // TODO Fase 6: chiamata HTTP a user-service /users/{userId}/followers
    // e invio notifica a ciascun follower che ha la preferenza abilitata.
    // notificationService.notify() sarà chiamato qui con i dati di ogni follower.
    logger.debug('PostCreated: follower notification fan-out placeholder', {
      postId: event.entityId,
    });
  }
}
