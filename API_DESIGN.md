# API Design

## API topology

- Frontend dev/runtime entrypoint: `server.ts`
- Backend mount path in the integrated app: `/backend/api/*`
- In standalone backend mode the same routes exist under `/api/*`

## 1. Auth

- `POST /backend/api/auth/register`
  - body: `name, email, password`
  - returns: `user, token` through follow-up login in the frontend flow
- `POST /backend/api/auth/login`
  - body: `email, password, device`
  - returns: `token, user`
- `GET /backend/api/auth/session`
  - header: `Authorization: Bearer <jwt>`
  - returns: current authenticated user
- `POST /backend/api/auth/logout`
  - invalidates the active session

## 1A. Runtime health

- `GET /backend/api/health`
  - aggregate dependency snapshot for Mongo, Postgres, Redis, storage, and payments
- `GET /backend/api/ready`
  - readiness probe for container/load balancer use
- `GET /backend/api/live`
  - lightweight liveness probe

## 2. Platform overview

- `GET /backend/api/platform/overview`
  - aggregated dashboard response
  - includes highlights, dashboard stats, courses, tests, daily quiz, live classes, analytics, subscriptions, admin overview
- `POST /backend/api/platform/seed`
  - ensures sample platform data exists in memory mode

## 3. User, analytics, and engagement

- `GET /backend/api/users/profile`
- `GET /backend/api/users/progress`
- `GET /backend/api/users/analytics`
- `GET /backend/api/analytics/user`
- `GET /backend/api/analytics/leaderboard`
- `GET /backend/api/engagement/gamification?userId=<id>`
- `POST /backend/api/engagement/referral`
  - body: `referrerUserId, referredEmail`

## 4. Courses and learning

- `GET /backend/api/courses`
- `GET /backend/api/courses/:id`
- `GET /backend/api/courses/:id/lessons`
  - flattened lessons from module hierarchy
- `POST /backend/api/courses`
  - admin/content creation
- `POST /backend/api/platform/enroll`
  - protected
  - body: `courseId, source, accessType`
- `POST /backend/api/platform/watch-progress`
  - protected
  - body: `courseId, lessonId, progressPercent, progressSeconds, completed`

## 5. Mock tests

- `GET /backend/api/tests`
- `GET /backend/api/tests/:id`
- `POST /backend/api/tests`
- `POST /backend/api/tests/:id/submit`
  - body: `answers, startedAt`
  - returns: scorecard payload including rank/percentile/weak topics

## 6. Daily quiz

- `POST /backend/api/quiz/create`
- `GET /backend/api/quiz/daily`
- `POST /backend/api/quiz/submit`
  - body: `quizId, answers[]`
  - auth: required
- `GET /backend/api/quiz/:quizId/leaderboard`

## 7. Live classes

Current demo delivery is included in `platform/overview`, and the repo now exposes a working live-class API surface:

- `GET /backend/api/live-classes`
- `GET /backend/api/live-classes/:id`
- `GET /backend/api/live-classes/:id/chat`
- `POST /backend/api/live-classes/:id/chat`
  - body: `message, kind`
  - auth: required

## 8. Notifications

- `GET /backend/api/notifications?userId=<id>`
- `POST /backend/api/notifications/send`

## 9. Payments and subscriptions

- `POST /backend/api/payment/checkout`
  - body: `amount, currency, item`
  - auth: required
- `POST /backend/api/payment/:paymentId/retry`
  - auth: required
- `POST /backend/api/payment/webhook`
  - body: webhook payload
- `POST /backend/api/platform/subscribe`
  - body: `planId, source`
  - auth: required

Root server helpers:

- `POST /api/create-checkout-session`
- `GET /api/verify-session/:sessionId`

## 10. AI features

- `POST /backend/api/platform/ai/ask`
  - protected
  - body: `message`
  - returns: AI answer object

## 11. Admin

- `GET /backend/api/admin/users`
- `GET /backend/api/admin/courses`
- `GET /backend/api/admin/tests`
- `GET /backend/api/admin/analytics`
- `POST /backend/api/admin/upload-questions`
- `POST /backend/api/admin/seed-sample-data`

## Response design principles

- JSON-only responses
- clear resource IDs
- safe user payloads without password leakage
- protected routes require JWT
- admin routes are role-gated
- payment and webhook routes should be idempotent
