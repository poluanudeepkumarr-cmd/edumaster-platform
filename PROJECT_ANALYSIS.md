# EduMaster Platform - Comprehensive Project Analysis

## Executive Summary

**EduMaster SSC JE / RRB JE Prep Platform** is a full-stack educational technology platform designed for competitive exam preparation. It's built with a React frontend and Node.js Express backend, supporting 10,000+ concurrent learners with structured courses, mock tests, daily quizzes, live classes, and comprehensive analytics.

**Status**: MVP/Demo-grade with production-ready architecture scaffolding  
**Tech Stack**: React 19, Express.js, TypeScript, PostgreSQL/MongoDB, Redis, Docker, Firebase, Stripe  
**Scale Target**: 10K-100K concurrent learners  
**Current Mode**: Memory-mode fallback with optional MongoDB/PostgreSQL/Redis support

---

## 1. Project Structure Overview

```
├── Root (React + Express server)
│   ├── server.ts (Vite + Express integration)
│   ├── src/ (React Frontend)
│   ├── dist/ (Built frontend)
│   └── vite.config.ts
│
├── backend/ (Express API Layer)
│   ├── server.cjs (Main API server)
│   ├── auth/ (JWT, sessions, login/register/logout)
│   ├── user/ (Profile, progress, analytics)
│   ├── course/ (Course catalog, lessons, hierarchy)
│   ├── test/ (Mock tests, scoring, results)
│   ├── quiz/ (Daily quiz, leaderboard, streaks)
│   ├── live/ (Live classes, replay, chat, doubts)
│   ├── analytics/ (Performance metrics, leaderboard)
│   ├── engagement/ (Gamification, streaks, referrals)
│   ├── payment/ (Checkout, subscriptions, webhooks)
│   ├── admin/ (Content management, seed data)
│   ├── platform/ (Overview, enrollment, watch-progress)
│   ├── notifications/ (Alerts, reminders)
│   ├── middleware/ (Auth, security, rate-limiting)
│   ├── models/ (User, Course, Test data models)
│   └── lib/ (Config, database, health, repositories)
│
└── Infrastructure
    ├── docker-compose.yml (Local dev stack)
    ├── Dockerfile (Production build)
    ├── firestore.rules (Firebase access control)
    └── Documentation (HLD, LLD, API design, deployment)
```

---

## 2. Core Features & Functionality

### 2.1 Authentication & Session Management
- **JWT-based authentication** with token refresh
- **Single active session enforcement** per user/device
- Session rotation on login (previous sessions invalidated)
- Device tracking and activity logging
- Demo credentials: 
  - Student: `student@edumaster.local` / `Student@123`
  - Admin: `admin@edumaster.local` / `Admin@123`

### 2.2 Learning Paths
- **Hierarchical course structure**: Category → Course → Subject → Lesson
- **Lessons** include:
  - YouTube video lectures
  - Premium video URLs (gated content)
  - PDF notes and study materials
  - Duration tracking
  - Watch history and progress (%)
- **Structured learning** with resume capability
- **Premium access control** for locked lessons

### 2.3 Assessment Engine
#### Mock Tests
- Full-length, sectional, and topic-wise variants
- **Timer-based** exam simulation
- **Negative marking** support
- **Auto-submit** when time expires
- **Question palette** with answer tracking
- **Scoring algorithm**:
  - Correct: score += marks
  - Incorrect: score -= negative_marking
  - Unanswered: no change
- **Detailed scores**: Accuracy, speed, percentile, rank
- **Analytics**: Weak/strong topic identification

#### Daily Quiz
- One quiz per day
- **Instant results** with streak tracking
- **Leaderboard** (daily + weekly)
- **Points accumulation** for engagement
- Auto-fetch from platform overview API

### 2.4 Live Classes
- Live class catalog with room URLs
- **Replay links** for recordings
- **Live chat** with message posting
- **Doubt threads** for Q&A
- REST API for chat (WebSocket planned)
- Integration with Zoom/Agora (architectural readiness)

### 2.5 Performance Analytics
- **User dashboard** with:
  - Quiz analytics (questions attempted, accuracy, streaks)
  - Test analytics (performance trends, weak topics)
  - Trend charts (Recharts integration)
