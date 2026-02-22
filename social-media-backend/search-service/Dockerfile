FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine

RUN apk add --no-cache curl

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3008

CMD ["sh", "-c", "\
  echo '🔄 Waiting for Elasticsearch...' && \
  until curl -s http://elasticsearch:9200 > /dev/null; do \
    echo '  ...not ready yet, retrying in 2s'; \
    sleep 2; \
  done && \
  echo '✅ Elasticsearch is ready' && \
  echo '🚀 Starting search-service...' && \
  node dist/index.js \
"]
