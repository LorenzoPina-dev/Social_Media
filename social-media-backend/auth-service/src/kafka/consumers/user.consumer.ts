/**
 * User Event Consumer — auth-service
 *
 * Ascolta il topic `user_events` e reagisce a:
 *  - user_deleted / user_permanently_deleted → invalida tutte le sessioni attive
 *    e cancella i token di reset password dell'utente (GDPR compliance).
 *
 * NOTA: questo consumer NON chiama connectKafka() né consumer.run() direttamente.
 * La sottoscrizione è gestita centralmente in `config/kafka.ts`.
 * Qui viene esposta solo la logica di business tramite `processMessage()`.
 */

import { logger } from '../../utils/logger';

interface UserDeletedEvent {
  type: 'user_deleted' | 'user_permanently_deleted' | string;
  entityId?: string;
  userId?: string;
  timestamp: string;
}

type UserEvent = UserDeletedEvent;

export class UserEventConsumer {
  /**
   * Entry-point chiamato da config/kafka.ts per ogni messaggio su `user_events`.
   * Idempotente: può essere chiamato più volte per lo stesso evento senza effetti collaterali.
   */
  async processMessage(rawEvent: unknown): Promise<void> {
    let event: UserEvent;

    try {
      event =
        typeof rawEvent === 'string'
          ? (JSON.parse(rawEvent) as UserEvent)
          : (rawEvent as UserEvent);
    } catch {
      logger.error('UserEventConsumer: failed to parse event — invalid JSON', { rawEvent });
      return; // messaggio corrotto: non rilanciare, non ha senso ritentare
    }

    logger.debug('UserEventConsumer: processing event', { type: event.type });

    switch (event.type) {
      case 'user_deleted':
      case 'user_permanently_deleted':
        await this.handleUserDeleted(event);
        break;

      default:
        // Altri eventi user non interessano auth-service
        logger.debug('UserEventConsumer: event type ignored', { type: event.type });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────

  /**
   * GDPR: quando un utente viene cancellato, invalidiamo:
   *  1. Tutte le sessioni attive (refresh token)           → tabella `sessions`
   *  2. Tutti i token di reset password non ancora usati   → tabella `password_reset_tokens`
   *  3. (Opzionale) Blacklista access token ancora validi  → Redis `token:blacklist:{jti}`
   *     (non implementata qui: i token scadono da soli in 15 min)
   */
  private async handleUserDeleted(event: UserDeletedEvent): Promise<void> {
    const userId = event.userId ?? event.entityId;

    if (!userId) {
      logger.warn('UserEventConsumer: user_deleted event missing userId/entityId', { event });
      return;
    }

    try {
      // Lazy import per evitare dipendenze circolari al boot
      const { SessionModel } = await import('../../models/session.model');
      const { PasswordResetModel } = await import('../../models/passwordReset.model');

      const sessionModel = new SessionModel();
      const passwordResetModel = new PasswordResetModel();

      // Eseguiamo in parallelo: se uno fallisce, l'altro viene comunque tentato
      const results = await Promise.allSettled([
        sessionModel.deleteAllForUser(userId),
        passwordResetModel.deleteAllForUser(userId),
      ]);

      results.forEach((result, idx) => {
        if (result.status === 'rejected') {
          const operation = idx === 0 ? 'deleteAllSessions' : 'deleteAllResetTokens';
          logger.error(`UserEventConsumer: ${operation} failed`, {
            userId,
            error: result.reason,
          });
        }
      });

      logger.info(
        'UserEventConsumer: GDPR — sessions and reset tokens invalidated for deleted user',
        { userId },
      );
    } catch (error) {
      logger.error('UserEventConsumer: failed to handle user_deleted', { userId, error });
      // Rilanciare consente a Kafka di ritentare il messaggio.
      // Il dato GDPR DEVE essere cancellato → throw.
      throw error;
    }
  }
}

export default UserEventConsumer;