- **Leaderboard** - global + topic-based ranking
- **AI Coach** (Gemini API integration)
  - Personalized doubt solving
  - Study recommendations
- **Admin analytics** - user activity, revenue, participation

### 2.6 Gamification & Engagement
- **Streaks** - daily quiz participation tracking
- **Reward points** - earned through quiz/test attempts
- **Badges** - achievement system (modeled)
- **Referral program** - referrer + referred tracking
- **Notifications** - reminders, alerts, achievements

### 2.7 Payments & Subscriptions
- **Course purchases** - per-course payment flow
- **Subscription plans** - time-based access (30/90/365 days)
- **Payment simulation** - demo checkout flow
- **Webhook handling** - payment success/failure callbacks
- **Stripe integration** (setup ready, webhook validation modeled)
- **Enrollment activation** - instant access post-payment

### 2.8 Admin Panel
- User management
- Course/test/quiz creation
- Bulk question upload
- Platform analytics dashboard
- Seed data management
- Content moderation

---

## 3. Technology Stack

### Frontend
| Layer | Technology | Purpose |
|-------|-----------|---------|
| **UI Framework** | React 19 | Component-based UI |
| **Styling** | Tailwind CSS 4.1 | Utility-first CSS |
| **Animations** | Framer Motion + motion | Smooth interactions |
| **Charts** | Recharts 3.8 | Performance visualization |
| **Icons** | Lucide React 0.546 | Consistent iconography |
| **HTTP** | Axios 1.14 | API communication |
| **Build** | Vite 6.2 | Fast bundling |
| **Type Safety** | TypeScript 5.8 | Static type checking |
| **State** | React Context API | Auth/session management |
| **Authentication** | Firebase + JWT | User identity |
| **Payment UI** | Stripe React | Checkout integration |

### Backend
| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 22 (Alpine) | Server environment |
| **Framework** | Express 4.18 | REST API |
| **Authentication** | JWT + bcryptjs | Secure auth |
| **Database (Primary)** | MongoDB 7 / PostgreSQL 16 | Data persistence |
| **Database (Optional)** | Firestore | Document store |
| **Cache/Session** | Redis 6+ | Performance + session storage |
| **ORM** | TypeORM 0.3 | Database abstraction |
| **Email/AI** | Google Genai 1.29 | AI coaching |
| **Payments** | Stripe 21.0 | Payment processing |
| **CORS** | cors 2.8 | Cross-origin support |
| **Logging** | Structured (implicit) | Observability |
| **Type Safety** | TypeScript | Static checking |

### Infrastructure
| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Containerization** | Docker + Docker Compose | Local/prod deployment |
| **Base Image** | node:22-alpine | Lightweight runtime |
| **Database Images** | postgres:16-alpine, mongo:7 | Data layers |
| **Cache** | redis image | Session/leaderboard |
| **Frontend Hosting** | Express (dev) / Vercel/CDN (prod) | Asset delivery |
| **Real-time** | WebSocket-ready (planned) | Live interactions |

---

## 4. Database Schema (PostgreSQL Reference)

### Core Tables

**users**
- UUID primary key
- Email (unique), password hash, role (student/admin)
- Avatar, referral code, streak tracking
- Reward points accumulation
- Created/updated timestamps

**user_sessions**
- Single active session per user (deferred unique constraint)
- Device ID, platform, IP, user agent
- Session rotate on new login
- Activity tracking

**device_activity**
- Event logging for audit trails
- Event type + metadata (JSONB)

**categories**
- Exam types (SSC JE, RRB JE, etc.)
- Sort order for display

**courses**
- Hierarchical learning: Category → Course → Subject → Lesson
- Title, slug, exam type, subject, level
- Price, validity period (days)
- Instructor, thumbnails
- Created by (admin), published flag

**subjects & lessons**
- Flattened access for simple queries
- Lesson types: video, quiz, reading
- YouTube/premium video URLs
- Notes PDF URL
- Duration, premium flag

**enrollments**
- User-Course relationship
- Access type (course/subscription)
- Source (payment/referral/admin)
- Expiration tracking

