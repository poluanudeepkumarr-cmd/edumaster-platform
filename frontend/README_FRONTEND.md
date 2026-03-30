# Frontend Implementation Notes

## Current UI modules

- Auth landing with demo login/register
- Overview dashboard
- Course catalog with premium gating and lesson progression actions
- Mock test player with timer and auto-submit
- Daily quiz interaction
- Live class catalog
- Analytics + AI coach
- Plans/subscriptions
- Admin command center

## Integration pattern

- frontend calls same-origin backend APIs through `EduService`
- JWT is stored locally and restored on refresh
- the root app server mounts backend APIs at `/backend/api`

## UX direction

- mobile-first layout
- bold warm visual theme instead of generic admin blue-only UI
- card-based study workflow for fast tap navigation

## Next recommended steps

1. Replace the current demo cards with real API-backed pagination/search
2. Add a dedicated video player and PDF viewer
3. Add chart visualizations for analytics trends
4. Add push notification permission flow and PWA install prompt
