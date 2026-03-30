# Test Engine Logic

## 1. Test types

- Full-length mock test
- Sectional test
- Topic-wise test
- Daily quiz

## 2. Test configuration model

Each test stores:

- duration in minutes
- total marks
- negative marking value
- section breakup
- ordered questions
- explanation per question
- topic metadata for analytics

## 3. Attempt lifecycle

1. User opens a test
2. Frontend starts a client timer immediately
3. User answers question palette items in any order
4. Auto-submit happens when timer reaches zero
5. Manual submit is always available
6. Backend stores answer payload, score, timing, rank inputs, and topic breakdown

## 4. Scoring algorithm

For each question:

- correct answer: `score += marks`
- incorrect answer: `score -= negative_marking`
- unanswered: no score change

Derived metrics:

- `correct_count`
- `incorrect_count`
- `unattempted_count`
- `accuracy = correct / attempted`
- `speed = attempted / time_taken`

## 5. Rank and percentile

For the live/demo build:

- rank is computed from the ordered score list
- percentile is computed from attempt position relative to attempt volume

Recommended production approach:

- async ranking worker
- cached leaderboard snapshots in Redis
- percentile recomputation after each attempt batch

## 6. Topic analytics

During scoring, every question contributes to its topic bucket:

- correct count per topic
- incorrect count per topic
- cumulative marks per topic

Topic rules:

- more incorrect than correct => weak topic
- correct dominant => strong topic
- analytics feed AI recommendations and revision planning

## 7. Daily quiz engine

- 5 to 20 questions
- no long-form navigation overhead
- instant scoring on submit
- updates:
  - streak
  - points
  - leaderboard
  - reminder/engagement pipelines

## 8. Security and abuse controls

- JWT-protected attempt submission
- single active session reduces answer sharing from parallel devices
- server-side final scoring is the source of truth
- optional production hardening:
  - answer encryption in transit
  - tab-switch monitoring
  - IP/device anomaly detection
  - submission idempotency keys

## 9. Post-attempt response contract

The scorecard payload should include:

- score
- total marks
- correct / incorrect / unattempted
- rank
- percentile
- weak topics
- strong topics
- explanations / solution references
- next recommended action
