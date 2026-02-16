/**
 * Passport Configuration
 * OAuth2 strategies setup
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './index';
import { logger } from '../utils/logger';

/**
 * Setup Passport strategies
 */
export function setupPassport(): void {
  // Google OAuth2 Strategy
  if (config.OAUTH2.GOOGLE.CLIENT_ID && config.OAUTH2.GOOGLE.CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.OAUTH2.GOOGLE.CLIENT_ID,
          clientSecret: config.OAUTH2.GOOGLE.CLIENT_SECRET,
          callbackURL: config.OAUTH2.GOOGLE.CALLBACK_URL,
          scope: ['profile', 'email'],
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            logger.info('Google OAuth callback', { profileId: profile.id });

            // Extract user data from Google profile
            const userData = {
              oauthProvider: 'google',
              oauthProviderId: profile.id,
              email: profile.emails?.[0]?.value,
              username: profile.displayName?.toLowerCase().replace(/\s+/g, '_'),
              display_name: profile.displayName,
              avatar_url: profile.photos?.[0]?.value,
              verified: profile.emails?.[0]?.verified || false,
            };

            // This will be handled in the controller
            done(null, userData);
          } catch (error) {
            logger.error('Google OAuth error', { error });
            done(error as Error);
          }
        }
      )
    );

    logger.info('✅ Google OAuth strategy configured');
  }

  // TODO: Add Apple Sign In strategy
  // TODO: Add GitHub OAuth strategy
  // TODO: Add Facebook OAuth strategy
}

export default passport;
