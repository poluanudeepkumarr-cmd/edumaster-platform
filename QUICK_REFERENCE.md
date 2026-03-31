# EduMaster Platform - Quick Reference Guide

## 🚀 Quick Start Commands

```bash
# Development Mode
npm install && npm --prefix backend install
npm run dev
# Open: http://localhost:3000

# Docker Mode
docker compose up --build
# Includes: MongoDB, PostgreSQL, Redis

# Production Build
npm run build
docker build -t edumaster:latest .

# API Tests
node backend/test-api.js
```

## 📋 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Student** | `student@edumaster.local` | `Student@123` |
| **Admin** | `admin@edumaster.local` | `Admin@123` |

---

## 📦 Project Structure at a Glance

```
root/
├── src/                      # React app (TypeScript)
│   ├── App.tsx              # Main UI shell
│   ├── AuthContext.tsx      # JWT + session management
│   ├── EduService.ts        # API client wrapper
│   └── pages/               # Feature modules
├── backend/                 # Express API (Node.js)
│   ├── auth/                # JWT, login/logout
│   ├── courses/             # Catalog, lessons
│   ├── tests/               # Mock tests, scoring
│   ├── quiz/                # Daily quiz, leaderboard
│   ├── analytics/           # Performance metrics
│   ├── payment/             # Stripe integration
│   ├── admin/               # Content management
│   ├── platform/            # Overview, enrollment
│   ├── middleware/          # Auth, security, rate-limit
│   └── lib/                 # Config, database, health
├── server.ts                # Root Vite + Express
├── vite.config.ts           # Frontend bundler config
├── docker-compose.yml       # Local dev stack config
└── Documentation/           # HLD, LLD, API, DB schema
```

---

## 🛠️ Technology Stack Summary

### Frontend
- **React 19** - UI framework
- **TypeScript 5.8** - Type safety
- **Tailwind CSS 4.1** - Styling
- **Framer Motion** - Animations
- **Recharts** - Charts
- **Axios** - HTTP client
- **Vite 6.2** - Build tool

### Backend
- **Node.js 22 (Alpine)** - Runtime
- **Express 4.18** - REST API
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **TypeORM 0.3** - Database ORM
- **MongoDB/PostgreSQL** - Databases
- **Redis** - Cache/sessions
- **Stripe** - Payments
- **Google Genai** - AI coaching

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Local stack orchestration
- **PostgreSQL 16** - Primary database
- **MongoDB 7** - Document store
- **Redis** - Cache layer

---

## 🔌 Key API Endpoints

### Authentication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/backend/api/auth/register` | Create account |
| POST | `/backend/api/auth/login` | Get JWT token |
| GET | `/backend/api/auth/session` | Restore session |
| POST | `/backend/api/auth/logout` | Invalidate token |

### Learning
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/backend/api/courses` | List all courses |
| GET | `/backend/api/courses/:id` | Course details |
| GET | `/backend/api/courses/:id/lessons` | Lessons in course |
| POST | `/backend/api/platform/watch-progress` | Track lesson progress |

### Assessment
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/backend/api/tests` | List mock tests |
| POST | `/backend/api/tests/:id/submit` | Submit test answers |
| GET | `/backend/api/quiz/daily` | Today's quiz |
| POST | `/backend/api/quiz/submit` | Submit quiz answers |
| GET | `/backend/api/quiz/:id/leaderboard` | Quiz rankings |

### Live Classes
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/backend/api/live-classes` | Class catalog |
| GET | `/backend/api/live-classes/:id/chat` | Fetch chat |
| POST | `/backend/api/live-classes/:id/chat` | Post message |

### Analytics & Commerce
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/backend/api/analytics/leaderboard` | Global rankings |
| GET | `/backend/api/users/analytics` | User performance |
| POST | `/backend/api/platform/enroll` | Subscribe to course |
| GET | `/backend/api/platform/overview` | Dashboard data |

### Operations
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/backend/api/health` | Dependency check |
| GET | `/backend/api/ready` | Readiness probe |
| GET | `/backend/api/live` | Liveness probe |

---

## 🗂️ Database Schema Highlights

### Core Tables
```
users                    # Core identity
├── id (UUID)
├── email (UNIQUE)
├── password_hash
├── role (student/admin)
├── streak_days
└── reward_points

courses                  # Learning content
├── id (UUID)
├── category_id
├── title, slug
├── exam, subject, level
├── price_inr
└── validity_days

tests                    # Mock exams
├── id (UUID)
├── title, exam, test_type
├── duration_minutes
├── total_marks
├── negative_marking
└── questions (1-to-many)

