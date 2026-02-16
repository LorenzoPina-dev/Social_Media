/**
 * Express Type Extensions
 * Extends Express Request with custom properties
 */

import { User } from './index';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        email: string;
        verified: boolean;
        mfa_enabled: boolean;
      };
    }
  }
}

export {};
