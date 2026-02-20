# 🚀 Social Media Platform - Microservices

Piattaforma social media completa basata su architettura microservizi.

**Versione:** 1.0.0  
**Stato:** In Development  
**Stack:** Node.js, TypeScript, PostgreSQL, Redis, Kafka, Elasticsearch

---

## 📋 INDICE

- [Quick Start](#-quick-start)
- [Servizi Disponibili](#-servizi-disponibili)
- [Architettura](#-architettura)
- [Setup Locale](#-setup-locale)
- [Documentazione](#-documentazione)
- [Testing](#-testing)
- [Deployment](#-deployment)

---

## ⚡ QUICK START

### Opzione 1: Automatico (Consigliato)

**Windows:**
```powershell
.\scripts\setup.ps1
```

**Linux/macOS:**
```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### Opzione 2: Con Make

```bash
make setup    # Setup completo
make dev-auth # Start auth-service (terminal 1)
make dev-user # Start user-service (terminal 2)
```

### Opzione 3: Manuale

Vedi [QUICK_START.md](./QUICK_START.md)

---

## 🎯 SERVIZI DISPONIBILI

### Microservizi Implementati

| Servizio | Porta | Stato | Descrizione |
|----------|-------|-------|-------------|
| **auth-service** | 3001 | ✅ 100% | Autenticazione, JWT, MFA/2FA |
| **user-service** | 3002 | ✅ 100% | Gestione utenti, profili, followers |
| post-service | 3003 | 🔴 0% | Gestione post e contenuti |
| media-service | 3004 | 🔴 0% | Upload e gestione media |
| interaction-service | 3005 | 🔴 0% | Like, commenti, condivisioni |
| feed-service | 3006 | 🔴 0% | Feed personalizzati |
| notification-service | 3007 | 🔴 0% | Notifiche push/email |
| search-service | 3008 | 🔴 0% | Ricerca full-text |
| moderation-service | 3009 | 🔴 0% | Moderazione contenuti |

### Infrastructure Services

| Servizio | Porta | UI | Descrizione |
|----------|-------|-----|-------------|
| **PostgreSQL** | 5432 | [pgAdmin](http://localhost:5050) | Database principale |
| **Redis** | 6379 | [Commander](http://localhost:8081) | Cache e sessioni |
| **Kafka** | 9092 | [Kafka UI](http://localhost:8080) | Message broker |
| **Elasticsearch** | 9200 | - | Search engine |
| **Prometheus** | 9090 | [Prometheus](http://localhost:9090) | Metrics |
| **Grafana** | 3100 | [Grafana](http://localhost:3100) | Monitoring |

---

## 🏗️ ARCHITETTURA

```
┌─────────────────────────────────────────────────────────┐
│                     API Gateway                          │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌──────▼───────┐  ┌────────▼────────┐
│  Auth Service  │  │ User Service │  │  Post Service   │
│   (Port 3001)  │  │ (Port 3002)  │  │  (Port 3003)    │
└───────┬────────┘  └──────┬───────┘  └────────┬────────┘
        │                  │                    │
        └──────────────────┼────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼────────┐ ┌──────▼───────┐ ┌─────▼──────────┐
│   PostgreSQL   │ │    Redis     │ │     Kafka      │
│  (Port 5432)   │ │ (Port 6379)  │ │  (Port 9092)   │
└────────────────┘ └──────────────┘ └────────────────┘
```

### Comunicazione tra Servizi

- **Sincrona:** REST API (servizio-a-servizio)
- **Asincrona:** Kafka Events (pub/sub)
- **Cache:** Redis (distributed cache)
- **Database:** PostgreSQL (per-service database)

---

## 🛠️ SETUP LOCALE

### Prerequisiti

- Docker Desktop 20.10+
- Node.js 20.0+
- npm 10.0+

### Setup Completo

```bash
# 1. Clone repository
git clone <repository-url>
cd Social_Media

# 2. Setup automatico
./scripts/setup.sh   # Linux/macOS
.\scripts\setup.ps1  # Windows

# 3. Avvia i servizi
make dev-auth  # Terminal 1
make dev-user  # Terminal 2
```

**Guida dettagliata:** [SETUP_GUIDE.md](./SETUP_GUIDE.md)

---

## 📚 DOCUMENTAZIONE

### Guide Principali

- 📖 [Setup Guide](./SETUP_GUIDE.md) - Setup completo passo-passo
- ⚡ [Quick Start](./QUICK_START.md) - Comandi essenziali
- 🏗️ [Architecture](./docs/architecture.md) - Architettura sistema
- 🔐 [Security](./docs/security.md) - Linee guida sicurezza

### Documentazione Servizi

#### Auth Service
- [README](./auth-service/README.md) - Panoramica servizio
- [Implementation Complete](./auth-service/IMPLEMENTATION_COMPLETE.md) - Dettagli implementazione
- [MFA Implementation](./auth-service/MFA_IMPLEMENTATION.md) - Setup MFA/2FA
- [Verification Complete](./auth-service/VERIFICATION_COMPLETE.md) - Verifica e testing

#### User Service
- [README](./user-service/README.md) - Panoramica servizio
- [Implementation Complete](./user-service/IMPLEMENTATION_COMPLETE.md) - Dettagli implementazione

---

## 🧪 TESTING

### Run Tutti i Test

```bash
make test
```

### Test per Servizio

```bash
# Auth Service
cd auth-service
npm test                    # All tests
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm test -- --coverage     # With coverage

# User Service
cd user-service
npm test                    # All tests
npm run test:unit          # Unit tests
npm run test:integration   # Integration tests
npm test -- --coverage     # With coverage
```

### Test API con curl

```bash
# Registrazione
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test123!@#"}'

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test123!@#"}'

# Get Profile
curl http://localhost:3002/api/v1/users/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 📊 MONITORING

### Prometheus

```bash
# Accedi a Prometheus
open http://localhost:9090

# Query esempi:
# - http_requests_total
# - auth_login_attempts_total
# - auth_registrations_total
```

### Grafana

```bash
# Accedi a Grafana
open http://localhost:3100
# Credentials: admin / admin

# Dashboard preconfigurate:
# - Service Metrics
# - Database Performance
# - API Response Times
```

### Logs

```bash
# Tutti i container
docker-compose logs -f

# Servizio specifico
docker-compose logs -f postgres
docker-compose logs -f kafka
docker-compose logs -f redis
```

---

## 🚀 DEPLOYMENT

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
# Build images
docker-compose build

# Start in production
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes

```bash
# Apply configurations
kubectl apply -f k8s/

# Check status
kubectl get pods
kubectl get services
```

---

## 🛑 COMANDI UTILI

### Docker

```bash
make up          # Start containers
make down        # Stop containers
make restart     # Restart containers
make logs        # View logs
make ps          # Container status
make clean       # Remove volumes
```

### Development

```bash
make dev-auth    # Start auth-service
make dev-user    # Start user-service
make install     # Install dependencies
make migrate     # Run migrations
```

### Utilities

```bash
make health      # Check service health
make urls        # Show all URLs
make help        # Show all commands
```

---

## 📁 STRUTTURA PROGETTO

```
Social_Media/
├── auth-service/           # ✅ Authentication service
├── user-service/           # ✅ User management service
├── post-service/           # 🔴 Post management (TODO)
├── media-service/          # 🔴 Media upload (TODO)
├── interaction-service/    # 🔴 Likes/comments (TODO)
├── feed-service/           # 🔴 Feed generation (TODO)
├── notification-service/   # 🔴 Notifications (TODO)
├── search-service/         # 🔴 Search engine (TODO)
├── moderation-service/     # 🔴 Content moderation (TODO)
├── shared/                 # Shared libraries
├── k8s/                    # Kubernetes configs
├── config/                 # Configuration files
├── scripts/                # Setup scripts
├── docs/                   # Documentation
├── docker-compose.yml      # Docker configuration
├── Makefile               # Command shortcuts
├── SETUP_GUIDE.md         # Setup guide
└── QUICK_START.md         # Quick reference
```

---

## 🤝 CONTRIBUTING

1. Fork il repository
2. Crea un feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit le modifiche (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

**Coding Guidelines:**
- TypeScript strict mode
- Unit test coverage > 80%
- Follow existing patterns
- Update documentation

---

## 📄 LICENSE

MIT

---

## 👥 AUTHORS

Development Team

---

## 🆘 SUPPORTO

- 📖 [Setup Guide](./SETUP_GUIDE.md)
- 📝 [Quick Start](./QUICK_START.md)
- 🐛 Issues: GitHub Issues
- 💬 Discussions: GitHub Discussions

---

## ✅ STATUS

| Feature | Status |
|---------|--------|
| Auth Service | ✅ 100% Complete |
| User Service | ✅ 100% Complete |
| MFA/2FA | ✅ Implemented |
| JWT Tokens | ✅ Implemented |
| Database Migrations | ✅ Complete |
| Tests | ✅ 80% Coverage |
| Docker Setup | ✅ Complete |
| Documentation | ✅ Complete |
| Monitoring | ✅ Configured |

**Overall Progress:** 28%

---

**Last Updated:** February 13, 2025  
**Version:** 1.0.0  
**Status:** Active Development
