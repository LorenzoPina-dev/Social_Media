import { Notification } from './notification.types';
import { Message } from './message.types';

export interface ServerToClientEvents {
  notification: (notification: Notification) => void;
  'notification:new': (notification: Notification) => void;
  'notification:read': (notificationId: string) => void;
  'message:new': (message: Message) => void;
  'message:read': (data: { conversationId: string; messageId: string }) => void;
  'typing:start': (data: { conversationId: string; userId: string }) => void;
  'typing:stop': (data: { conversationId: string; userId: string }) => void;
  'post:like': (data: { postId: string; userId: string; liked: boolean }) => void;
  'post:comment': (data: { postId: string; comment: Comment }) => void;
  'user:online': (userId: string) => void;
  'user:offline': (userId: string) => void;
  /** Emesso quando un utente che segui pubblica un nuovo post */
  'feed:new_post': (data: {
    postId: string;
    authorId: string;
    visibility: string;
    timestamp: string;
  }) => void;
  /** Emesso quando l'utente segue qualcuno: ricarica il feed */
  'feed:refresh': (data: {
    reason: 'new_follow' | string;
    followedUserId?: string;
    timestamp: string;
  }) => void;
  /** Emesso quando l'utente segue qualcuno: aggiorna il carosello stories */
  'stories:refresh': (data: {
    reason: 'new_follow' | string;
    followedUserId?: string;
    timestamp: string;
  }) => void;
}

export interface ClientToServerEvents {
  'notification:read': (notificationId: string) => void;
  'notification:readAll': () => void;
  'message:send': (data: { conversationId: string; content: string }) => void;
  'typing:start': (conversationId: string) => void;
  'typing:stop': (conversationId: string) => void;
  'message:read': (data: { conversationId: string; messageId: string }) => void;
}
