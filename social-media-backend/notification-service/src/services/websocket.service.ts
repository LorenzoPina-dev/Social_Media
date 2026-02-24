/**
 * WebSocket Service — gestione connessioni real-time via Socket.io
 */

import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { metrics } from '../utils/metrics';

interface AuthPayload {
  userId?: string;
  id?: string;
  sub?: string;
  username?: string;
}

let io: SocketServer | null = null;
const USER_ROOM_PREFIX = 'user:';

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
      const room = `${USER_ROOM_PREFIX}${userId}`;
      socket.join(room);
      logger.info('WebSocket client connected', { userId, socketId: socket.id });
      metrics.incGauge('ws_connections');

      socket.on('disconnect', async () => {
        logger.info('WebSocket client disconnected', { userId, socketId: socket.id });
        metrics.decGauge('ws_connections');
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
      const userId = decoded.userId || decoded.id || decoded.sub;
      if (!userId) {
        return next(new Error('Authentication error: invalid token payload'));
      }
      (socket as unknown as { userId: string }).userId = userId;
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
      if (!io) return false;
      const room = `${USER_ROOM_PREFIX}${userId}`;
      const sockets = await io.in(room).fetchSockets();
      if (sockets.length === 0) return false;
      io.to(room).emit(event, data);
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
      if (!io) return false;
      const room = `${USER_ROOM_PREFIX}${userId}`;
      const sockets = await io.in(room).fetchSockets();
      return sockets.length > 0;
    } catch {
      return false;
    }
  }

  getServer(): SocketServer | null {
    return io;
  }
}

export const websocketService = new WebSocketService();
