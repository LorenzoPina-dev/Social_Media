# Social Media Platform - Microservices

Production-ready microservices architecture for a scalable social media platform.

## Services Overview

### Core Services
- **auth-service** - Authentication, authorization, session management, MFA
- **user-service** - User profiles, followers/following, GDPR compliance
- **post-service** - Post CRUD, content moderation pipeline
- **media-service** - Media upload, processing, CDN delivery
- **interaction-service** - Likes, comments, shares with real-time counters

### Feature Services
- **feed-service** - Personalized feed generation, ranking algorithm
- **notification-service** - Multi-channel notifications (in-app, push, email, SMS)
- **search-service** - Full-text search with Elasticsearch
- **moderation-service** - Content moderation (ML + human review)

## Technology Stack

- **Runtime:** Node.js 20.x
- **Language:** TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL 15
- **Cache:** Redis 7.0 Cluster
- **Message Broker:** Apache Kafka
- **Search:** Elasticsearch 8.x
- **Object Storage:** MinIO
- **API Gateway:** Envoy Proxy
- **Monitoring:** Prometheus + Grafana
- **Logging:** ELK Stack
- **Tracing:** Jaeger (OpenTelemetry)

## Project Structure

```
app/
├── auth-service/           # Authentication & Authorization
├── user-service/           # User Management
├── post-service/           # Post Management
├── media-service/          # Media Processing
├── interaction-service/    # Likes, Comments, Shares
├── feed-service/           # Feed Generation
├── notification-service/   # Notifications
├── search-service/         # Search Engine
├── moderation-service/     # Content Moderation
├── shared/                 # Shared libraries
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   ├── middleware/        # Common middleware
│   ├── database/          # Database clients
│   ├── kafka/             # Kafka producers/consumers
│   └── redis/             # Redis clients
└── scripts/               # DevOps scripts
```

## Quick Start

### Prerequisites
- Node.js 20.x
- Docker & Docker Compose
- PostgreSQL 15
- Redis 7.0
- Kafka 3.6

### Installation

```bash
# Install dependencies for all services
npm run install:all

# Setup environment variables
cp .env.example .env

# Start infrastructure (PostgreSQL, Redis, Kafka, etc.)
docker-compose up -d

# Run database migrations
npm run migrate:all

# Start all services in development mode
npm run dev:all
```

### Development

```bash
# Start a specific service
npm run dev --workspace=auth-service

# Run tests
npm run test --workspace=auth-service

# Run tests for all services
npm run test:all

# Build all services
npm run build:all

# Lint and format
npm run lint:all
npm run format:all
```

## Testing

Each service includes:
- **Unit Tests** - Business logic testing
- **Integration Tests** - API endpoint testing
- **E2E Tests** - Full workflow testing
- **Load Tests** - Performance testing with k6

```bash
# Run all tests
npm run test:all

# Run tests with coverage
npm run test:coverage

# Run e2e tests
npm run test:e2e

# Run load tests
npm run test:load
```

## Deployment

### Docker Build

```bash
# Build all service images
npm run docker:build:all

# Build specific service
npm run docker:build --workspace=auth-service

# Push to registry
npm run docker:push:all
```

### Kubernetes

```bash
# Apply all manifests
kubectl apply -f k8s/

# Deploy specific service
kubectl apply -f k8s/auth-service/

# Check deployment status
kubectl get pods -n application
```

## Monitoring & Observability

- **Metrics:** http://localhost:9090 (Prometheus)
- **Dashboards:** http://localhost:3000 (Grafana)
- **Logs:** http://localhost:5601 (Kibana)
- **Tracing:** http://localhost:16686 (Jaeger)

## API Documentation

Each service exposes OpenAPI documentation:
- Auth Service: http://localhost:3001/api-docs
- User Service: http://localhost:3002/api-docs
- Post Service: http://localhost:3003/api-docs
- etc.

## Architecture Diagrams

See `/docs/architecture/` for:
- System architecture overview
- Service communication patterns
- Database schemas
- Deployment diagrams

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Support

For issues and questions, please open a GitHub issue.
