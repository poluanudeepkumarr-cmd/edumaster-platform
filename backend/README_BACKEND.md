# Backend Implementation Notes

## Current backend capabilities

- JWT auth with login, session restore, and logout
- single-session style enforcement using stored session IDs
- course catalog and lesson flattening
- mock test catalog + submission scoring
- daily quiz creation, submission, and leaderboard
- analytics, notifications, engagement, payments, admin, and platform overview routes
- AI coach endpoint and watch-progress tracking
- live class catalog, replay links, and chat/doubt thread APIs
- production health, readiness, and liveness endpoints

## Runtime modes

- **Mongo mode** when `MONGODB_URI` is valid
- **Memory mode** when Mongo is unavailable
  - auto-seeds demo users, courses, tests, quiz, live classes, subscriptions
- **Production-config aware**
  - reports optional Postgres and Redis health through `/api/health`

## Important routes

- `/api/auth/*`
- `/api/platform/*`
- `/api/courses/*`
- `/api/tests/*`
- `/api/quiz/*`
- `/api/live-classes/*`
- `/api/analytics/*`
- `/api/admin/*`
- `/api/health`
- `/api/ready`
- `/api/live`

## Next backend steps

1. Move session control to Redis for true single-device enforcement across replicas
2. Replace memory repositories with PostgreSQL/ORM-backed repositories
3. Persist leaderboard/session/cache workloads into Redis instead of in-process memory
4. Add signed payment webhook verification
5. Upgrade live-class chat from REST polling to WebSocket fan-out