**watch_history**
- Progress tracking per lesson
- Percent complete, seconds watched
- Completion flag

**test_series, tests, questions**
- Test hierarchy: Series → Tests → Questions
- Question metadata: topic, options, correct answer, marks
- Negative marking configuration
- Difficulty indicators

**Other tables**: leaderboards, quiz_responses, payment_records, subscriptions (implied)

---

## 5. API Architecture

### Base Path
- **Development**: `/backend/api/*`
- **Production**: `/api/*`
- **Mount**: Backend Express app under root server

### Major API Endpoints

#### Authentication
```
POST   /backend/api/auth/register      # { name, email, password }
POST   /backend/api/auth/login         # { email, password, device }
GET    /backend/api/auth/session       # Requires Bearer JWT
POST   /backend/api/auth/logout        # Invalidate session
```

#### Platform Overview (Dashboard)
```
GET    /backend/api/platform/overview  # Aggregated dashboard
POST   /backend/api/platform/enroll    # Subscribe to course
POST   /backend/api/platform/watch-progress  # Track lesson progress
POST   /backend/api/platform/seed      # Ensure demo data
```

#### Courses
```
GET    /backend/api/courses            # Course listing
GET    /backend/api/courses/:id        # Course details
GET    /backend/api/courses/:id/lessons  # Flattened lessons
POST   /backend/api/courses            # Admin: create course
```

#### Mock Tests
```
GET    /backend/api/tests              # Test catalog
GET    /backend/api/tests/:id          # Test details
POST   /backend/api/tests              # Admin: create test
POST   /backend/api/tests/:id/submit   # Submit answers + score
```

#### Daily Quiz
```
POST   /backend/api/quiz/create        # Admin: create daily quiz
GET    /backend/api/quiz/daily         # Fetch today's quiz
POST   /backend/api/quiz/submit        # Submit answers
GET    /backend/api/quiz/:quizId/leaderboard  # Leaderboard
```

#### Live Classes
```
GET    /backend/api/live-classes       # Class catalog
GET    /backend/api/live-classes/:id   # Class details + replay
GET    /backend/api/live-classes/:id/chat   # Chat history
POST   /backend/api/live-classes/:id/chat   # Post message
```

#### Analytics & Engagement
```
GET    /backend/api/analytics/leaderboard   # Global leaderboard
GET    /backend/api/users/analytics         # User analytics
GET    /backend/api/engagement/gamification # Streaks, badges
POST   /backend/api/engagement/referral     # Track referrals
```

#### Health & Operations
```
GET    /backend/api/health             # Dependency snapshot
GET    /backend/api/ready              # Readiness probe
GET    /backend/api/live               # Liveness probe
```

---

## 6. Request/Response Flow Examples

### Login Flow
1. User submits email + password + device info
2. Backend validates bcrypt hash
3. Backend rotates previous session (invalidates old JWT)
4. Backend creates new session record
5. JWT token returned
6. Frontend stores JWT in localStorage
7. Subsequent requests include `Authorization: Bearer <jwt>`

### Course Purchase Flow
1. User clicks "Unlock"
2. Frontend initiates Stripe checkout
3. Payment webhook marks transaction `paid`
4. Backend enroll handler grants course access
5. Dashboard refresh shows course in "My Courses"
6. Lessons now accessible

### Mock Test Attempt
1. Frontend opens test player
2. Client-side timer starts
3. User answers questions (any order)
4. On submit or timeout:
   - Answers posted to `/tests/:id/submit`
   - Backend calculates score (positive/negative marks)
   - Backend computes percentile, rank, weak topics
   - Scorecard returned
   - Result stored in database
   - Analytics aggregated

---

## 7. Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│  (App.tsx, AuthContext, EduService, Pages)                 │
└─────────────────┬───────────────────────────────────────────┘
                  │ (REST calls via axios)
                  │
┌─────────────────▼───────────────────────────────────────────┐
│              Root Express Server (server.ts)                │
│  • Mount backend under /backend/api                         │
│  • Serve Vite frontend                                      │
│  • Stripe webhook routes                                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────────┐
│           Backend Express (backend/server.cjs)              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Route Handlers (auth, courses, tests, quiz, etc.)    │ │
│  │  • Middleware: auth, security, rate-limiting         │ │
│  │  • Business logic per domain                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────┬───────────────────────────────────────────┘
                  │
        ┌─────────┼──────────────┐
        │         │              │
