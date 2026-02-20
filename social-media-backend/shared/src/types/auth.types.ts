/**
 * Shared Auth Types
 * JWT payload and claim types used by every service that verifies tokens.
 */

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  verified: boolean;
  mfa_enabled: boolean;
}

export interface DecodedToken extends TokenPayload {
  jti?: string;
  iat: number;
  exp: number;
  iss: string;
}

/**
 * Augment Express Request with the authenticated user.
 * Services importing this file get the `req.user` typing automatically.
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