enrollments              # User-Course access
├── user_id
├── course_id
├── access_type
├── expires_at
└── UNIQUE(user_id, course_id)

watch_history            # Progress tracking
├── user_id
├── lesson_id
├── progress_percent
└── completed
```

---

## 🔒 Security Features

| Feature | Implementation |
|---------|-----------------|
| **Authentication** | JWT bearer tokens (signed with `JWT_SECRET`) |
| **Password** | bcryptjs hashing (salted) |
| **Session** | Single active session per user (rotation on login) |
| **Authorization** | Role-based (student/admin) middleware |
| **Rate Limiting** | 300 requests/60s per IP |
| **CORS** | Configurable origin restriction |
| **HTTPS** | Trust proxy ready for reverse proxy |
| **Headers** | Security headers middleware |
| **Webhook** | Stripe signature validation (modeled) |

---

## 🎯 Feature Completeness Matrix

| Feature | Status | Notes |
|---------|--------|-------|
| Course browsing | ✅ 100% | Hierarchy + lessons |
| Mock tests | ✅ 100% | Scoring + percentile |
| Daily quiz | ✅ 100% | Leaderboard + streaks |
| Live classes | ✅ 100% | Chat + replay URLs |
| Payments | 🟡 80% | Stripe model, webhook incomplete |
| Analytics | ✅ 100% | Charts + leaderboard |
| Admin panel | ✅ 100% | Content + seed data |
| Authentication | ✅ 100% | JWT + single session |
| AI coaching | ✅ 100% | Gemini integration |
| WebSocket chat | ❌ 0% | Modeled, not implemented |
| S3 storage | ❌ 0% | Architecture ready |
| Kubernetes deploy | ❌ 0% | Manifests not included |

---

## 📊 Performance Targets

### Current (Dev/Memory Mode)
- Throughput: ~100 RPS per instance
- Latency: 50-200ms (network variable)
- Concurrent: ~1000 users (memory limited)

### Target (Production)
- Throughput: ~1000 RPS per pod
- Latency: 20-100ms (with caching)
- Concurrent: 10K-100K users (via horizontal scaling)

### Optimization Strategy
1. **Frontend**: CDN + code splitting + lazy loading
2. **API**: Stateless instances + load balancer
3. **Cache**: Redis for sessions + leaderboard
4. **DB**: PostgreSQL primary + read replicas
5. **Storage**: S3 + CloudFront for media

---

## 🔧 Environment Configuration

### Essential Variables
```bash
# Server
NODE_ENV=development
PORT=3000
JWT_SECRET=your-secret-here

# Databases (optional - falls back to memory)
MONGODB_URI=mongodb://mongo:27017/edumaster
POSTGRES_URL=postgresql://user:pass@host:5432/edumaster
REDIS_URL=redis://redis:6379

# Payments
STRIPE_SECRET_KEY=sk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# AI & Storage
GEMINI_API_KEY=your-api-key
S3_BUCKET=mybucket
S3_REGION=us-east-1

