export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
  device?: string | null;
  session?: string | null;
  streak?: number;
  points?: number;
  badges?: { code: string; label: string }[];
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface CourseLesson {
  id: string;
  title: string;
  type: 'youtube' | 'premium' | 'pdf' | 'video' | string;
  durationMinutes: number;
  videoUrl?: string;
  notesUrl?: string;
  premium?: boolean;
  locked?: boolean;
}

export interface CourseModule {
  id: string;
  title: string;
  lessons: CourseLesson[];
}

export interface CourseCard {
  _id: string;
  title: string;
  description: string;
  category: string;
  exam: string;
  subject: string;
  level: string;
  price: number;
  validityDays: number;
  thumbnailUrl: string;
  instructor: string;
  officialChannelUrl?: string | null;
  modules: CourseModule[];
  enrolled?: boolean;
  progressPercent?: number;
  continueLesson?: (CourseLesson & { moduleTitle?: string }) | null;
  lessonCount?: number;
}

export interface MockQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctOption?: number;
  explanation?: string;
  marks: number;
  topic: string;
}

export interface MockTest {
  _id: string;
  title: string;
  description: string;
  category: string;
  type: string;
  durationMinutes: number;
  totalMarks: number;
  negativeMarking: number;
  sectionBreakup: { name: string; questions: number }[];
  questions: MockQuestion[];
}

export interface TestAttemptResult {
  _id: string;
  userId: string;
  testId: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  percentile: number;
  rank: number;
  weakTopics: string[];
  strongTopics: string[];
  solutions: {
    questionId: string;
    questionText: string;
    selectedOption: number | null;
    correctOption: number;
    explanation: string;
    topic: string;
  }[];
  completedAt: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer?: string;
  explanation?: string;
  topic: string;
}

export interface DailyQuiz {
  _id: string;
  date: string;
  questions: QuizQuestion[];
}

export interface LeaderboardEntry {
  userId: string;
  name?: string;
  score: number;
  total: number;
  submittedAt: string;
  attempts?: number;
}

export interface QuizReviewItem {
  questionId: string;
  prompt: string;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string;
  topic: string;
}

export interface DailyQuizState {
  quiz: DailyQuiz;
  leaderboard: LeaderboardEntry[];
  weeklyLeaderboard: LeaderboardEntry[];
  streak: number;
}

export interface LiveClass {
  _id: string;
  title: string;
  instructor: string;
  startTime: string;
  durationMinutes: number;
  provider: string;
  mode: 'live' | 'replay' | string;
  roomUrl?: string | null;
  recordingUrl?: string | null;
  chatEnabled: boolean;
  doubtSolving: boolean;
  replayAvailable: boolean;
  attendees: number;
  topicTags: string[];
}

export interface LiveChatMessage {
  _id: string;
  liveClassId: string;
  userId: string;
  userName: string;
  kind: 'chat' | 'doubt' | string;
  message: string;
  createdAt: string;
}

export interface SubscriptionPlan {
  _id: string;
  title: string;
  description: string;
  price: number;
  billingCycle: string;
  accessType?: string;
  active?: boolean;
  features: string[];
}

export interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
}

export interface AnalyticsSnapshot {
  accuracy: number;
  speed: number;
  attempts: number;
  weakTopics: string[];
  strongTopics: string[];
  suggestions: string[];
  trend: {
    label: string;
    score: number;
    accuracy: number;
  }[];
  adaptivePlan: {
    nextTestType: string;
    difficulty: string;
    reason: string;
  };
}

export interface DeviceActivity {
  _id: string;
  userId: string;
  sessionId: string | null;
  device: string | null;
  eventType: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface LoginSession {
  _id: string;
  userId: string;
  sessionId: string;
  device: string | null;
  status: string;
  reason: string | null;
  createdAt: string;
  lastSeenAt: string;
  endedAt: string | null;
}

export interface AdminOverview {
  activeUsers: number;
  activeSessions: number;
  totalCourses: number;
  totalTests: number;
  liveClasses: number;
  notificationsSent: number;
  referralCount: number;
  paymentCount: number;
  testParticipation: number;
  revenue: number;
  concurrentCapacityTarget: string;
  recentDeviceActivity: DeviceActivity[];
  sampleCredentials: {
    adminEmail: string;
    adminPassword: string;
    studentEmail: string;
    studentPassword: string;
  };
}

export interface PlatformOverview {
  user: AuthUser | null;
  highlights: {
    concurrencyTarget: string;
    deploymentProfile: string;
    modules: string[];
  };
  dashboard: {
    streak: number;
    points: number;
    accuracy: number;
    speed: number;
    weakTopics: string[];
    strongTopics: string[];
    continueLearning: CourseCard[];
    latestMockTest: TestAttemptResult | null;
  };
  dailyQuiz: DailyQuizState | null;
  courses: CourseCard[];
  testSeries: MockTest[];
  liveClasses: LiveClass[];
  subscriptions: SubscriptionPlan[];
  notifications: NotificationItem[];
  analytics: AnalyticsSnapshot;
  ai: {
    headline: string;
    prompts: string[];
  };
  sessionActivity: {
    activeSessions: number;
    recentSessions: LoginSession[];
    recentDeviceActivity: DeviceActivity[];
  } | null;
  adminOverview: AdminOverview | null;
  sampleCredentials: {
    adminEmail: string;
    adminPassword: string;
    studentEmail: string;
    studentPassword: string;
  };
}

export interface AiResponse {
  _id: string;
  userId: string;
  message: string;
  answer: string;
  createdAt: string;
}

export interface DailyQuizResult {
  score: number;
  total: number;
  review: QuizReviewItem[];
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}
