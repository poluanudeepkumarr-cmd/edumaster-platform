# EduMaster SSC JE / RRB JE Prep Platform

This repository now contains an integrated prep-platform demo for **SSC JE / RRB JE** with:

- backend JWT auth with single-session style enforcement
- structured courses with lessons, premium locks, and watch progress
- timer-based mock tests with negative marking and scorecards
- daily quiz, streaks, leaderboard, and engagement loops
- live classes with replay links, chat, and doubt threads
- analytics, payments, subscriptions, referrals, and AI coaching
- admin seed, course creation, quiz/mock creation, and bulk question upload flows
- production-oriented runtime scaffolding for health, Docker, Postgres/Redis config, and safer API defaults

The React app runs through the root server and mounts the backend under **`/backend/api`** so the frontend and backend work together on the same origin during development.

## Run locally

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to your local env file and update secrets if needed.
3. Start the app:
   `npm run dev`

If port `3000` is already in use, run on a different port:

`PORT=3100 DISABLE_HMR=true npm run dev`

## Production-style local run

Containerized stack:

`docker compose up --build`

Health endpoints:

- app server: `GET /healthz`
- backend health snapshot: `GET /backend/api/health`
- backend readiness: `GET /backend/api/ready`
- backend liveness: `GET /backend/api/live`

## Demo credentials

- Student: `student@edumaster.local` / `Student@123`
- Admin: `admin@edumaster.local` / `Admin@123`

If `MONGODB_URI` is missing or invalid, the backend automatically starts in **memory mode** with seeded demo data.
If `POSTGRES_URL` or `REDIS_URL` are configured, their status is included in backend health checks.

## Verification

- Frontend/server typecheck: `npm run lint`
- Backend API smoke test: `node backend/test-api.js`

## Architecture artifacts

- [HLD + LLD](./HLD_LLD.md)
- [API Design](./API_DESIGN.md)
- [DB Schema](./DB_SCHEMA.sql)
- [Test Engine Logic](./TEST_ENGINE_LOGIC.md)
- [Deployment Architecture](./DEPLOYMENT_ARCHITECTURE.md)
- [User Flow](./USER_FLOW.md)
- [Requirement Coverage](./REQUIREMENT_COVERAGE.md)
- [Architecture Overview](./README_ARCHITECTURE.md)
