#!/bin/bash
# ============================================================================
# Social Media Platform - Local Setup Script (Linux/Mac)
# ============================================================================

set -e

echo "🚀 Social Media Platform - Local Setup"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites found${NC}"
echo ""

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true
echo ""

# Clean up old volumes (optional)
read -p "Do you want to clean up old data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Cleaning up old volumes..."
    docker-compose down -v
    echo -e "${GREEN}✅ Volumes cleaned${NC}"
fi
echo ""

# Start infrastructure services
echo "🐳 Starting infrastructure services..."
docker-compose up -d postgres redis zookeeper kafka elasticsearch
echo ""

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
echo "   This may take 1-2 minutes..."

max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker-compose ps | grep -q "healthy"; then
        postgres_healthy=$(docker-compose ps postgres | grep -q "healthy" && echo "yes" || echo "no")
        redis_healthy=$(docker-compose ps redis | grep -q "healthy" && echo "yes" || echo "no")
        kafka_healthy=$(docker-compose ps kafka | grep -q "healthy" && echo "yes" || echo "no")
        
        if [ "$postgres_healthy" = "yes" ] && [ "$redis_healthy" = "yes" ] && [ "$kafka_healthy" = "yes" ]; then
            echo -e "${GREEN}✅ All core services are ready${NC}"
            break
        fi
    fi
    
    attempt=$((attempt + 1))
    echo -n "."
    sleep 2
done
echo ""

if [ $attempt -eq $max_attempts ]; then
    echo -e "${YELLOW}⚠️  Timeout waiting for services. Continuing anyway...${NC}"
fi
echo ""

# Start monitoring and admin UIs
echo "📊 Starting monitoring and admin services..."
docker-compose up -d prometheus grafana kafka-ui redis-commander pgadmin
echo ""

# Install dependencies for auth-service
echo "📦 Installing auth-service dependencies..."
cd auth-service
npm install
echo -e "${GREEN}✅ Auth service dependencies installed${NC}"
echo ""

# Run migrations for auth-service
echo "🗄️  Running auth-service migrations..."
npm run migrate || echo -e "${YELLOW}⚠️  Migrations may have already been run${NC}"
echo ""

cd ..

# Install dependencies for user-service
echo "📦 Installing user-service dependencies..."
cd user-service
npm install
echo -e "${GREEN}✅ User service dependencies installed${NC}"
echo ""

# Run migrations for user-service (if exists)
if [ -f "package.json" ] && grep -q "migrate" package.json; then
    echo "🗄️  Running user-service migrations..."
    npm run migrate || echo -e "${YELLOW}⚠️  Migrations may have already been run${NC}"
    echo ""
fi

cd ..

# Display service URLs
echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "📡 Services Available:"
echo "   • PostgreSQL:        localhost:5432"
echo "   • Redis:             localhost:6379"
echo "   • Kafka:             localhost:9092"
echo "   • Elasticsearch:     localhost:9200"
echo "   • Prometheus:        http://localhost:9090"
echo "   • Grafana:           http://localhost:3100 (admin/admin)"
echo "   • Kafka UI:          http://localhost:8080"
echo "   • Redis Commander:   http://localhost:8081"
echo "   • pgAdmin:           http://localhost:5050 (admin@admin.com/admin)"
echo ""
echo "🚀 To start the services:"
echo "   1. Auth Service:     cd auth-service && npm run dev"
echo "   2. User Service:     cd user-service && npm run dev"
echo ""
echo "🧪 To run tests:"
echo "   • Auth Service:      cd auth-service && npm test"
echo "   • User Service:      cd user-service && npm test"
echo ""
echo "🛑 To stop all containers:"
echo "   docker-compose down"
echo ""
echo "📝 Check the logs:"
echo "   docker-compose logs -f [service-name]"
echo ""
