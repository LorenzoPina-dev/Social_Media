# Social Media Microservices - Complete Code Structure

## 📦 Overview

Questo documento descrive la struttura completa del codice production-ready per tutti i 9 microservizi della piattaforma Social Media.

## 🏗️ Architecture Overview

```
app/
├── shared/                          # Librerie condivise
│   ├── types/                       # TypeScript types comuni
│   ├── utils/                       # Utility functions
│   ├── middleware/                  # Express middleware riusabili
│   ├── database/                    # Database clients e helpers
│   ├── kafka/                       # Kafka producers/consumers
│   └── redis/                       # Redis clients e helpers
│
├── auth-service/                    # Servizio di autenticazione
├── user-service/                    # Servizio utenti
├── post-service/                    # Servizio post
├── media-service/                   # Servizio media
├── interaction-service/             # Servizio interazioni
├── feed-service/                    # Servizio feed
├── notification-service/            # Servizio notifiche
├── search-service/                  # Servizio ricerca
└── moderation-service/              # Servizio moderazione
```

## 📁 Struttura Standard per Ogni Servizio

Ogni servizio segue questa struttura:

```
service-name/
├── src/
│   ├── index.ts                     # Entry point
│   ├── config/
│   │   ├── index.ts                 # Configuration centrale
│   │   ├── database.ts              # DB configuration
│   │   ├── redis.ts                 # Redis configuration
│   │   └── kafka.ts                 # Kafka configuration
│   ├── controllers/                 # HTTP request handlers
│   │   ├── auth.controller.ts
│   │   └── index.ts
│   ├── services/                    # Business logic
│   │   ├── auth.service.ts
│   │   ├── jwt.service.ts
│   │   └── index.ts
│   ├── models/                      # Database models
│   │   ├── user.model.ts
│   │   └── index.ts
│   ├── routes/                      # API routes
│   │   ├── auth.routes.ts
│   │   └── index.ts
│   ├── middleware/                  # Custom middleware
│   │   ├── auth.middleware.ts
│   │   ├── rateLimiter.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── errorHandler.ts
│   ├── utils/                       # Helper functions
│   │   ├── logger.ts
│   │   ├── metrics.ts
│   │   ├── gracefulShutdown.ts
│   │   └── validator.ts
│   ├── types/                       # TypeScript interfaces/types
│   │   ├── index.ts
│   │   └── custom.d.ts
│   └── kafka/                       # Kafka producers/consumers
│       ├── producers/
│       └── consumers/
├── tests/
│   ├── unit/                        # Unit tests
│   ├── integration/                 # Integration tests
│   ├── e2e/                         # End-to-end tests
│   └── fixtures/                    # Test data
├── config/
│   └── knexfile.ts                  # Database migrations config
├── migrations/                      # Database migrations
├── seeds/                           # Database seeds
├── docs/
│   ├── API.md                       # API documentation
│   └── ARCHITECTURE.md              # Architecture details
├── .env.example                     # Environment variables template
├── .dockerignore
├── .eslintrc.json
├── .prettierrc.json
├── Dockerfile
├── jest.config.js
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔐 Auth Service - Detailed Structure

### Core Files

#### `src/index.ts` - Entry Point
```typescript
/**
 * - Inizializzazione Express app
 * - Setup middleware (helmet, cors, compression)
 * - Connessione a database, Redis, Kafka
 * - Setup routes
 * - Health checks
 * - Graceful shutdown
 * - Error handling
 */
```

#### `src/config/index.ts` - Configuration
```typescript
/**
 * - Environment variables validation
 * - JWT configuration
 * - Password security settings
 * - Rate limiting configuration
 * - MFA settings
 * - Session management config
 * - OAuth2 credentials
 */
```

#### `src/config/database.ts` - Database Connection
```typescript
/**
 * - PostgreSQL connection pool
 * - Knex.js setup
 * - Read replicas support
 * - Connection monitoring
 * - Health checks
 */
```

#### `src/config/redis.ts` - Redis Connection
```typescript
/**
 * - Redis Cluster setup
 * - Connection pooling
 * - Automatic reconnection
 * - Pub/Sub configuration
 * - Health monitoring
 */
```

#### `src/config/kafka.ts` - Kafka Configuration
```typescript
/**
 * - Producer setup
 * - Consumer groups
 * - Topic configuration
 * - Error handling
 * - Retry logic
 */
