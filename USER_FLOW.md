# User Flow

## 1. Authentication

1. Learner opens the platform on mobile/web
2. Learner signs up or logs in
3. Backend issues JWT and stores a single active session against the user/device
4. Dashboard loads from the aggregated platform overview API

## 2. Daily engagement loop

1. Learner receives a daily quiz reminder
2. Learner attempts the daily quiz
3. Quiz result updates:
   - streak
   - points
   - leaderboard
4. Platform suggests the next lesson/test based on weak topics

## 3. Course discovery and purchase

1. Learner browses courses by exam/category/subject
2. Locked premium lessons are visible but gated
3. Learner purchases a course or subscription
4. Payment webhook marks success
5. Enrollment is granted instantly
6. Learner starts or resumes lessons and notes

## 4. Mock test flow

1. Learner opens a full-length / sectional / topic-wise test
2. Timer starts
3. Learner answers questions and navigates through the palette
4. Test auto-submits at timeout or manually submits
5. Scorecard shows:
   - score
   - rank
   - percentile
   - weak vs strong topics
   - explanation-led next steps

## 5. Live learning flow

1. Learner gets a live class alert
2. Learner joins the live room
3. Chat and doubt-solving are available
4. Recording is stored for replay
5. Replay remains available inside the course/live catalog

## 6. Analytics flow

1. Attempt data from quizzes/tests is aggregated
2. Dashboard shows accuracy, speed, attempts, weak topics
3. AI coach recommends what to revise next
4. Learner acts on the next study plan

## 7. Admin flow

1. Admin logs in
2. Admin seeds sample data or uploads bulk questions
3. Admin creates courses/tests/quizzes
4. Admin reviews:
   - active users
   - revenue
   - participation
   - notifications and engagement metrics
