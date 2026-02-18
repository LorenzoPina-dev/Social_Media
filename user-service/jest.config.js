/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],

  // Pattern di test — include tutti i livelli
  testMatch: ['**/*.test.ts', '**/*.e2e.test.ts'],

  // setup sincrono delle env vars prima di qualsiasi modulo
  setupFiles: ['<rootDir>/tests/setup.ts'],

  // Coverage: solo src/, escludi entry point, config e tipi
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/config/*.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches:   70, // obiettivo: 80% — abbassato provvisoriamente per coverage incrementale
      functions:  80,
      lines:      80,
      statements: 80,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],

  // ts-jest config
  globals: {
    'ts-jest': {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
      },
    },
  },

  // Timeout generoso per test e2e/integration
  testTimeout: 15000,

  // Mapping path per velocità
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Separazione per tipo di test (usata dagli script npm)
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
      testTimeout: 15000,
    },
    {
      displayName: 'e2e',
      testMatch:   ['<rootDir>/tests/e2e/**/*.e2e.test.ts', '<rootDir>/tests/e2e/**/*.test.ts'],
      setupFiles:  ['<rootDir>/tests/setup.ts'],
      preset:      'ts-jest',
      testEnvironment: 'node',
      testTimeout: 30000,
    },
  ],
};