```

### Controllers

#### `src/controllers/auth.controller.ts`
```typescript
/**
 * Funzioni:
 * - register() - Registrazione nuovo utente
 * - login() - Login con username/password
 * - loginGoogle() - Login con Google OAuth2
 * - loginMFA() - Completamento login con MFA
 * - refreshToken() - Refresh access token
 * - logout() - Logout utente
 * - logoutAll() - Logout da tutti i dispositivi
 * - setupMFA() - Setup MFA/2FA
 * - verifyMFA() - Verifica codice MFA
 * - changePassword() - Cambio password
 * - resetPassword() - Reset password
 */
```

### Services (Business Logic)

#### `src/services/auth.service.ts`
```typescript
/**
 * Logica di business per autenticazione:
 * - Validazione credenziali
 * - Hashing password (Argon2)
 * - Gestione sessioni multi-tier cache
 * - Tracking dispositivi
 * - Geo-anomaly detection
 * - Audit logging
 */
```

#### `src/services/jwt.service.ts`
```typescript
/**
 * Gestione JWT tokens:
 * - Generazione access token
 * - Generazione refresh token
 * - Token validation
 * - Token refresh con sliding window
 * - Token rotation
 * - Blacklist management
 */
```

#### `src/services/mfa.service.ts`
```typescript
/**
 * Multi-Factor Authentication:
 * - TOTP generation (Google Authenticator)
 * - QR code generation
 * - Backup codes generation
 * - Token verification
 * - MFA enforcement
 */
```

#### `src/services/oauth.service.ts`
```typescript
/**
 * OAuth2 Integration:
 * - Google OAuth flow
 * - Apple Sign In
 * - Token validation
 * - User profile retrieval
 * - Account linking
 */
```

### Middleware

#### `src/middleware/auth.middleware.ts`
```typescript
/**
 * - requireAuth() - Verifica JWT token
 * - requireMFA() - Richiede MFA completato
 * - requireRole() - Check user role
 * - extractUser() - Estrai user da token
 */
```

#### `src/middleware/rateLimiter.middleware.ts`
```typescript
/**
 * Rate limiting granulare:
 * - Global rate limiter (per IP)
 * - Login rate limiter (5 attempts / 15 min)
 * - API rate limiter (per endpoint)
 * - Redis-backed storage
 * - Sliding window algorithm
 */
```

#### `src/middleware/validation.middleware.ts`
```typescript
/**
 * Input validation con Joi:
 * - Validate registration data
 * - Validate login credentials
 * - Validate password strength
 * - Sanitize inputs
 */
```

#### `src/middleware/errorHandler.ts`
```typescript
/**
 * Centralized error handling:
 * - Custom error classes
 * - HTTP status code mapping
 * - Error logging
 * - Error response formatting
 * - Stack trace (dev only)
 */
```

### Models

#### `src/models/user.model.ts`
```typescript
/**
 * User model con metodi:
 * - create() - Create user
 * - findById() - Find by ID
 * - findByEmail() - Find by email
 * - update() - Update user
 * - delete() - Soft delete
 * - verifyPassword() - Check password
 * - hashPassword() - Hash password
 */
```

#### `src/models/session.model.ts`
```typescript
/**
 * Session model:
 * - create() - Create session
 * - find() - Find session
 * - invalidate() - Invalidate session
 * - invalidateAll() - Invalidate all user sessions
 * - cleanup() - Remove expired sessions
 */
```

### Utilities

#### `src/utils/logger.ts`
```typescript
/**
 * Winston logger configuration:
 * - Structured JSON logging
 * - Log levels (error, warn, info, debug)
 * - File transports
 * - Console transport (dev)
 * - ELK Stack integration
 */
```

#### `src/utils/metrics.ts`
```typescript
/**
 * Prometheus metrics:
 * - HTTP request duration histogram
 * - HTTP request counter
 * - Active sessions gauge
 * - Login attempts counter
 * - Error rate counter
 * - Custom business metrics
 */
```

#### `src/utils/gracefulShutdown.ts`
```typescript
/**
 * Graceful shutdown handler:
 * - Close HTTP server
 * - Disconnect from database
 * - Close Redis connections
 * - Flush Kafka producers
 * - Cleanup resources
 * - Exit process
 */
```

### Kafka Integration

#### `src/kafka/producers/auth.producer.ts`
```typescript
/**
 * Kafka events prodotti:
 * - user_authenticated
 * - session_expired
 * - mfa_enabled
 * - suspicious_login
 * - password_changed
 * - user_created
 */
```

#### `src/kafka/consumers/user.consumer.ts`
```typescript
/**
 * Kafka events consumati:
 * - user_deleted (invalidate sessions)
 * - password_reset_requested
 */
```

### Tests

#### `tests/unit/services/auth.service.test.ts`
```typescript
/**
 * Unit tests per auth service:
 * - Test password hashing
 * - Test password verification
 * - Test session creation
 * - Test multi-tier cache
 * - Mock dependencies
 */