┌───────▼──┐ ┌────▼────┐ ┌──────▼───┐
│ Memory   │ │PostgreSQL│ │  Redis   │
│Repository│ │          │ │  Cache   │
└──────────┘ └──────────┘ └──────────┘
```

---

## 8. Runtime Modes

### Development
```bash
npm run dev
# Runs server.ts with hot-reload
# Backend accessible at http://localhost:3000/backend/api
# Frontend at http://localhost:3000
```

### Memory Mode (Fallback)
- No MongoDB/PostgreSQL configured
- In-memory repositories with seeded demo data
- Auto-seeds:
  - Demo users (student, admin)
  - Sample courses (SSC JE + RRB JE)
  - Mock tests with questions
  - Daily quiz
  - Live class recordings

### MongoDB Mode
- Connects to `MONGODB_URI`
- Persists all data in MongoDB
- Seeded on first run

### PostgreSQL/Redis Mode
- Uses Postgres for transactional data
- Redis for:
  - Session cache
  - Leaderboard cache
  - Rate limit tracking
  - Hot dashboard reads

### Production Docker
```yaml
# docker-compose up --build
- App service (Node 22 Alpine)
- MongoDB 7
- PostgreSQL 16
- Redis 6+
- Auto-networking
```

---

## 9. Security Architecture

### Authentication
- **JWT bearer tokens** (stateless, but validated in Redis/session store)
- **Password hashing**: bcryptjs (rounds configurable)
- **Session rotation**: Previous tokens invalidated on new login

### Authorization
- **Role-based access** (student/admin)
- **Protected routes**: Require valid JWT
- **Middleware-enforced**: `auth.js` checks Authorization header

### Network Security
- **CORS configuration**: Restrictable origin
- **Rate limiting**: 300 requests/60s per IP (configurable)
- **Security headers** middleware
- **HTTPS ready**: Trust proxy for reverse proxy

### Data Protection
- **Password hash**: bcryptjs before storage
- **Session tokens**: JWT signed with secret
- **Sensitive configs**: Environment variables
- **Firebase rules**: Firestore access control (firestore.rules)

### Deployment Safety
- **Health/readiness/liveness probes** for monitoring
- **Docker isolation**: App runs as non-root
- **Environment separation**: dev/prod configuration
- **Webhook signature validation** (modeled for Stripe)

---

## 10. Performance & Scalability

### Current Optimizations
- **Vite**: Fast frontend bundling
- **React Context**: Lightweight state (no Redux overhead)
- **Tailwind**: CSS-in-JS efficiency
- **Stateless API**: Horizontal scaling ready
- **Session abstraction**: Redis-ready architecture

### Scalability Target (10K-100K learners)

**Frontend Scale**
- CDN for static assets
- Lazy-loaded routes
- Code splitting
- Responsive images

**API Scale**
- Stateless Express instances behind load balancer
- Horizontal pod autoscaling on CPU/memory/RPS
- Connection pooling for databases

**Data Scale**
- PostgreSQL primary for ACID guarantees
- Read replicas for dashboard queries
- Firestore for flexible document store
- Redis for hot paths (session, leaderboard, cache)

**Storage Scale**
- S3/object storage for media (notes, recordings)
- CDN for thumbnail delivery
- Signed URLs for premium content

**Real-time Scale**
- WebSocket gateway for live chat
- Agora/Zoom SDK for video rooms
- Redis pub/sub for presence/notifications

---

## 11. Current Implementation Status

### ✅ Fully Implemented
- JWT auth + session management
- Course hierarchy + lesson streaming
- Mock test player + scoring engine
- Daily quiz + leaderboard
- Performance analytics + charts
- Live class catalog + replay URLs
- Payment simulation + webhook flow
- Admin panel + seed data
- Docker scaffolding
- Health/readiness probes
- Firestore rules (Firebase integration ready)

### 🟡 Partially Implemented
- Stripe integration (model exists, not fully wired for production)
- Live class video (URLs embedded, WebSocket not yet active)
- Real-time chat (REST-based, WebSocket planned)
- Kubernetes deployment (architecture documented, manifests not included)
- Load testing (not included in repo)

### ❌ Not Yet Implemented
- Production Stripe webhook verification
- Real WebSocket server for live chat
- S3 integration (documented, not coded)
- CDN configuration
- Kubernetes manifests
- Load testing suite
- Distributed tracing setup

---

## 12. Recommended Production Steps

### Phase 1: Data Persistence
1. **Replace in-memory** repositories with PostgreSQL ORM queries
2. **Move session storage** to Redis (with fallback to DB)
3. **Implement leaderboard cache** in Redis
4. **Add database migrations** for schema versioning

### Phase 2: Real-time & Payments
1. **Complete Stripe integration**
   - Verify webhook signatures
   - Handle webhook retries
   - Track payment lifecycle
2. **Implement WebSocket**
   - Live chat server
   - Presence tracking
   - Notification fan-out

### Phase 3: Storage & Delivery
1. **Configure S3** for media uploads
2. **Set up CloudFront/CDN** for distribution
3. **Implement signed URLs** for premium content
4. **Add transcoding** for video recordings

### Phase 4: Deployment
1. **Kubernetes manifests** (Helm charts)
2. **Load testing** (k6, Apache Bench)
3. **CI/CD pipelines** (GitHub Actions, GitLab CI)
4. **Observability stack** (Prometheus, Grafana, ELK)
5. **Disaster recovery** (backup, failover)

### Phase 5: Scaling & Analytics
1. **Analytics workers** (async processing for rankings)
2. **Recommendation engine** (ML-based suggestions)
3. **Search optimization** (Elasticsearch for courses)
4. **APM setup** (Application Performance Monitoring)

---

## 13. File Organization & Key Imports

### Frontend Entry Point: [src/main.tsx](src/main.tsx)
```typescript
import { AuthProvider } from './AuthContext'
import { useAuth } from './AuthContext'
import { EduService } from './EduService'
```

### Key Frontend Files
- [src/App.tsx](src/App.tsx) - Main UI component & routing
- [src/AuthContext.tsx](src/AuthContext.tsx) - JWT + session management
- [src/EduService.ts](src/EduService.ts) - API client wrapper
- [src/types.ts](src/types.ts) - TypeScript interfaces

### Backend Entry Point: [backend/server.cjs](backend/server.cjs)
```javascript
const { connectDatabase } = require('./lib/database.js')
const authRoutes = require('./auth/auth.routes.js')
const courseRoutes = require('./course/course.routes.js')
// ... more routes
```

### Database: [DB_SCHEMA.sql](DB_SCHEMA.sql)
PostgreSQL reference schema with normalized tables

---

## 14. Configuration & Environment

### Key Environment Variables
```bash
NODE_ENV=development                    # dev/production
PORT=3000                               # Server port
MONGODB_URI=                            # MongoDB connection (optional)
POSTGRES_URL=                           # PostgreSQL (optional)
REDIS_URL=                              # Redis (optional)
JWT_SECRET=dev-secret                   # JWT signing key
STRIPE_SECRET_KEY=                      # Stripe API key
VITE_STRIPE_PUBLISHABLE_KEY=            # Stripe public key
GEMINI_API_KEY=                         # Google AI API key
S3_BUCKET=                              # S3 bucket name
S3_REGION=                              # AWS region
CORS_ORIGIN=http://localhost:3000      # CORS allowed origin
```

### Docker Environment ([docker-compose.yml](docker-compose.yml))
Provides MongoDB, PostgreSQL, Redis out of the box

---

## 15. Developer Experience

### Local Development
```bash
# Install
npm install
npm --prefix backend install

