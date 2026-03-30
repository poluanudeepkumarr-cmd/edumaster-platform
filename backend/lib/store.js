const state = {
  users: [],
  courses: [],
  tests: [],
  testAttempts: [],
  quizzes: [],
  enrollments: [],
  watchHistory: [],
  liveClasses: [],
  liveChatMessages: [],
  subscriptions: [],
  userSubscriptions: [],
  aiMessages: [],
  loginSessions: [],
  deviceActivities: [],
  notifications: [],
  referrals: [],
  uploads: [],
  payments: [],
  webhooks: [],
};

const counters = new Map();

const clone = (value) => JSON.parse(JSON.stringify(value));

const nextId = (prefix) => {
  const nextValue = (counters.get(prefix) || 0) + 1;
  counters.set(prefix, nextValue);
  return `${prefix}_${nextValue}`;
};

const nowIso = () => new Date().toISOString();

module.exports = {
  state,
  clone,
  nextId,
  nowIso,
};
