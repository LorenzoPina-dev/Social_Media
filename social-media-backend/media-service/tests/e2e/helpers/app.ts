/**
 * E2E App Helper — media-service
 *
 * Creates a real Express application instance with real database access.
 * Infrastructure mocked at the top level (Kafka, Redis) via jest.mock in testSetup.ts.
 *
 * The app singleton is shared across all tests in a file to avoid port conflicts.
 */

import { Application } from 'express';

let _app: Application | null = null;

export async function getTestApp(): Promise<Application> {
  if (_app) return _app;

  // Dynamic import — env vars must be set before this runs
  const { createApp } = await import('../../../src/app');
  _app = await createApp();
  return _app;
}

/** Reset singleton (useful if you need a fresh app instance) */
export function resetTestApp(): void {
  _app = null;
}
