/**
 * Kafka Consumer — user_events
 *
 * Gestisce: follow_created, user_deleted (GDPR)
 *
 * NOTA: processMessage() è chiamato dal dispatcher centrale in app.ts.
 */

import { NotificationService } from '../../services/notification.service';
import { websocketService } from '../../services/websocket.service';
import { fetchUserInfo } from '../../services/http.service';
import { logger } from '../../utils/logger';
import {
  FollowCreatedEvent,
  UserDeletedEvent,
  KafkaBaseEvent,
  MessageSentEvent,
} from '../../types';

export class UserEventConsumer {
  constructor(private readonly notificationService: NotificationService) {}

  async processMessage(event: unknown): Promise<void> {
    const e = event as KafkaBaseEvent;
    try {
      await this.handle(e);
    } catch (err) {
      logger.error('UserEventConsumer: failed to process message', { type: e.type, err });
    }
  }

  private async handle(event: KafkaBaseEvent): Promise<void> {
    switch (event.type) {
      case 'follow_created':
      case 'user_followed':
        await this.handleFollowCreated(event as FollowCreatedEvent);
        break;
      case 'message_sent':
        await this.handleMessageSent(event as MessageSentEvent);
        break;
      case 'user_deleted':
      case 'user_permanently_deleted':
        await this.handleUserDeleted(event as UserDeletedEvent);
        break;
      default:
        // Ignora user_updated, follow_deleted ecc.
    }
  }

  private async handleFollowCreated(event: FollowCreatedEvent): Promise<void> {
    const followingId = (event.payload?.followingId || (event as any).followingId) as
      | string
      | undefined;
    const followerId = event.userId; // chi ha premuto "segui"

    if (!followingId) return;
    if (followingId === followerId) return; // self-follow edge case

    // Recupera info dell'attore per personalizzare la notifica
    const actor = await fetchUserInfo(followerId);
    const actorName = actor?.display_name || actor?.username || 'Qualcuno';

    // ── 1. Notifica a chi viene seguito ─────────────────────────────────────
    // "Mario ha iniziato a seguirti"
    await this.notificationService.notify({
      recipientId: followingId,
      actorId: followerId,
      type: 'follow',
      entityId: followerId,
      entityType: 'USER',
      title: 'Nuovo follower',
      body: `${actorName} ha iniziato a seguirti`,
    });

    // ── 2. feed:refresh a chi ha appena seguito ──────────────────────────────
    // Il client del follower deve ricaricare il feed per includere i post
    // recenti del nuovo utente seguito, senza aspettare il prossimo polling.
    await websocketService.emitToUser(followerId, 'feed:refresh', {
      reason: 'new_follow',
      followedUserId: followingId,
      timestamp: event.timestamp,
    });

    // ── 3. stories:refresh a chi ha appena seguito ───────────────────────────
    // Se la home mostra le stories, le aggiorna per includere quelle del
    // nuovo utente seguito.
    await websocketService.emitToUser(followerId, 'stories:refresh', {
      reason: 'new_follow',
      followedUserId: followingId,
      timestamp: event.timestamp,
    });

    logger.debug('FollowCreated handled', { followingId, followerId });
  }

  private async handleMessageSent(event: MessageSentEvent): Promise<void> {
    const recipientId = event.payload?.recipientId;
    if (!recipientId) return;

    if (recipientId === event.userId) return;

    await this.notificationService.notify({
      recipientId,
      actorId: event.userId,
      type: 'system',
      entityId: event.payload.messageId || event.payload.conversationId,
      entityType: 'USER',
      title: 'Nuovo messaggio',
      body: 'Hai ricevuto un nuovo messaggio',
      data: {
        conversationId: event.payload.conversationId,
        messageId: event.payload.messageId,
        senderId: event.userId,
      },
    });
  }

  /**
   * GDPR: elimina tutti i dati di notifica dell'utente cancellato
   */
  private async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    const userId = event.userId || event.entityId;
    if (!userId) {
      logger.warn('user_deleted event missing userId');
      return;
    }

    await this.notificationService.deleteUserData(userId);
    logger.info('GDPR: notification data deleted for user', { userId });
  }
}
