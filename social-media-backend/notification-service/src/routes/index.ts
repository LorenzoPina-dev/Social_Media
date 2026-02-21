import { Application } from 'express';
import { NotificationModel } from '../models/notification.model';
import { PreferencesModel } from '../models/preferences.model';
import { DeviceTokenModel } from '../models/deviceToken.model';
import { NotificationService } from '../services/notification.service';
import { PreferencesService } from '../services/preferences.service';
import { DeviceTokenService } from '../services/deviceToken.service';
import { NotificationController } from '../controllers/notification.controller';
import { PreferencesController } from '../controllers/preferences.controller';
import { DeviceTokenController } from '../controllers/deviceToken.controller';
import { setupNotificationRoutes } from './notification.routes';
import { setupPreferencesRoutes } from './preferences.routes';
import { setupDeviceTokenRoutes } from './deviceToken.routes';
import { logger } from '../utils/logger';

export function setupRoutes(app: Application): void {
  // Models
  const notificationModel = new NotificationModel();
  const preferencesModel = new PreferencesModel();
  const deviceTokenModel = new DeviceTokenModel();

  // Services
  const notificationService = new NotificationService(notificationModel, preferencesModel, deviceTokenModel);
  const preferencesService = new PreferencesService(preferencesModel);
  const deviceTokenService = new DeviceTokenService(deviceTokenModel);

  // Controllers
  const notificationController = new NotificationController(notificationService);
  const preferencesController = new PreferencesController(preferencesService);
  const deviceTokenController = new DeviceTokenController(deviceTokenService);

  // Routes
  app.use('/api/v1/notifications', setupNotificationRoutes(notificationController));
  app.use('/api/v1/notifications/preferences', setupPreferencesRoutes(preferencesController));
  app.use('/api/v1/notifications/devices', setupDeviceTokenRoutes(deviceTokenController));

  // Export service per i Kafka consumers
  (app as unknown as { notificationService: NotificationService }).notificationService = notificationService;

  app.use('*', (_, res) => {
    res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
  });

  logger.info('Routes configured successfully');
}

// Factory usato anche dai Kafka consumers
export function createNotificationService(): NotificationService {
  return new NotificationService(
    new NotificationModel(),
    new PreferencesModel(),
    new DeviceTokenModel(),
  );
}
