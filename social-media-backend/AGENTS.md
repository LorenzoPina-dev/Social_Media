# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Social media platform built as TypeScript/Node.js microservices. The project is an npm workspace monorepo. Two services are substantially implemented (auth-service, user-service); the remaining seven have scaffolded directory structures but minimal implementation. The project language is Italian in comments/docs, but code identifiers are in English.

## Build and Run Commands

### Infrastructure (required before running services)
```
docker-compose up -d                  # Start PostgreSQL, Redis, Kafka, Zookeeper, Elasticsearch, monitoring
docker-compose -f docker-compose.dev.yml up -d   # Lightweight dev stack (Postgres, Redis, Kafka only)
```

### Install Dependencies
```
npm install                           # Root workspace install (all services)
cd <service-name> && npm install      # Single service
```

### Run Services (dev mode with nodemon + ts-node)
```
npm run dev:auth                      # auth-service on port 3001
npm run dev:user                      # user-service on port 3002
```
Or via Makefile: `make dev-auth`, `make dev-user`

### Database Migrations (Knex)
```
cd <service-name> && npx knex migrate:latest --knexfile knexfile.ts
cd <service-name> && npx knex migrate:rollback --knexfile knexfile.ts
cd <service-name> && npx knex migrate:make <name> --knexfile knexfile.ts
```

### Build
```
npm run build --workspaces            # Build all services (tsc)
cd <service-name> && npm run build    # Build single service
```

### Test
```
cd <service-name> && npm test                    # All test projects (unit + integration + e2e)
cd <service-name> && npm run test:unit           # Unit tests only (no infra needed)
cd <service-name> && npm run test:integration    # Requires PostgreSQL + Redis running
cd <service-name> && npm run test:e2e            # Requires all services up
cd <service-name> && npm run test:coverage       # With coverage report
cd <service-name> && npm run test:watch          # Watch mode (unit only)
```
Run a single test file: `cd <service-name> && npx jest tests/unit/auth.service.test.ts`

Jest is configured with `--selectProjects` to separate unit, integration, and e2e suites. Tests live in `<service>/tests/` with subdirectories `unit/`, `integration/`, `e2e/`, `fixtures/`, and `__mocks__/`.

### Lint and Format
```
cd <service-name> && npm run lint
cd <service-name> && npm run lint:fix
cd <service-name> && npm run format
```

## Architecture

### Microservice Structure (Controller → Service → Model)
Each service follows the same layered pattern:
- **Controllers** (`src/controllers/`): Read request, call service, format response. Never access the database directly.
- **Services** (`src/services/`): Business logic, orchestration of models + Redis cache + Kafka producers. No Express types.
- **Models** (`src/models/`): Data access via Knex queries against PostgreSQL. No business logic.

Dependency injection is manual: models, services, and controllers are wired in `src/routes/index.ts` using constructor injection.

### Inter-Service Communication
- **Synchronous:** REST API calls between services (used sparingly, only when an immediate response is needed).
- **Asynchronous:** Kafka events via typed producers (`src/kafka/producers/`) and consumers (`src/kafka/consumers/`). Each service publishes to its own topic (e.g., `auth_events`, `user_events`, `post_events`) and consumes relevant topics from other services.
- Kafka failures are non-blocking — producers catch errors and log warnings without failing the HTTP request.

### Database Isolation
Each service has its own PostgreSQL database (e.g., `auth_db`, `user_db`, `post_db`). No cross-database joins. The init script (`scripts/init-db.sql`) creates all service databases and corresponding `*_test_db` databases on first Docker startup.

### Shared Library (`@social-media/shared`)
Referenced as `"@social-media/shared": "file:../shared"` in each service's package.json. Currently the shared package is **empty** — common code (middleware, types, logger) is duplicated in each service. The `shared/` directory has only `package.json` and `tsconfig.json`.

### App Factory Pattern
Each service exports `createApp()` from `src/app.ts` (returns a configured Express Application) and bootstraps in `src/index.ts`. The factory is separated for testability — integration tests import `createApp()` directly.

### Standard Directory Layout Per Service
```
<service-name>/
├── src/
│   ├── index.ts           # Entry point: bootstrap + graceful shutdown
│   ├── app.ts             # Express app factory
│   ├── config/            # Environment config (index.ts), database.ts, redis.ts, kafka.ts
│   ├── controllers/
│   ├── services/
│   ├── models/
│   ├── routes/            # Route setup + DI wiring in index.ts
│   ├── middleware/        # auth, validation (Joi), rateLimiter, errorHandler
│   ├── kafka/producers/   # Typed event publishers
│   ├── kafka/consumers/   # Event handlers
│   ├── utils/             # logger (Winston), metrics (prom-client), gracefulShutdown
│   └── types/index.ts     # DTOs, entities, Kafka event types, custom error classes
├── tests/
├── migrations/            # Knex migrations (YYYYMMDDHHMMSS_name.ts)
├── .env / .env.example
├── knexfile.ts
├── jest.config.js
└── package.json
```

### Error Handling
Custom error hierarchy extending `AuthError` (base class with `code` and `statusCode`):
- `ValidationError` → 400
- `UnauthorizedError` → 401
- `ForbiddenError` → 403
- `NotFoundError` → 404
- `ConflictError` → 409
- `TooManyRequestsError` → 429

All errors are caught by `errorHandler` middleware and returned as `{ success: false, error: "message", code: "CODE" }`.

### Request Validation
All endpoints use Joi schemas via `validateBody(schema)` middleware defined in routes. Schemas are co-located in the route files (e.g., `src/routes/auth.routes.ts`).

### Authentication
JWT-based with access tokens (15min) and refresh tokens (30 days, rotation on refresh). The `requireAuth` middleware extracts the Bearer token and attaches `req.user`. Auth middleware exists per-service (not from shared library). Password hashing uses Argon2id.

### Configuration
Each service reads `.env` via `dotenv` in `src/config/index.ts`, which validates required env vars at startup. See `.env.example` in each service for all available variables.

### Implemented Services
- **auth-service** (port 3001): Registration, login, JWT token management, MFA/TOTP, session management. Routes: `/api/v1/auth/*`, `/api/v1/mfa/*`
- **user-service** (port 3002): User profiles, follow/unfollow, GDPR export/deletion. Routes: `/api/v1/users/*`

### Service Ports
auth: 3001, user: 3002, post: 3003, media: 3004, interaction: 3005, feed: 3006, notification: 3007, search: 3008, moderation: 3009

### Health Endpoints
Every service exposes `/health` (liveness) and `/health/ready` (readiness — checks DB, Redis, Kafka connectivity).

## Testing Patterns

- Unit tests mock all infrastructure (database, Redis, Kafka) using `jest.mock()` at the top of each test file. See `tests/__mocks__/` for manual mocks of logger and metrics.
- `tests/setup.ts` sets all required environment variables before module loading (`setupFiles` in Jest config), so `config/index.ts` validation passes without real connections.
- Test fixtures are factory functions in `tests/fixtures/index.ts`.
- Integration tests use a real test database (`*_test_db`) and Supertest against `createApp()`.
- Coverage thresholds: branches ≥ 70%, functions/lines/statements ≥ 80%.

## Key Dependencies
Express 4, TypeScript 5 (strict mode, ES2022 target), Knex 3 (PostgreSQL), ioredis 5, kafkajs 2, Joi 17, jsonwebtoken 9, argon2, Winston 3, prom-client 15, Jest 29 + ts-jest + Supertest.
