# 🔐 Auth Service

Production-ready authentication and authorization microservice for Social Media Platform.

## 🚀 Features

- ✅ User registration with password hashing (Argon2id)
- ✅ Login with JWT tokens (access + refresh)
- ✅ Multi-device session management (max 5 sessions)
- ✅ Rate limiting (Redis-based)
- ✅ Input validation (Joi schemas)
- ✅ Prometheus metrics
- ✅ Structured logging (Winston)
- ✅ Kafka event streaming
- ✅ Health checks (liveness + readiness)
- ✅ Graceful shutdown
- ✅ MFA/2FA support (TOTP - FULLY IMPLEMENTED)
- ✅ OAuth2 support (ready for implementation)

## 📋 Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- PostgreSQL >= 15
- Redis >= 7.0
- Kafka >= 3.6

## 🛠️ Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your configuration:
- Database credentials
- Redis URL
- Kafka brokers
- JWT secrets (IMPORTANT: use strong secrets in production)

### 3. Database Setup

Create database:
```sql
CREATE DATABASE social_media;
```

Run migrations:
```bash
npm run migrate
```

### 4. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3001`

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Unit Tests Only
```bash
npm run test:unit
```

### Run with Coverage
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

## 📊 Monitoring

### Prometheus Metrics
Available at: `http://localhost:9091/metrics`

Metrics include:
- `http_request_duration_seconds` - HTTP request duration
- `http_requests_total` - Total HTTP requests
- `http_errors_total` - Total HTTP errors
- `auth_login_attempts_total` - Login attempts counter
- `auth_registrations_total` - User registrations counter
- `auth_token_refreshes_total` - Token refresh counter
- `auth_active_sessions` - Active sessions gauge

### Health Checks

- **Liveness:** `GET /health`
- **Readiness:** `GET /health/ready`

## 📡 API Endpoints

### Register User
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "display_name": "John Doe"
}
```

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "johndoe",
  "password": "SecurePass123!"
}
```

### Refresh Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

### Logout
```http
POST /api/v1/auth/logout
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

### Logout All Devices
```http
POST /api/v1/auth/logout-all
Authorization: Bearer your-access-token
```

## 🔒 Security

### Password Requirements
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- At least 1 special character

### Rate Limits
- **Registration:** 10 requests per 15 minutes
- **Login:** 5 requests per 15 minutes
- **Token Refresh:** 20 requests per 15 minutes

### Token Expiry
- **Access Token:** 15 minutes
- **Refresh Token:** 30 days

### Session Management
- Maximum 5 sessions per user
- Automatic cleanup of expired sessions
- IP and device tracking

## 🏗️ Project Structure

```
auth-service/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # HTTP request handlers
│   ├── services/         # Business logic
│   ├── models/           # Database models
│   ├── routes/           # API routes
│   ├── middleware/       # Express middleware
│   ├── utils/            # Utility functions
│   ├── kafka/            # Kafka producers/consumers
│   └── types/            # TypeScript type definitions
├── tests/
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── e2e/              # End-to-end tests
├── migrations/           # Database migrations
└── seeds/                # Database seeds
```

## 🔧 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests with coverage
- `npm run lint` - Lint code
- `npm run format` - Format code
- `npm run migrate` - Run database migrations
- `npm run migrate:rollback` - Rollback last migration

## 🐳 Docker

### Build Image
```bash
docker build -t auth-service:latest .
```

### Run Container
```bash
docker run -p 3001:3001 --env-file .env auth-service:latest
```

## 📝 Environment Variables

See `.env.example` for all available environment variables.

Critical variables:
- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `KAFKA_BROKERS` - Kafka broker list
- `JWT_ACCESS_SECRET` - JWT access token secret (min 32 chars)
- `JWT_REFRESH_SECRET` - JWT refresh token secret (min 32 chars)

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
psql -h localhost -U postgres -d social_media
```

### Redis Connection Failed
```bash
# Check Redis is running
redis-cli ping
```

### Kafka Connection Failed
```bash
# Check Kafka is running
docker ps | grep kafka
```

## 📚 Documentation

- [Implementation Complete](./IMPLEMENTATION_COMPLETE.md) - Full implementation details
- [API Documentation](./docs/api.md) - Detailed API documentation (to be created)

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Write tests for new features
3. Run linter before committing
4. Update documentation

## 📄 License

MIT

## 👥 Authors

Social Media Platform Team

---

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** February 13, 2025
