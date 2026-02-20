/**
 * Express Type Extensions — Post Service
 */

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
