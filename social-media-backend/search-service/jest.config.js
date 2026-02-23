/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.e2e.test.ts'],

  // ENV vars impostati prima di qualsiasi import
  setupFiles: ['<rootDir>/tests/setup.ts'],

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/config/*.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches:   70,
      functions:  80,
      lines:      80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],

  globals: {
    'ts-jest': {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
        transpileOnly: true,
      },
    },
  },

  testTimeout: 15000,

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  projects: [
    {
      displayName: 'unit',
      testMatch:   ['<rootDir>/tests/unit/**/*.test.ts'],
      setupFiles:  ['<rootDir>/tests/setup.ts'],
      preset:      'ts-jest',
      testEnvironment: 'node',
    },
    {
      displayName: 'integration',
      testMatch:   ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFiles:  ['<rootDir>/tests/setup.ts'],
      preset:      'ts-jest',
      testEnvironment: 'node',
      testTimeout: 20000,
    },
    {
      displayName: 'e2e',
      testMatch:   ['<rootDir>/tests/e2e/**/*.test.ts', '<rootDir>/tests/e2e/**/*.e2e.test.ts'],
      setupFiles:  ['<rootDir>/tests/setup.ts'],
      preset:      'ts-jest',
      testEnvironment: 'node',
      testTimeout: 30000,
    },
  ],
};
