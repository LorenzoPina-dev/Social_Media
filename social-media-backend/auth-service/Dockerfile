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

# Installa tutte le dipendenze (incluse devDependencies per la compilazione)
COPY auth-service/package*.json ./
RUN npm ci

# Copia i sorgenti
COPY auth-service/ ./

# 1) Compila src/ → dist/ (tsconfig.json, rootDir=src)
RUN npm run build

# 2) Compila scripts/ e migrations/ → dist/scripts/ dist/migrations/
#    usando tsconfig.scripts.json che estende il principale ma con rootDir="."
RUN npx tsc --project tsconfig.scripts.json

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

# netcat-openbsd fornisce `nc`, usato nel wait-loop per PostgreSQL
RUN apk add --no-cache netcat-openbsd

WORKDIR /app/shared
COPY shared/package*.json ./
COPY --from=builder /app/shared/dist ./dist

WORKDIR /app/auth-service

# Solo dipendenze di produzione
COPY auth-service/package*.json ./
RUN npm ci --omit=dev

# Copia l'intero dist/ dal builder
# Contiene: dist/   (app)
#           dist/scripts/init-db.js
#           dist/migrations/*.js
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
  echo '🚀 Starting auth-service...' && \
  node dist/index.js \
"]
