import { Application } from 'express';
import feedRouter from './feed.routes';

export function setupRoutes(app: Application): void {
  app.use('/api/v1/feed', feedRouter);
}
