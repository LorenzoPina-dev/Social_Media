/**
 * JWT Service
 * Token generation and verification
 */

import jwt from 'jsonwebtoken';
import { config } from '../config';
import { TokenPayload, TokenPair, DecodedToken, UnauthorizedError } from '../types';
import { logger } from '../utils/logger';

export class JWTService {
  /**
   * Generate access and refresh token pair
   */
  async generateTokenPair(payload: TokenPayload): Promise<TokenPair> {
    const access_token = this.generateAccessToken(payload);
    const refresh_token = this.generateRefreshToken(payload);

    // Parse expiry time
    const expiresIn = this.parseExpiryTime(config.JWT.ACCESS_EXPIRY);

    return {
      access_token,
      refresh_token,
      expires_in: expiresIn,
    };
  }

  /**
   * Generate access token
   */
  private generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.JWT.ACCESS_SECRET, {
      expiresIn: config.JWT.ACCESS_EXPIRY,
      issuer: config.JWT.ISSUER,
      algorithm: 'HS256',
    });
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, config.JWT.REFRESH_SECRET, {
      expiresIn: config.JWT.REFRESH_EXPIRY,
      issuer: config.JWT.ISSUER,
      algorithm: 'HS256',
    });
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<DecodedToken> {
    try {
      const decoded = jwt.verify(token, config.JWT.ACCESS_SECRET, {
        issuer: config.JWT.ISSUER,
        algorithms: ['HS256'],
      }) as DecodedToken;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Access token expired');
        throw new UnauthorizedError('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid access token', { error: error.message });
        throw new UnauthorizedError('Invalid token');
      } else {
        logger.error('Token verification failed', { error });
        throw new UnauthorizedError('Token verification failed');
      }
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<DecodedToken> {
    try {
      const decoded = jwt.verify(token, config.JWT.REFRESH_SECRET, {
        issuer: config.JWT.ISSUER,
        algorithms: ['HS256'],
      }) as DecodedToken;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logger.debug('Refresh token expired');
        throw new UnauthorizedError('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        logger.warn('Invalid refresh token', { error: error.message });
        throw new UnauthorizedError('Invalid refresh token');
      } else {
        logger.error('Refresh token verification failed', { error });
        throw new UnauthorizedError('Token verification failed');
      }
    }
  }

  /**
   * Decode token without verification (for inspection)
   */
  decodeToken(token: string): DecodedToken | null {
    try {
      return jwt.decode(token) as DecodedToken;
    } catch (error) {
      logger.error('Token decode failed', { error });
      return null;
    }
  }

  /**
   * Parse expiry time string to seconds
   */
  private parseExpiryTime(expiryStr: string): number {
    const match = expiryStr.match(/^(\d+)([smhd])$/);
    if (!match) {
      logger.warn('Invalid expiry format, using default', { expiryStr });
      return 900; // 15 minutes default
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }
}