# Run
npm run dev          # Development mode with HMR
PORT=3100 npm run dev  # If port 3000 in use

# Build
npm run build        # Vite build
npm run lint         # TypeScript check

# Test
npm run test:api     # Smoke test backend
```

### Docker Development
```bash
docker compose up --build
# Runs on http://localhost:3000
# MongoDB, PostgreSQL, Redis included
```

### Debugging
- **Console logging** in backend for development
- **React DevTools** browser extension
- **Network tab** for API tracing
- **Health endpoints** for system diagnostics

---

## 16. Testing & Verification

### Manual Testing
- [backend/test-api.js](backend/test-api.js) - API smoke tests
- Login with demo credentials
- Course browsing + enrollment
- Mock test + scoring
- Quiz submission + leaderboard

### Test Coverage (Current)
- API integration smoke tests
- Demo data seeding
- Manual QA flows

### Missing (Recommended)
- Unit tests (Jest/Mocha)
- Integration tests (Supertest)
- E2E tests (Cypress/Playwright)
- Load testing (k6/Apache Bench)

---

## 17. Deployment Architecture

### Local (Docker Compose)
```
docker-compose.yml
├── app (Node 22 Alpine)
├── mongo (MongoDB 7)
├── postgres (PostgreSQL 16)
└── redis (Redis)
```

### Target Production (10K-100K scale)
```
CDN (CloudFront)
├── Frontend bundle
├── Thumbnails
└── Recordings
        │
    API Gateway / WAF / Rate Limiter
        │
    Load Balancer
        │
    ┌───┴───┐
    │       │
  API    API    API   (Stateless pod cluster)
  Pod    Pod    Pod   (Horizontal autoscaling)
    │       │
    └───┬───┘
        │
    ┌───┴────────┬──────────┐
    │            │          │
