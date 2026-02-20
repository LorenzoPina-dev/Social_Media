# ============================================================================
# Makefile - Social Media Platform
# Comandi comuni per development
# ============================================================================

.PHONY: help setup up down restart logs clean install test migrate

# Default target
help:
	@echo "🚀 Social Media Platform - Available Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup       - Complete setup (infrastructure + services)"
	@echo "  make install     - Install all dependencies"
	@echo "  make migrate     - Run all migrations"
	@echo ""
	@echo "Docker:"
	@echo "  make up          - Start all containers"
	@echo "  make down        - Stop all containers"
	@echo "  make restart     - Restart all containers"
	@echo "  make logs        - Show container logs"
	@echo "  make ps          - Show container status"
	@echo ""
	@echo "Development:"
	@echo "  make dev-auth    - Start auth-service in dev mode"
	@echo "  make dev-user    - Start user-service in dev mode"
	@echo ""
	@echo "Testing:"
	@echo "  make test        - Run all tests"
	@echo "  make test-auth   - Test auth-service"
	@echo "  make test-user   - Test user-service"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean       - Stop containers and remove volumes"
	@echo "  make clean-all   - Complete cleanup (containers + images)"
	@echo ""

# Setup completo
setup:
	@echo "🚀 Starting complete setup..."
	@$(MAKE) up
	@sleep 30
	@$(MAKE) install
	@$(MAKE) migrate
	@echo "✅ Setup complete!"

# Installa dipendenze
install:
	@echo "📦 Installing dependencies..."
	@cd auth-service && npm install
	@cd user-service && npm install
	@echo "✅ Dependencies installed"

# Run migrations
migrate:
	@echo "🗄️  Running migrations..."
	@cd auth-service && npm run migrate || true
	@cd user-service && npm run migrate || true
	@echo "✅ Migrations complete"

# Start containers
up:
	@echo "🐳 Starting containers..."
	@docker-compose up -d
	@echo "✅ Containers started"

# Stop containers
down:
	@echo "🛑 Stopping containers..."
	@docker-compose down
	@echo "✅ Containers stopped"

# Restart containers
restart:
	@echo "🔄 Restarting containers..."
	@$(MAKE) down
	@$(MAKE) up
	@echo "✅ Containers restarted"

# Show logs
logs:
	@docker-compose logs -f

# Show container status
ps:
	@docker-compose ps

# Start auth-service in dev mode
dev-auth:
	@echo "🚀 Starting auth-service..."
	@cd auth-service && npm run dev

# Start user-service in dev mode
dev-user:
	@echo "🚀 Starting user-service..."
	@cd user-service && npm run dev

# Run all tests
test:
	@echo "🧪 Running tests..."
	@cd auth-service && npm test
	@cd user-service && npm test

# Test auth-service
test-auth:
	@cd auth-service && npm test

# Test user-service
test-user:
	@cd user-service && npm test

# Clean (remove volumes)
clean:
	@echo "🗑️  Cleaning up..."
	@docker-compose down -v
	@echo "✅ Cleanup complete"

# Complete cleanup
clean-all:
	@echo "🗑️  Complete cleanup..."
	@docker-compose down -v --rmi all
	@docker volume prune -f
	@docker network prune -f
	@echo "✅ Complete cleanup done"

# Health checks
health:
	@echo "🏥 Checking service health..."
	@curl -s http://localhost:3001/health | jq '.' || echo "❌ Auth service not responding"
	@curl -s http://localhost:3002/health | jq '.' || echo "❌ User service not responding"

# Show URLs
urls:
	@echo "📡 Service URLs:"
	@echo ""
	@echo "Services:"
	@echo "  Auth Service:      http://localhost:3001"
	@echo "  User Service:      http://localhost:3002"
	@echo ""
	@echo "Admin UIs:"
	@echo "  pgAdmin:           http://localhost:5050 (admin@admin.com/admin)"
	@echo "  Redis Commander:   http://localhost:8081"
	@echo "  Kafka UI:          http://localhost:8080"
	@echo ""
	@echo "Monitoring:"
	@echo "  Prometheus:        http://localhost:9090"
	@echo "  Grafana:           http://localhost:3100 (admin/admin)"
	@echo ""
