# Requirement Coverage

This file maps the requested SSC JE / RRB JE prep-platform requirements to the current repository state.

## Fully represented in the working demo

- Authentication with JWT-backed session restore
- Single active session per user through session rotation and token invalidation
- Student and admin roles
- Login session and device activity tracking
- Structured learning hierarchy using category, course, subject, module, and lesson metadata
- Curated YouTube lecture sources for current SSC JE / RRB JE seed courses plus premium lesson locking and PDF notes
- Continue watching, watch history, and course progress
- Full-length, sectional, and topic-wise mock tests
- Timer-based exam player, negative marking, auto-submit, scorecard, rank, percentile, and explanations
- Daily quiz with instant result, streaks, daily leaderboard, and weekly leaderboard
- Performance analytics with accuracy, speed, weak/strong topics, chart-based trend, and recommendations
- YouTube embed support, playback speed selector, official channel links, and premium locking
- Live class listing, replay links, live chat, and doubt thread posting
- Payment checkout simulation, failure handling, retry flow, course purchase flow, and subscription activation flow
- Secure token validation on protected APIs
- Admin management for users, courses, tests, quizzes, mock tests, bulk question upload, and seed data
- Push-style notification records, points, badges, streaks, referrals, AI doubt solving, and adaptive test suggestions
- HLD, LLD, database schema, API design, test engine logic, deployment architecture, and user flow artifacts
- Docker-based local deployment scaffolding and backend health/readiness/liveness endpoints

## Modeled in code/docs but still demo-grade

- Stripe / Razorpay are modeled through the payment service and root-server Stripe helper, but not fully wired as production payment providers end to end
- Live classes are modeled with room/replay URLs and chat APIs, but not yet backed by real WebRTC/Zoom/Agora SDK sessions
- Redis, PostgreSQL/Firestore, S3, WebSockets, Kubernetes, CDN, and load balancer architecture are documented as target production layers; Docker and dependency health scaffolding now exist, but the local default runtime still uses in-memory repositories when no real database is configured
- 10K-100K scale readiness is represented in architecture and stateless API design, but not load-tested inside this local repo

## Recommended next production steps

1. Replace in-memory repositories with PostgreSQL plus Redis-backed session/leaderboard storage.
2. Move live-class chat/presence to a real WebSocket or managed RTC layer.
3. Complete real Stripe/Razorpay checkout and verified webhook signature handling.
4. Store premium assets and recordings in S3-compatible storage with signed URLs.
5. Add load tests and deployment manifests for the 10K+ concurrency target.
