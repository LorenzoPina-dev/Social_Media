/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/e2e'],
  testMatch: ['**/*.e2e.test.ts'],
  globalSetup: '<rootDir>/tests/e2e/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/e2e/setup/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/e2e/setup/testSetup.ts'],
  moduleNameMapper: {
    '^@social-media/shared$': '<rootDir>/../shared/src/index.ts',
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.e2e.json',
    },
  },
  // E2E tests hit real DB — allow more time
  testTimeout: 30000,
  // Run serially to avoid DB race conditions between test files
  maxWorkers: 1,
  collectCoverage: false,
  verbose: true,
};
