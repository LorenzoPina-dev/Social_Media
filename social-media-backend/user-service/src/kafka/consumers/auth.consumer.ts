/**
 * Auth Consumer
 * Consumes authentication events from auth-service via Kafka topic "auth_events"
 */

import { UserService } from '../../services/user.service';
import { logger } from '../../utils/logger';

interface UserRegisteredEvent {
  type: 'user_registered';
  userId: string;
  username: string;
  email: string;
  display_name?: string;
  timestamp: string;
}

interface UserAuthenticatedEvent {
  type: 'user_authenticated';
  userId: string;
  timestamp: string;
}

interface PasswordChangedEvent {
  type: 'password_changed';
  userId: string;
  timestamp: string;
}

interface AccountLockedEvent {
  type: 'account_locked';
  userId: string;
  reason: string;
  timestamp: string;
}

type AuthEvent =
  | UserRegisteredEvent
  | UserAuthenticatedEvent
  | PasswordChangedEvent
  | AccountLockedEvent;

export class AuthConsumer {
  constructor(private userService: UserService) {}

  /**
   * Crea l'utente in user_db quando si registra su auth-service.
   * Usa lo stesso UUID — chiave di correlazione tra i due DB.
   * Idempotente: se l'utente esiste già (doppia consegna Kafka) non fa nulla.
   */
  private async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    try {
      // Idempotency check — Kafka può consegnare lo stesso messaggio più volte
      const existing = await this.userService.findById(event.userId);
      if (existing) {
        logger.info('User already exists in user_db — skipping duplicate event', {
          userId: event.userId,
        });
        return;
      }

      await this.userService.create({
        id: event.userId,                        // stesso UUID di auth_db
        username: event.username,
        email: event.email,
        display_name: event.display_name ?? '',  // può essere vuoto alla registrazione
      });

      logger.info('User synced to user_db from auth event', {
        userId: event.userId,
        username: event.username,
      });
    } catch (error) {
      logger.error('Failed to handle user_registered event', { error, event });
      throw error; // rilancia — Kafka riproverà il messaggio
    }
  }

  private async handleUserAuthenticated(event: UserAuthenticatedEvent): Promise<void> {
    // Nessuna azione necessaria per ora nel user-service
    logger.debug('User authenticated event received', { userId: event.userId });
  }

  private async handlePasswordChanged(event: PasswordChangedEvent): Promise<void> {
    try {
      // Invalida la cache dell'utente così il prossimo GET rilegge dal DB
      await this.userService.findById(event.userId); // warm cache invalidation
      logger.info('Password changed — user cache invalidated', { userId: event.userId });
    } catch (error) {
      logger.error('Failed to handle password_changed event', { error, event });
    }
  }

  private async handleAccountLocked(event: AccountLockedEvent): Promise<void> {
    logger.warn('Account locked event received', {
      userId: event.userId,
      reason: event.reason,
    });
  }

  /**
   * Entry point chiamato da kafka.ts per ogni messaggio su "auth_events"
   */
  async processMessage(rawMessage: Buffer | string): Promise<void> {
    let event: AuthEvent;

    try {
      event = JSON.parse(
        typeof rawMessage === 'string' ? rawMessage : rawMessage.toString()
      ) as AuthEvent;
    } catch {
      logger.error('Failed to parse auth event — invalid JSON', { rawMessage });
      return; // non rilanciare: messaggio corrotto, non ha senso riprovare
    }

    logger.debug('Processing auth event', { type: event.type, userId: event.userId });

    switch (event.type) {
      case 'user_registered':
        await this.handleUserRegistered(event);
        break;
      case 'user_authenticated':
        await this.handleUserAuthenticated(event);
        break;
      case 'password_changed':
        await this.handlePasswordChanged(event);
        break;
      case 'account_locked':
        await this.handleAccountLocked(event);
        break;
      default:
        logger.warn('Unknown auth event type — ignored', { event });
    }
  }
}

export default AuthConsumer;
