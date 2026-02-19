/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // ─── Base config ──────────────────────────────────────────────────────────
  // Nota: quando si usa `projects`, Jest usa la config di ogni singolo progetto.
  // Le chiavi root (preset, testEnvironment, ecc.) fungono da default per i
  // progetti che non le ridefiniscono.

  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],

  // ─── Coverage ─────────────────────────────────────────────────────────────
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',       // entry point — escluso
    '!src/config/*.ts',    // config — esclusa
    '!src/types/**',       // tipi puri — esclusi
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

  // ─── ts-jest ──────────────────────────────────────────────────────────────
  globals: {
    'ts-jest': {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
      },
    },
  },

  testTimeout: 15000,

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // ─── Projects ─────────────────────────────────────────────────────────────
  // BUG 8 FIX: rimosso il `setupFiles` a livello root che era ridondante
  // (ogni progetto lo dichiara già esplicitamente).
  // Usato setupFiles (non setupFilesAfterFramework — chiave inesistente).

  projects: [
    {
      displayName: 'unit',
      testMatch:   ['<rootDir>/tests/unit/**/*.test.ts'],
      // setupFiles gira PRIMA del framework Jest (es. per settare env vars)
      setupFiles:  ['<rootDir>/tests/setup.ts'],
      preset:      'ts-jest',
      testEnvironment: 'node',
      globals: {
        'ts-jest': { tsconfig: { strict: true, esModuleInterop: true } },
      },
    },
    {
      displayName: 'integration',
      testMatch:   ['<rootDir>/tests/integration/**/*.test.ts'],
      setupFiles:  ['<rootDir>/tests/setup.ts'],
      preset:      'ts-jest',
      testEnvironment: 'node',
      testTimeout: 30000,
      globals: {
        'ts-jest': { tsconfig: { strict: true, esModuleInterop: true } },
      },
    },
    {
      displayName: 'e2e',
      testMatch:   [
        '<rootDir>/tests/e2e/**/*.e2e.test.ts',
        '<rootDir>/tests/e2e/**/*.test.ts',
      ],
      setupFiles:  ['<rootDir>/tests/setup.ts'],
      preset:      'ts-jest',
      testEnvironment: 'node',
      testTimeout: 45000,
      globals: {
        'ts-jest': { tsconfig: { strict: true, esModuleInterop: true } },
      },
    },
  ],
};
