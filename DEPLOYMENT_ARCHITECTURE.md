# Deployment Architecture

## 1. Edge and delivery

- CDN for frontend bundles, thumbnails, PDF notes, and replay media
- WAF + rate limiting in front of all public traffic
- global DNS with health-based routing

## 2. Frontend hosting

- Next.js/Vercel or containerized React delivery
- mobile-first build optimized for low-bandwidth usage
- server-side rendering for marketing/catalog pages if SEO is needed

## 3. API layer

- Node.js API pods behind load balancer
- stateless containers
- horizontal pod autoscaling based on CPU, memory, and RPS
- separate worker deployment for notifications, rankings, and webhook retries

## 4. Data layer

- PostgreSQL primary for users, enrollments, payments, attempts, subscriptions
- Firestore/document store optional for content, chat, and flexible analytics payloads
- Redis for:
  - active session checks
  - leaderboard cache
  - rate limits
  - idempotency keys
  - hot dashboard reads

## 5. Storage

- S3 or compatible object storage for:
  - PDF notes
  - thumbnails
  - live class recordings
  - premium media metadata

## 6. Real-time

- WebSocket gateway or managed RTC provider
- Zoom/Agora/WebRTC for live class video rooms
- Redis pub/sub or streaming bus for presence and chat fan-out

## 7. Payments

- Stripe / Razorpay public checkout
- webhook receiver isolated behind signature verification
- retry queue for failed webhook processing
- entitlement writer updates enrollments/subscriptions after successful payment

## 8. Observability

- structured logs
- Prometheus + Grafana dashboards
- distributed tracing for auth, test submit, payment, and live-class joins
- alerting for:
  - error rate spikes
  - queue lag
  - payment webhook failures
  - DB saturation

## 9. Scaling target

To support **10K to 100K learners**:

- split read-heavy overview APIs from write-heavy attempt APIs
- cache leaderboards and public catalog aggressively
- move analytics aggregation to async workers
- use DB read replicas for dashboards
- batch push notification dispatch

## 10. Current repo implementation note

Today’s repo runs as:

- root Express/Vite server on the frontend side
- backend mounted under `/backend/api`
- local memory-mode fallback for fast demo verification

That local shape is intentionally compatible with the production decomposition above.