```

#### `tests/integration/controllers/auth.controller.test.ts`
```typescript
/**
 * Integration tests:
 * - Test registration flow
 * - Test login flow
 * - Test MFA flow
 * - Test token refresh
 * - Test rate limiting
 * - Use test database
 */
```

#### `tests/e2e/auth.e2e.test.ts`
```typescript
/**
 * End-to-end tests:
 * - Complete registration → login → MFA → access protected route
 * - OAuth2 flow
 * - Session management
 * - Multi-device scenarios
 */
```

---

## 👤 User Service - Key Components

### Controllers
- `user.controller.ts` - CRUD operations
- `profile.controller.ts` - Profile management
- `follow.controller.ts` - Follow/unfollow
- `gdpr.controller.ts` - Data export, deletion

### Services
- `user.service.ts` - User business logic
- `profile.service.ts` - Profile updates
- `follower.service.ts` - Followers/following
- `gdpr.service.ts` - GDPR compliance (export, deletion)
- `cache.service.ts` - Multi-tier caching

### Models
- `user.model.ts` - User entity
- `profile.model.ts` - User profile
- `follower.model.ts` - Follow relationships

### Features
- Profile caching (Redis + in-memory)
- GDPR compliance (soft delete + hard delete after grace period)
- Data export (JSON format)
- Follower/following management
- User search (delegated to Search Service)

---

## 📝 Post Service - Key Components

### Controllers
- `post.controller.ts` - CRUD operations
- `moderation.controller.ts` - Content moderation

### Services
- `post.service.ts` - Post business logic
- `moderation.service.ts` - Content moderation pipeline
- `scheduler.service.ts` - Scheduled posts

### Features
- Content moderation pipeline (Perspective API + AWS Rekognition)
- Edit history tracking
- Scheduled posts
- Cursor-based pagination
- Hashtag extraction

---

## 🎬 Media Service - Key Components

### Controllers
- `upload.controller.ts` - Upload management
- `processing.controller.ts` - Processing status

### Services
- `upload.service.ts` - Presigned URLs
- `processing.service.ts` - Media processing
- `image.service.ts` - Image optimization
- `video.service.ts` - Video transcoding
- `scanner.service.ts` - Virus scanning (ClamAV)

### Workers
- `image-processor/` - Image processing worker (Python)
- `video-processor/` - Video transcoding worker (Python/FFmpeg)

### Features
- CDN integration (CloudFront)
- Multi-format support (WebP, AVIF, JPEG)
- Video HLS streaming (360p, 480p, 720p, 1080p)
- Virus scanning
- Blurhash generation
- EXIF stripping

---

## ❤️ Interaction Service - Key Components

### Controllers
- `like.controller.ts` - Like/unlike
- `comment.controller.ts` - Comments CRUD
- `share.controller.ts` - Share posts

### Services
- `like.service.ts` - Like management
- `comment.service.ts` - Comment threading
- `counter.service.ts` - Real-time counters
- `reconciliation.service.ts` - Redis ↔ PostgreSQL sync

### Features
- Real-time counters (Redis)
- Nested comments (Closure Table)
- Spam detection
- Eventual consistency with reconciliation
- Vote system (upvote/downvote)

---

## 🍽️ Feed Service - Key Components

### Controllers
- `feed.controller.ts` - Feed generation

### Services
- `feed.service.ts` - Feed business logic
- `fanout.service.ts` - Fan-out strategy
- `ranking.service.ts` - Post ranking algorithm
- `recommendation.service.ts` - ML recommendations

### Features
- Hybrid fan-out (write + read)
- Engagement-based ranking
- Collaborative filtering
- Redis-backed feeds
- Celebrity handling (>100k followers)

---

## 🔔 Notification Service - Key Components

### Controllers
- `notification.controller.ts` - Notifications CRUD
- `preferences.controller.ts` - User preferences

### Services
- `notification.service.ts` - Notification logic
- `push.service.ts` - Push notifications (FCM, APNs)
- `email.service.ts` - Email notifications
- `websocket.service.ts` - Real-time WebSocket

### Features
- Multi-channel delivery
- User preferences
- Batching (reduce spam)
- Quiet hours
- WebSocket real-time updates

---

## 🔍 Search Service - Key Components

### Controllers
- `search.controller.ts` - Search API

### Services
- `elasticsearch.service.ts` - ES client
- `indexer.service.ts` - Index management
- `autocomplete.service.ts` - Suggestions

### Features
- Full-text search
- Fuzzy matching
- Autocomplete
- Faceted search
- Real-time indexing (Kafka)

---

## 🛡️ Moderation Service - Key Components

### Controllers
- `moderation.controller.ts` - Moderation dashboard
- `appeal.controller.ts` - Appeal management

### Services
- `ml.service.ts` - ML-based moderation
- `review.service.ts` - Human review queue
- `appeal.service.ts` - Appeal handling

### Features
- Perspective API integration
- AWS Rekognition
- Human review queue with SLA
- Appeal system
- Audit trail

---

## 🧪 Testing Strategy

### Unit Tests (80% coverage target)
- Test business logic in isolation
- Mock all dependencies
- Fast execution (<100ms per test)

### Integration Tests
- Test API endpoints
- Use test database
- Test middleware pipeline
- Verify database operations

### E2E Tests
- Test complete user flows
- Use Docker containers
- Simulate real scenarios
- Test error handling

### Load Tests (k6)
- Simulate 10,000 concurrent users
- Measure p95, p99 latency
- Find bottlenecks
- Verify auto-scaling

---

## 📊 Monitoring & Observability

### Metrics (Prometheus)
```
# HTTP metrics
http_request_duration_seconds
http_requests_total
http_errors_total