# Security
CORS_ORIGIN=http://localhost:3000
TRUST_PROXY=true
```

---

## 🧪 Testing Checklist

- [ ] Login with student credentials
- [ ] Browse available courses
- [ ] Enroll in a free course
- [ ] Watch a lesson (check progress)
- [ ] Take a mock test (verify scoring)
- [ ] Submit daily quiz (verify leaderboard)
- [ ] View analytics dashboard
- [ ] Check live class catalog
- [ ] View profile & analytics
- [ ] Admin: Upload mock course
- [ ] Admin: View platform metrics

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Set all required environment variables
- [ ] Update `JWT_SECRET` to strong value
- [ ] Configure Stripe API keys
- [ ] Set up PostgreSQL database
- [ ] Configure Redis instance
- [ ] Backup database credentials

### Deployment
- [ ] Build Docker image
- [ ] Push to container registry
- [ ] Deploy to Kubernetes (or Docker Swarm)
- [ ] Run database migrations
- [ ] Verify health endpoints
- [ ] Set up CDN for static assets
- [ ] Configure WAF + rate limiting
- [ ] Enable HTTPS

### Post-Deployment
- [ ] Monitor health endpoints
- [ ] Check error logs
- [ ] Verify payment webhook
- [ ] Test user auth flow
- [ ] Load test API endpoints
- [ ] Monitor infrastructure metrics

---

## 📚 Documentation Map

| Document | Purpose |
|----------|---------|
| [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) | This comprehensive analysis |
| [README.md](README.md) | Project overview + quick start |
| [HLD_LLD.md](HLD_LLD.md) | Architecture design document |
| [API_DESIGN.md](API_DESIGN.md) | REST endpoint specifications |
| [DB_SCHEMA.sql](DB_SCHEMA.sql) | PostgreSQL schema reference |
| [TEST_ENGINE_LOGIC.md](TEST_ENGINE_LOGIC.md) | Scoring algorithm details |
| [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md) | Production deployment topology |
| [USER_FLOW.md](USER_FLOW.md) | User journey descriptions |
| [REQUIREMENT_COVERAGE.md](REQUIREMENT_COVERAGE.md) | Feature checklist |

---

## 🔗 External Integrations

| Service | Purpose | Status |
|---------|---------|--------|
| **Firebase** | User authentication + Firestore | Ready (rules defined) |
| **Stripe** | Payment processing | Partial (model exists) |
| **Google Gemini** | AI coaching | Ready |
| **Zoom/Agora** | Video conferencing | Architecture ready |
| **AWS S3** | Media storage | Architecture ready |
| **CloudFront** | CDN delivery | Architecture ready |

---

## 🎓 Module Descriptions

### Auth Module (`backend/auth/`)
- Handles registration, login, session management
- Uses JWT for stateless auth
- Session rotation prevents multi-device access

### Course Module (`backend/course/`)
- Manages course hierarchy (category → course → subject → lesson)
- Tracks lesson progress and watch history
- Enforces premium access control

### Test Module (`backend/test/`)
- Full-length, sectional, topic-wise test variants
- Implements scoring engine with negative marking
- Calculates rank/percentile against all users
- Identifies weak/strong topics

### Quiz Module (`backend/quiz/`)
- One daily quiz per platform
- Tracks user attempts and streaks
- Maintains leaderboard (daily + weekly)
- Awards points for participation

### Platform Module (`backend/platform/`)
- Aggregates overview data for dashboard
- Handles course enrollment
- Tracks watch progress across all lessons
- Central "dashboard hydration" endpoint

### Analytics Module (`backend/analytics/`)
- Computes user performance metrics
- Maintains global leaderboard
- Tracks weak/strong topics
- Generates trend data for charts

### Payment Module (`backend/payment/`)
- Checkout session creation
- Webhook handling for payment events
- Enrollment activation on payment success
- Retry logic for failed payments

### Admin Module (`backend/admin/`)
- Content management (courses, tests, quizzes)
- Bulk question upload
- Platform analytics and metrics
- Seed data generation

---

## 🎯 Next Steps Priority Matrix

### High Priority (Phase 1)
- [ ] Switch to PostgreSQL for production
- [ ] Move sessions to Redis
- [ ] Add comprehensive unit tests
- [ ] Complete Stripe webhook verification

### Medium Priority (Phase 2)
- [ ] Implement WebSocket for live chat
- [ ] Set up S3 for media storage
- [ ] Add Kubernetes manifests
- [ ] Create load test suite

### Low Priority (Phase 3)
- [ ] Add Elasticsearch for search
- [ ] Implement ML recommendations
- [ ] Set up distributed tracing
- [ ] Build admin dashboard enhancements

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| **Port 3000 in use** | `PORT=3100 npm run dev` |
| **MongoDB connection fails** | Platform falls back to memory mode |
| **CORS errors** | Check `CORS_ORIGIN` environment variable |
| **JWT token expired** | Refresh session via `/auth/session` endpoint |
| **Test score calculation incorrect** | Verify negative marking in test config |
| **Docker image too large** | Use Alpine base (already configured) |
| **Database migrations missing** | Run PostgreSQL schema before deploy |

---

## 📞 Support & Resources

- **Architecture Docs**: See documentation artifacts section
- **Demo Credentials**: Student or Admin accounts in section 2
- **API Testing**: Run `node backend/test-api.js`
- **Health Check**: `curl http://localhost:3000/backend/api/health`
- **Docker Issues**: Check `docker compose logs`

---

## 📈 Scalability Path

```
Phase 1: MVP (Current)
├── Single instance
├── Memory repositories
└── SQLite / In-Memory DB

→ Phase 2: Scale to 1K users
├── PostgreSQL + Redis
├── Docker Compose
└── Monolithic deployment

→ Phase 3: Scale to 10K users
├── API pod cluster (5-10 pods)
├── RDS multi-AZ
├── ElastiCache
└── CloudFront + S3

→ Phase 4: Scale to 100K+ users
├── Kubernetes cluster
├── Database read replicas
├── Message queue (SQS/Kafka)
├── Analytics workers
└── Global CDN network
```

---

**Last Updated**: 2026-03-30  
**Project Status**: MVP with production-ready architecture  
**Scale Target**: 10K-100K concurrent learners  
**Tech Stack**: React 19 + Express.js + PostgreSQL/MongoDB + Redis

