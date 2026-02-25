import { createAuthMiddleware } from '@social-media/shared';

import config from '../config';

const accessSecret = (config as any).JWT?.ACCESS_SECRET ?? (config as any).JWT_ACCESS_SECRET ?? process.env.JWT_ACCESS_SECRET ?? (process.env.JWT_ACCESS_SECRET || 'dev-secret');
const { requireAuth, optionalAuth } = createAuthMiddleware(accessSecret);

export { requireAuth, optionalAuth };
export default requireAuth;
