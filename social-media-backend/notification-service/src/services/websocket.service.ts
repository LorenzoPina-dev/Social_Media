/**
 * WebSocket Service — gestione connessioni real-time via Socket.io
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

interface AuthPayload {
  userId: string;
  username: string;
}

let io: SocketServer | null = null;

export class WebSocketService {
  /**
   * Inizializza Socket.io sul server HTTP
   */
  initialize(httpServer: HttpServer): SocketServer {
    io = new SocketServer(httpServer, {
      cors: {
        origin: config.CORS_ORIGINS,
        credentials: true,
      },
      path: '/notifications',
    });

    io.use(this.authMiddleware);

    io.on('connection', async (socket: Socket) => {
      const userId = (socket as unknown as { userId: string }).userId;
      logger.info('WebSocket client connected', { userId, socketId: socket.id });
      metrics.incGauge('ws_connections');

      // Salva sessione in Redis
      try {
        const redis = getRedisClient();
        await redis.setex(`ws:session:${userId}`, config.CACHE.WS_SESSION_TTL, socket.id);
      } catch (err) {
        logger.error('Failed to save WS session in Redis', { err });
      }

      socket.on('disconnect', async () => {
        logger.info('WebSocket client disconnected', { userId, socketId: socket.id });
        metrics.decGauge('ws_connections');
        try {
          const redis = getRedisClient();
          await redis.del(`ws:session:${userId}`);
        } catch (err) {
          logger.error('Failed to remove WS session from Redis', { err });
        }
      });

      // Client può confermare ricezione
      socket.on('notification:ack', (notificationId: string) => {
        logger.debug('Notification acknowledged', { userId, notificationId });
      });
    });

    logger.info('✅ WebSocket server initialized on /notifications');
    return io;
  }

  /**
   * Middleware di autenticazione JWT per Socket.io
   */
  private authMiddleware(socket: Socket, next: (err?: Error) => void): void {
    const token =
      (socket.handshake.auth.token as string | undefined) ||
      (socket.handshake.query.token as string | undefined);

    if (!token) {
      return next(new Error('Authentication error: no token'));
    }

    try {
      const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as AuthPayload;
      (socket as unknown as { userId: string }).userId = decoded.userId;
      next();
    } catch {
      next(new Error('Authentication error: invalid token'));
    }
  }

  /**
   * Emette un evento a un utente specifico (se connesso)
   */
  async emitToUser(userId: string, event: string, data: unknown): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const socketId = await redis.get(`ws:session:${userId}`);

      if (!socketId || !io) return false;

      io.to(socketId).emit(event, data);
      logger.debug('WebSocket event emitted', { userId, event });
      return true;
    } catch (error) {
      logger.error('Failed to emit WebSocket event', { userId, event, error });
      return false;
    }
  }

  /**
   * Controlla se un utente è connesso via WebSocket
   */
  async isUserOnline(userId: string): Promise<boolean> {
    try {
      const redis = getRedisClient();
      const sessionId = await redis.get(`ws:session:${userId}`);
      return !!sessionId;
    } catch {
      return false;
    }
  }

  getServer(): SocketServer | null {
    return io;
  }
}

export const websocketService = new WebSocketService();
