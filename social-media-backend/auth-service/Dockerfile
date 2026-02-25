# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Builder
# Compila src/, scripts/ e migrations/ in dist/
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/shared
COPY shared/package*.json ./
RUN npm install
COPY shared/ ./
RUN npm run build

WORKDIR /app/auth-service

COPY auth-service/package*.json ./
RUN npm ci

COPY auth-service/ ./

RUN npm run build

RUN npx tsc --project tsconfig.scripts.json

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache netcat-openbsd

WORKDIR /app/shared
COPY shared/package*.json ./
COPY --from=builder /app/shared/dist ./dist

WORKDIR /app/auth-service

COPY auth-service/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/auth-service/dist ./dist

ENV NODE_ENV=production
EXPOSE 3001

CMD ["sh", "-c", "\
  echo '🔄 Waiting for PostgreSQL...' && \
  until nc -z postgres 5432; do \
    echo '  ...not ready yet, retrying in 2s'; \
    sleep 2; \
  done && \
  echo '✅ PostgreSQL is ready' && \
  echo '📦 Creating DB and running migrations...' && \
  node dist/scripts/init-db.js && \
  echo '✅ Migrations completed successfully' && \
  echo '📦 cartella dist...' && \
  ls -la dist && \
  echo '🚀 Starting auth-service...' && \
  npm start \
"]
