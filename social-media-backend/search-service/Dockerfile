FROM node:20-alpine AS builder

WORKDIR /app/shared
COPY shared/package*.json ./
RUN npm install
COPY shared/ ./
RUN npm run build

WORKDIR /app/search-service

COPY search-service/package*.json ./
RUN npm ci

COPY search-service/ ./

RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache netcat-openbsd

WORKDIR /app/shared
COPY shared/package*.json ./
COPY --from=builder /app/shared/dist ./dist

WORKDIR /app/search-service

COPY search-service/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/search-service/dist ./dist

ENV NODE_ENV=production
EXPOSE 3008

CMD ["sh", "-c", "\
  echo '🔄 Waiting for Elasticsearch...' && \
  until curl -s http://elasticsearch:9200 > /dev/null; do \
    echo '  ...not ready yet, retrying in 2s'; \
    sleep 2; \
  done && \
  echo '✅ Elasticsearch is ready' && \
  echo '📦 Creating DB and running migrations...' && \
  node dist/scripts/init-elasticsearch.js && \
  echo '✅ Migrations completed successfully' && \
  echo '🚀 Starting search-service...' && \
  node dist/index.js \
"]
