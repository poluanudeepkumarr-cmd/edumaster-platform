# HLD + LLD

## 1. High-Level Design

### Product objective

Build a **mobile-first SSC JE / RRB JE preparation platform** that supports:

- 10,000+ concurrent learners
- structured courses and premium lessons
- mock tests and daily quizzes
- live classes and replay
- performance analytics and AI guidance
- admin operations, notifications, referrals, and payments

### Major building blocks

1. **Presentation layer**
   - React app rendered from the root server
   - responsive navigation for overview, courses, tests, quiz, live, analytics, plans, admin
   - same-origin API consumption through `/backend/api`

2. **Application/API layer**
   - Express backend with domain routes
   - JWT auth and session validation
   - platform aggregation endpoint for dashboard hydration
   - test/quiz scoring engine

3. **Data layer**
   - current local mode: in-memory repository with seeded demo data
   - target production mode: PostgreSQL + Firestore/document store hybrid or PostgreSQL-only normalized design
   - Redis for leaderboard/session/cache acceleration

4. **Real-time layer**
   - WebSocket/Agora/Zoom/RTC integration for live classes, chat, alerts

5. **Payments and content delivery**
   - Stripe/Razorpay checkout + webhook
   - S3/CDN for notes, thumbnails, recordings, premium content

### Core services

- Auth & session service
- Course catalog and entitlement service
- Test engine service
- Daily quiz service
- Analytics/recommendation service
- Notification/engagement service
- Live class scheduling service
- Payment/subscription service
- Admin content operations service

### Scalability model

- stateless API instances behind load balancer
- CDN for static assets and thumbnails
- Redis for hot read paths
- async workers for ranking, analytics rollups, notifications, webhook retries
- partitioning/sharding by tenant/exam cohort at larger scale

---

## 2. Low-Level Design

### Frontend module map

- `AuthContext`
  - stores JWT-backed user session
  - restores session from `/backend/api/auth/session`
- `EduService`
  - fetch wrapper for same-origin backend APIs
  - handles login, register, overview, quiz/test submission, payments, AI, admin
- `App.tsx`
  - renders product shell
  - switches among overview, courses, tests, quiz, live, analytics, plans, admin

### Backend module map

- `auth`
  - register/login/logout/session
  - single active session enforcement via session token stored on user
- `user`
  - profile, progress, analytics
- `course`
  - course list, details, flattened lesson access
- `test`
  - catalog, detail, submission, scoring
- `quiz`
  - daily quiz creation, fetch, submission, leaderboard
- `live`
  - live class catalog, replay access, chat, doubt threads
- `analytics`
  - leaderboard and user insight aggregation
- `notifications`
  - reminders and alerts
- `engagement`
  - streaks, badges, referrals
- `payment`
  - checkout record + retry + webhook handling
- `admin`
  - platform analytics, bulk question upload, seed data
- `platform`
  - unified overview, enrollment, subscription activation, watch progress, AI coaching

### Request flow examples

#### Login

1. React form posts to `/backend/api/auth/login`
2. backend validates bcrypt password
3. backend rotates any previous session so only one active session remains valid
4. backend writes `session` + `device` on user
5. JWT is returned and stored in local storage

#### Course unlock

1. user clicks unlock
2. frontend triggers payment checkout simulation
3. webhook marks payment as `paid`
4. platform enrollment route grants course access
5. next dashboard refresh shows entitlement and resume state

#### Mock test attempt

1. frontend opens test player with timer
2. answers are posted to `/backend/api/tests/:id/submit`
3. backend calculates score, negative marking, weak/strong topics, percentile, rank
4. result is stored and reflected in analytics/dashboard

#### Daily quiz

1. frontend fetches today’s quiz from platform overview
2. answers are posted to `/backend/api/quiz/submit`
3. backend updates leaderboard, streak, and points
4. notifications and analytics can react to the attempt

#### Live class interaction

1. frontend reads live classes from the overview and `/backend/api/live-classes`
2. learner opens a class and fetches its chat thread
3. learner posts chat or a doubt to `/backend/api/live-classes/:id/chat`
4. replay and room URLs are exposed to the mobile-first UI

### Domain entity relationships

- User 1..N UserSession
- User 1..N DeviceActivity
- Category 1..N Course
- Course 1..N Subject
- Subject 1..N Lesson
- User N..N Course via Enrollment
- Course/TestSeries 1..N Test
- Test 1..N Question
- User 1..N TestAttempt
- User 1..N QuizAttempt
- User 1..N Notification
- User 1..N Referral
- User 1..N Payment
- SubscriptionPlan 1..N Subscription
- LiveClass 1..N LiveChatMessage

### Non-functional requirements

- JWT validation on all protected APIs
- single-device/single-session enforcement
- idempotent payment webhook handling
- retry-safe notification jobs
- low-latency leaderboard cache
- event-driven analytics rollups
- auditability for admin actions

### Current implementation note

The repo currently ships a **working integrated demo architecture**:

- frontend and backend are connected
- backend auto-seeds demo data in memory mode
- docs below describe the production-ready target shape for scaling beyond the local demo
