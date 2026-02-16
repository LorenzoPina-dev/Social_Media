/**
 * Route Setup
 * Main router configuration
 */

import { Application } from 'express';
import userRoutes from './user.routes';
import followerRoutes from './follower.routes';
import gdprRoutes from './gdpr.routes';

export function setupRoutes(app: Application): void {
  // API v1 routes
  const API_PREFIX = '/api/v1';

  // Mount routes
  app.use(`${API_PREFIX}/users`, userRoutes);
  app.use(`${API_PREFIX}/users`, followerRoutes);
  app.use(`${API_PREFIX}/users`, gdprRoutes);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `Route ${req.originalUrl} not found`,
    });
  });
}

export default setupRoutes;