PostgreSQL   Redis      Firestore
Primary      Cache      (optional)
    │
Read Replicas
```

---

## 18. Documentation Artifacts

All analysis documents included in repository:
- [HLD_LLD.md](HLD_LLD.md) - High/Low level design
- [API_DESIGN.md](API_DESIGN.md) - REST endpoint specifications
- [DB_SCHEMA.sql](DB_SCHEMA.sql) - Database schema reference
- [TEST_ENGINE_LOGIC.md](TEST_ENGINE_LOGIC.md) - Scoring algorithm
- [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md) - Production setup
- [USER_FLOW.md](USER_FLOW.md) - Core user journeys
- [REQUIREMENT_COVERAGE.md](REQUIREMENT_COVERAGE.md) - Feature checklist

---

## 19. Project Health Checklist

| Aspect | Status | Notes |
|--------|--------|-------|
| **Functionality** | ✅ MVP Complete | All core features working |
| **Code Quality** | 🟡 Good | TypeScript adopted, but limited tests |
| **Documentation** | ✅ Excellent | Comprehensive architecture docs |
| **Scalability** | 🟡 Designed for Scale | Memory mode fallback limits current throughput |
| **Security** | 🟡 Good Basics | JWT + bcrypt, but webhook verification incomplete |
| **Testing** | ❌ Minimal | Smoke tests only, no unit/integration tests |
| **DevOps** | 🟡 Partial | Docker exists, K8s manifests missing |
| **Performance** | 🟡 Good Dev Experience | Need CDN + cache tuning for production |

---

## 20. Quick Start

### Run Locally (Memory Mode)
```bash
git clone <repo>
cd remix_-edumaster_-ssc-&-rrb-je-prep-platform
npm install && npm --prefix backend install
npm run dev
# Open http://localhost:3000
# Login: student@edumaster.local / Student@123
```

### Run with Docker Stack
```bash
docker compose up --build
# All services auto-starting
# MongoDB, Postgres, Redis automatically provisioned
```

### Deploy to Production
1. Set environment variables (JWT_SECRET, STRIPE keys, etc.)
2. Build Docker image
3. Push to registry
4. Deploy to Kubernetes (manifests needed)
5. Configure CDN + WAF
6. Verify health endpoints

---

## Conclusion

EduMaster is a **feature-rich, well-documented MVP** for a competitive exam preparation platform. The architecture is **production-ready and scalable**, with clear separation of concerns between frontend, API, and data layers. The main gaps are in **real-time functionality** (WebSocket), **production payment processing**, and **comprehensive testing**. With the Phase 1-5 recommendations implemented, this platform can scale to support 100K+ concurrent learners on major cloud providers.