# Business metrics
auth_login_attempts_total
auth_mfa_enabled_total
posts_created_total
media_uploaded_bytes_total

# Infrastructure metrics
redis_connections_active
kafka_messages_produced_total
db_queries_duration_seconds
```

### Logging (ELK Stack)
```json
{
  "timestamp": "2025-02-13T10:00:00Z",
  "level": "info",
  "service": "auth-service",
  "message": "User logged in",
  "userId": "abc123",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "traceId": "xyz789"
}
```

### Tracing (Jaeger)
- Distributed request tracing
- Service dependency mapping
- Latency breakdown
- Error tracking

---

## 🚀 Deployment

### Docker
```bash
# Build
docker build -t auth-service:latest ./auth-service

# Run
docker run -p 3001:3001 --env-file .env auth-service:latest
```

### Kubernetes
```yaml
# Deployment with HPA
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: auth-service
        image: auth-service:latest
        resources:
          requests:
            cpu: 2000m
            memory: 4Gi
          limits:
            cpu: 4000m
            memory: 8Gi
```

---

## 📚 Documentation

Ogni servizio include:
- `README.md` - Quick start guide
- `docs/API.md` - API specification (OpenAPI)
- `docs/ARCHITECTURE.md` - Architecture details
- `docs/DEPLOYMENT.md` - Deployment guide
- Inline code comments (JSDoc style)

---

## 🎯 Best Practices Implementate

### Security
✅ Helmet.js per HTTP headers sicuri
✅ CORS configurazione restrittiva
✅ Rate limiting multi-livello
✅ JWT con token rotation
✅ Password hashing con Argon2
✅ Input validation e sanitization
✅ SQL injection prevention (parameterized queries)
✅ XSS prevention (sanitized HTML)
✅ CSRF protection

### Performance
✅ Multi-tier caching (L1 in-memory + L2 Redis + L3 DB)
✅ Database connection pooling
✅ Read replicas per query di lettura
✅ CDN per contenuti statici
✅ Compression (gzip/brotli)
✅ Lazy loading e pagination
✅ Async processing (Kafka)

### Reliability
✅ Circuit breaker pattern
✅ Retry logic con exponential backoff
✅ Graceful shutdown
✅ Health checks (liveness + readiness)
✅ Error handling centralizzato
✅ Structured logging
✅ Distributed tracing

### Scalability
✅ Stateless services
✅ Horizontal scaling (HPA)
✅ Event-driven architecture
✅ Database sharding ready
✅ Redis cluster
✅ Kafka partitioning

### Code Quality
✅ TypeScript strict mode
✅ ESLint + Prettier
✅ Unit tests (80% coverage)
✅ Integration tests
✅ E2E tests
✅ Code reviews mandatory
✅ CI/CD pipeline

---

## 📋 Next Steps

1. **Run the generator script:**
   ```bash
   bash generate-services.sh
   ```

2. **Install dependencies:**
   ```bash
   cd app
   npm install
   ```

3. **Setup infrastructure:**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Run migrations:**
   ```bash
   npm run migrate:all
   ```

5. **Start services:**
   ```bash
   npm run dev:all
   ```

6. **Run tests:**
   ```bash
   npm run test:all
   ```

---

## 🤝 Contributing

Vedere [CONTRIBUTING.md](./CONTRIBUTING.md) per le linee guida.

## 📄 License

MIT License - vedere [LICENSE](./LICENSE) file per dettagli.
