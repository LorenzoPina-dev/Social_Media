#!/bin/bash
# =============================================================================
# rebuild-dev.sh — Ricostruisce tutti i microservizi con le ultime modifiche
#
# UTILIZZO:
#   ./rebuild-dev.sh            → rebuild tutti i servizi
#   ./rebuild-dev.sh auth       → rebuild solo auth-service
#   ./rebuild-dev.sh auth user  → rebuild auth-service e user-service
#
# PERCHE' E' NECESSARIO:
#   I Dockerfile usano multi-stage build: TypeScript viene compilata in dist/
#   durante la build, e i container eseguono node dist/index.js.
#   Il volume mount ./service/src:/app/src esiste ma i container girano
#   da dist/ baked nell'immagine Docker — ogni modifica .ts richiede --build.
# =============================================================================

set -e

COMPOSE_FILE="docker-compose.dev.yml"

# Servizi applicativi (escludi infra: postgres, redis, kafka, ecc.)
ALL_SERVICES=(
  auth-service
  user-service
  post-service
  media-service
  interaction-service
  feed-service
  notification-service
  search-service
  moderation-service
  nginx
)

# Mappa nome breve → nome completo nel compose
declare -A SERVICE_MAP=(
  [auth]="auth-service"
  [user]="user-service"
  [post]="post-service"
  [media]="media-service"
  [interaction]="interaction-service"
  [feed]="feed-service"
  [notification]="notification-service"
  [search]="search-service"
  [moderation]="moderation-service"
  [nginx]="nginx"
)

# ── Determina quali servizi ricostruire ────────────────────────────────────
if [ $# -eq 0 ]; then
  SERVICES=("${ALL_SERVICES[@]}")
  echo "🔨 Rebuild di TUTTI i servizi..."
else
  SERVICES=()
  for arg in "$@"; do
    full="${SERVICE_MAP[$arg]:-$arg}"
    SERVICES+=("$full")
    echo "🔨 Rebuild di: $full"
  done
fi

echo ""

# ── Rebuild ────────────────────────────────────────────────────────────────
docker-compose -f "$COMPOSE_FILE" up -d --build --no-deps "${SERVICES[@]}"

echo ""
echo "✅ Rebuild completato!"
echo ""

# ── Verifica CORS su auth-service ─────────────────────────────────────────
echo "🔍 Verifica CORS (attendere 5s per l'avvio)..."
sleep 5

CORS_RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
  -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  http://localhost/api/v1/auth/login)

if [ "$CORS_RESULT" = "204" ]; then
  echo "✅ CORS OK — preflight ritorna 204"
else
  echo "⚠️  Preflight ha ritornato HTTP $CORS_RESULT (atteso 204)"
  echo "   Controlla i log con: docker logs social-auth-service --tail=30"
fi

# Mostra gli header CORS della risposta preflight
echo ""
echo "📋 Header CORS ricevuti dal preflight:"
curl -si \
  -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  http://localhost/api/v1/auth/login \
  | grep -i "access-control"
