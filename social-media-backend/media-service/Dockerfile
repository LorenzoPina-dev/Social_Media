FROM node:20-alpine AS builder

WORKDIR /app/shared
COPY shared/package*.json ./
RUN npm install
COPY shared/ ./
RUN npm run build

WORKDIR /app/media-service
COPY media-service/package*.json ./
RUN npm ci
COPY media-service/ ./

RUN npm run build
RUN npx tsc --project tsconfig.scripts.json

# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

# netcat for healthcheck waits, vips-dev for sharp (optional but fast)
RUN apk add --no-cache netcat-openbsd

WORKDIR /app/shared
COPY shared/package*.json ./
COPY --from=builder /app/shared/dist ./dist

WORKDIR /app/media-service
COPY media-service/package*.json ./

# FIX: install ALL deps (including devDeps: ts-node, nodemon, typescript)
# so the image can be used in dev mode with ts-node without a separate build
RUN npm ci

COPY --from=builder /app/media-service/dist ./dist

ENV NODE_ENV=development
EXPOSE 3004

# Production CMD: wait for infra, run migrations, start compiled JS
# In dev mode docker-compose.dev.yml overrides this with ts-node
CMD ["sh", "-c", "\
  echo '⏳ Waiting for PostgreSQL...' && \
  until nc -z postgres 5432; do sleep 1; done && \
  echo '⏳ Waiting for Redis...' && \
  until nc -z redis 6379; do sleep 1; done && \
  echo '⏳ Waiting for Kafka...' && \
  until nc -z kafka 29092; do sleep 1; done && \
  echo '✅ All infrastructure ready' && \
  echo '📦 Running DB migrations...' && \
  (node dist/scripts/init-db.js || echo '⚠️  init-db warning (non-fatal in dev)') && \
  echo '🚀 Starting media-service...' && \
  node dist/index.js \
"]
