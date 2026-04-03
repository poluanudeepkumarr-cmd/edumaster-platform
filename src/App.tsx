import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  BookOpen,
  Bot,
  Brain,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Expand,
  Flame,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  LoaderCircle,
  Lock,
  LogOut,
  MessageSquare,
  Pause,
  PlayCircle,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserCircle2,
  Video,
  Wallet,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AuthProvider, useAuth } from './AuthContext';
import { CoursesTab } from './components/CoursesTab';
import { EduService } from './EduService';
import { AdminCourseManager } from './components/AdminCourseManager';
import { AdminLiveClassManager } from './components/AdminLiveClassManager';
import { AdminModuleManager } from './components/AdminModuleManager';
import { LiveBroadcastViewer } from './components/LiveBroadcastViewer';
import { ProtectedLivePlayback } from './components/ProtectedLivePlayback';
import { AdminVideoUpload } from './components/AdminVideoUpload';
import Hls from 'hls.js';
import {
  AiResponse,
  DailyQuizResult,
  LiveChatMessage,
  LiveClassAccess,
  MockTest,
  NotificationItem,
  PlatformOverview,
  ProtectedLessonPlayback,
  RegisterPayload,
  SavedTopic,
  TestAttemptResult,
} from './types';
import { cn } from './lib/utils';

type TabKey = 'overview' | 'courses' | 'tests' | 'quiz' | 'live' | 'analytics' | 'plans' | 'admin';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

const tabs: { id: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'tests', label: 'Mock Tests', icon: ClipboardCheck },
  { id: 'quiz', label: 'Daily Quiz', icon: Sparkles },
  { id: 'live', label: 'Live Classes', icon: Radio },
  { id: 'analytics', label: 'Analytics', icon: Gauge },
  { id: 'plans', label: 'Plans', icon: Wallet },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
];

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));

const formatTimeLeft = (seconds: number) => {
  const minutes = Math.max(Math.floor(seconds / 60), 0);
  const remainingSeconds = Math.max(seconds % 60, 0);
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const formatPlaybackTime = (seconds: number) => {
  const safeSeconds = Math.max(Math.floor(seconds || 0), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const CBT_BRAND_NAME = 'EduMaster';

const buildSavedTopicsKey = (userId: string) => `edumaster.saved-topics.${userId}`;

const flattenCourseLessons = (course: PlatformOverview['courses'][number]) =>
  (course.modules || []).flatMap((module) => ([
    ...(module.lessons || []).map((lesson) => ({
      lesson,
      moduleTitle: module.title,
      chapterTitle: null as string | null,
    })),
    ...((module.chapters || []).flatMap((chapter) =>
      (chapter.lessons || []).map((lesson) => ({
        lesson,
        moduleTitle: module.title,
        chapterTitle: chapter.title,
      })))),
  ]));

const formatEventLabel = (eventType: string) =>
  eventType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getNotificationNavigationTarget = (notification: NotificationItem) => {
  if (notification.type === 'live-class-started' && notification.entityId) {
    return {
      tab: 'live' as TabKey,
      liveClassId: notification.entityId,
    };
  }

  if (notification.actionUrl && typeof window !== 'undefined') {
    try {
      const targetUrl = new URL(notification.actionUrl, window.location.origin);
      const tab = targetUrl.searchParams.get('tab');
      const liveClassId = targetUrl.searchParams.get('liveClassId');
      if (tab === 'live' && liveClassId) {
        return {
          tab: 'live' as TabKey,
          liveClassId,
        };
      }
    } catch {
      return null;
    }
  }

  return null;
};

const SectionHeader = ({ title, caption, action }: { title: string; caption: string; action?: React.ReactNode }) => (
  <div className="flex items-end justify-between gap-4">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">{caption}</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">{title}</h2>
    </div>
    {action}
  </div>
);

const MetricCard = ({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm text-[var(--ink-soft)]">{title}</p>
        <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{value}</p>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-cream)] text-[var(--accent-rust)]">
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <p className="mt-4 text-sm text-[var(--ink-soft)]">{hint}</p>
  </div>
);

const ReviewToggleButton = ({
  open,
  onClick,
  label = 'Solution',
}: {
  open: boolean;
  onClick: () => void;
  label?: string;
}) => (
  <button
    onClick={onClick}
    className={cn(
      'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
      open
        ? 'bg-[var(--ink)] text-white'
        : 'border border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--accent-rust)]/35',
    )}
  >
    {label}
    <ChevronRight className={cn('h-4 w-4 transition', open && 'rotate-90')} />
  </button>
);

const MockSolutionCard = ({
  solution,
  index,
  open,
  onToggle,
}: {
  solution: TestAttemptResult['solutions'][number];
  index: number;
  open: boolean;
  onToggle: () => void;
}) => {
  const status = solution.selectedOption === null
    ? 'skipped'
    : solution.selectedOption === solution.correctOption
      ? 'correct'
      : 'incorrect';

  return (
    <div className="rounded-[24px] border border-[var(--line)] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent-cream)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
              Question {index + 1}
            </span>
            <span className={cn(
              'rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]',
              status === 'correct'
                ? 'bg-[var(--success-soft)] text-[var(--success)]'
                : status === 'incorrect'
                  ? 'bg-[var(--danger-soft)] text-[var(--danger)]'
                  : 'bg-slate-100 text-slate-500',
            )}>
              {status}
            </span>
            <span className="rounded-full border border-[var(--line)] px-3 py-2 text-xs text-[var(--ink-soft)]">
              {solution.topic}
            </span>
          </div>
          <p className="mt-3 text-base font-semibold leading-7 text-[var(--ink)]">{solution.questionText}</p>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            Your answer: <span className="font-semibold text-[var(--ink)]">{solution.selectedOption === null ? 'Skipped' : String.fromCharCode(65 + solution.selectedOption)}</span>
            {' '}• Correct: <span className="font-semibold text-[var(--success)]">{String.fromCharCode(65 + solution.correctOption)}</span>
          </p>
        </div>
        <ReviewToggleButton open={open} onClick={onToggle} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-[20px] bg-[var(--accent-cream)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">AI explanation</p>
              <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{solution.explanation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const QuizReviewCard = ({
  reviewItem,
  questionIndex,
  open,
  onToggle,
}: {
  reviewItem: DailyQuizResult['review'][number];
  questionIndex: number;
  open: boolean;
  onToggle: () => void;
}) => {
  const isCorrect = reviewItem.selectedAnswer && reviewItem.selectedAnswer === reviewItem.correctAnswer;
  const isSkipped = !reviewItem.selectedAnswer;

  return (
    <div className="mt-4 rounded-[20px] border border-[var(--line)] bg-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[var(--accent-cream)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">
              Review {questionIndex + 1}
            </span>
            <span className={cn(
              'rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]',
              isSkipped
                ? 'bg-slate-100 text-slate-500'
                : isCorrect
                  ? 'bg-[var(--success-soft)] text-[var(--success)]'
                  : 'bg-[var(--danger-soft)] text-[var(--danger)]',
            )}>
              {isSkipped ? 'skipped' : isCorrect ? 'correct' : 'incorrect'}
            </span>
            <span className="rounded-full border border-[var(--line)] px-3 py-2 text-xs text-[var(--ink-soft)]">
              {reviewItem.topic}
            </span>
          </div>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            Your answer: <span className="font-semibold text-[var(--ink)]">{reviewItem.selectedAnswer || 'Skipped'}</span>
            {' '}• Correct: <span className="font-semibold text-[var(--success)]">{reviewItem.correctAnswer}</span>
          </p>
        </div>
        <ReviewToggleButton open={open} onClick={onToggle} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            className="overflow-hidden"
          >
            <div className="mt-4 rounded-[18px] bg-[var(--accent-cream)] p-4 text-sm text-[var(--ink-soft)]">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">AI explanation</p>
              <p className="mt-2 leading-7">{reviewItem.explanation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AuthScreen = ({
  publicOverview,
}: {
  publicOverview: PlatformOverview | null;
}) => {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState<RegisterPayload>({
    name: '',
    email: '',
    password: '',
  });

  const submitLogin = async (email = loginForm.email, password = loginForm.password) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in');
    } finally {
      setSubmitting(false);
    }
  };

  const submitRegister = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await register(registerForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 lg:grid-cols-[1.2fr_0.9fr]">
        <section className="relative overflow-hidden rounded-[36px] border border-white/70 bg-[var(--card-dark)] p-6 text-white shadow-[0_32px_120px_rgba(15,23,42,0.35)] sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(249,115,22,0.18),transparent_28%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              Built for SSC JE / RRB JE at 10K+ concurrent scale
            </div>

            <h1 className="mt-8 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Mobile-first exam prep with mock tests, daily quiz streaks, live classes, and AI-backed analytics.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-lg">
              This project now aligns the frontend and backend around a real prep-platform flow: login, course access,
              mock test attempts, daily quiz engagement, live sessions, performance insights, payments, and admin tooling.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <MetricCard title="Concurrent Ready" value="10K+" hint="Load balancer + Redis + CDN + stateless APIs" icon={Trophy} />
              <MetricCard title="Daily Engagement" value="5-20 Q" hint="Instant quiz results, streaks, and leaderboards" icon={Flame} />
              <MetricCard title="Learning Stack" value="7 Modules" hint="Courses, tests, live classes, AI, analytics, payments, admin" icon={Brain} />
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              {(publicOverview?.highlights.modules || ['Courses', 'Mock Tests', 'Daily Quiz', 'Live Classes']).map((module) => (
                <div
                  key={module}
                  className="rounded-[24px] border border-white/15 bg-white/8 p-4 text-sm text-white/78 backdrop-blur"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{module}</p>
                      <p className="mt-1 text-white/60">Integrated into a single same-origin product shell.</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-[28px] border border-white/15 bg-black/18 p-5 backdrop-blur">
              <p className="text-sm font-semibold text-white">Production-ready sign in</p>
              <p className="mt-2 text-sm leading-6 text-white/66">
                Use actual learner or admin accounts created in your backend.
              </p>
              {publicOverview?.sampleCredentials && (
                <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-white/78">
                  <p className="font-medium text-white">Local admin credentials</p>
                  <p className="mt-2">Email: {publicOverview.sampleCredentials.adminEmail}</p>
                  <p>Password: {publicOverview.sampleCredentials.adminPassword}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-[36px] border border-white/80 bg-white/90 p-6 shadow-[0_28px_100px_rgba(15,23,42,0.12)] backdrop-blur sm:p-8">
          <div className="flex rounded-full bg-[var(--accent-cream)] p-1">
            {(['login', 'register'] as const).map((item) => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={cn(
                  'flex-1 rounded-full px-4 py-3 text-sm font-semibold transition',
                  mode === item ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)]',
                )}
              >
                {item === 'login' ? 'Login' : 'Create account'}
              </button>
            ))}
          </div>

          <div className="mt-8 space-y-5">
            {mode === 'login' ? (
              <>
                <div>
                  <label className="text-sm font-medium text-[var(--ink-soft)]">Email</label>
                  <input
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none transition focus:border-[var(--accent-rust)]"
                    placeholder="student@edumaster.local"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--ink-soft)]">Password</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none transition focus:border-[var(--accent-rust)]"
                    placeholder="Enter your password"
                  />
                </div>
                <button
                  onClick={() => submitLogin()}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-4 font-semibold text-white transition hover:bg-[var(--accent-rust-strong)] disabled:opacity-60"
                >
                  {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                  Continue to dashboard
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium text-[var(--ink-soft)]">Full name</label>
                  <input
                    value={registerForm.name}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none transition focus:border-[var(--accent-rust)]"
                    placeholder="Aspirant name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--ink-soft)]">Email</label>
                  <input
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none transition focus:border-[var(--accent-rust)]"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--ink-soft)]">Password</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none transition focus:border-[var(--accent-rust)]"
                    placeholder="Create a strong password"
                  />
                </div>
                <button
                  onClick={submitRegister}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-4 font-semibold text-white transition hover:bg-[var(--accent-rust-strong)] disabled:opacity-60"
                >
                  {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <GraduationCap className="h-5 w-5" />}
                  Create student account
                </button>
              </>
            )}

            {error && <p className="rounded-2xl bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]">{error}</p>}
          </div>

          <div className="mt-8 rounded-[28px] border border-[var(--line)] bg-[var(--accent-cream)] p-5">
            <p className="text-sm font-semibold text-[var(--ink)]">What is already integrated now?</p>
            <div className="mt-4 space-y-3 text-sm text-[var(--ink-soft)]">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-[var(--accent-rust)]" />
                Same-origin React + backend API integration
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-[var(--accent-rust)]" />
                Backend JWT sessions with single-device style session tracking
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-4 w-4 text-[var(--accent-rust)]" />
                Sample product data for courses, tests, quiz, live classes, analytics, and admin
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const Shell = ({
  overview,
  activeTab,
  setActiveTab,
  onLogout,
  onRefresh,
  resumeTarget,
  liveNavigationTarget,
  onContinueLearningNavigate,
  onOpenNotification,
  onResumeNavigationHandled,
  savedTopicIds,
  savedTopics,
  onToggleSavedTopic,
}: {
  overview: PlatformOverview;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  onLogout: () => Promise<void>;
  onRefresh: () => Promise<void>;
  resumeTarget: { courseId: string; lessonId?: string | null } | null;
  liveNavigationTarget: string | null;
  onContinueLearningNavigate: (courseId: string, lessonId?: string | null) => void;
  onOpenNotification: (notification: NotificationItem) => void;
  onResumeNavigationHandled: () => void;
  savedTopicIds: string[];
  savedTopics: SavedTopic[];
  onToggleSavedTopic: (courseId: string, lessonId: string) => void;
}) => {
  const { user, isAdmin } = useAuth();

  const visibleTabs = tabs.filter((tab) => tab.id !== 'admin' || isAdmin);

  return (
    <div className="flex min-h-screen bg-[var(--page-bg)]">
      <aside className="hidden w-[280px] shrink-0 border-r border-white/60 bg-[var(--card-dark)] px-5 py-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] lg:flex lg:flex-col">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold">EduMaster</p>
              <p className="text-sm text-white/60">JE Prep Control Room</p>
            </div>
          </div>
          <div className="mt-8 rounded-[28px] border border-white/10 bg-white/8 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-white/46">Current user</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/12">
                <UserCircle2 className="h-7 w-7" />
              </div>
              <div>
                <p className="font-medium text-white">{user?.name}</p>
                <p className="text-sm capitalize text-white/60">{user?.role}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/8 p-3">
                <p className="text-white/52">Streak</p>
                <p className="mt-1 text-xl font-semibold">{overview.dashboard.streak}</p>
              </div>
              <div className="rounded-2xl bg-white/8 p-3">
                <p className="text-white/52">Points</p>
                <p className="mt-1 text-xl font-semibold">{overview.dashboard.points}</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="mt-8 space-y-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition',
                activeTab === tab.id ? 'bg-white text-[var(--ink)] shadow-sm' : 'text-white/72 hover:bg-white/10 hover:text-white',
              )}
            >
              <tab.icon className="h-5 w-5" />
              {tab.label}
            </button>
          ))}
        </nav>

        <button
          onClick={onLogout}
          className="mt-auto flex items-center gap-3 rounded-2xl border border-white/12 px-4 py-3 text-sm text-white/74 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/60 bg-[var(--page-bg)]/90 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">Unified platform</p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--ink)]">SSC JE / RRB JE prep operating system</h1>
            </div>
            <div className="hidden items-center gap-3 rounded-full border border-[var(--line)] bg-white px-4 py-3 shadow-sm sm:flex">
              <BellRing className="h-4 w-4 text-[var(--accent-rust)]" />
              <span className="text-sm text-[var(--ink-soft)]">{overview.notifications.length} active reminders</span>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-28 pt-6 sm:px-6 lg:px-8">
          {activeTab === 'overview' && (
            <OverviewTab
              overview={overview}
              savedTopics={savedTopics}
              onOpenNotification={onOpenNotification}
              onContinueLearning={(courseId, lessonId) => {
                onContinueLearningNavigate(courseId, lessonId);
                setActiveTab('courses');
              }}
            />
          )}
          {activeTab === 'courses' && (
            <CoursesTab
              overview={overview}
              onRefresh={onRefresh}
              initialCourseId={resumeTarget?.courseId}
              initialLessonId={resumeTarget?.lessonId || null}
              onResumeNavigationHandled={onResumeNavigationHandled}
              savedTopicIds={savedTopicIds}
              onToggleSavedTopic={onToggleSavedTopic}
            />
          )}
          {activeTab === 'tests' && <TestsTab overview={overview} onRefresh={onRefresh} />}
          {activeTab === 'quiz' && <QuizTab overview={overview} onRefresh={onRefresh} />}
          {activeTab === 'live' && <LiveTab overview={overview} onRefresh={onRefresh} initialLiveClassId={liveNavigationTarget} />}
          {activeTab === 'analytics' && <AnalyticsTab overview={overview} />}
          {activeTab === 'plans' && <PlansTab overview={overview} onRefresh={onRefresh} />}
          {activeTab === 'admin' && overview.adminOverview && <AdminTab overview={overview} onRefresh={onRefresh} />}
        </main>

        <div className="fixed inset-x-3 bottom-3 z-30 rounded-[28px] border border-white/70 bg-white/92 p-2 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur lg:hidden">
          <div className="grid grid-cols-4 gap-1">
            {visibleTabs.slice(0, 4).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-medium',
                  activeTab === tab.id ? 'bg-[var(--accent-rust)] text-white' : 'text-[var(--ink-soft)]',
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const OverviewTab = ({
  overview,
  onContinueLearning,
  onOpenNotification,
  savedTopics,
}: {
  overview: PlatformOverview;
  onContinueLearning: (courseId: string, lessonId?: string | null) => void;
  onOpenNotification: (notification: NotificationItem) => void;
  savedTopics: SavedTopic[];
}) => (
  <div className="space-y-6">
    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[34px] bg-[var(--card-dark)] p-6 text-white shadow-[0_30px_120px_rgba(15,23,42,0.3)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/52">Execution layer</p>
        <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
          {overview.highlights.concurrencyTarget} learning experience with courses, tests, daily quiz, live classes, and AI guidance.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
          {overview.ai.headline}
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <MetricCard title="Accuracy" value={`${overview.dashboard.accuracy}%`} hint="Combined quiz + mock test performance" icon={Target} />
          <MetricCard title="Speed" value={`${overview.dashboard.speed}x`} hint="Current solving pace indicator" icon={Gauge} />
          <MetricCard title="Streak" value={`${overview.dashboard.streak} days`} hint="Protected through daily quiz attempts" icon={Flame} />
        </div>
      </div>

      <div className="rounded-[34px] border border-white/70 bg-white/92 p-6 shadow-[0_24px_90px_rgba(15,23,42,0.08)]">
        <SectionHeader title="Action queue" caption="Right now" />
        <div className="mt-6 space-y-4">
          {overview.notifications.map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => onOpenNotification(item)}
              className="w-full rounded-[24px] border border-[var(--line)] bg-[var(--accent-cream)] p-4 text-left transition hover:border-[var(--accent-rust)]/40"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-white">
                  <BellRing className="h-4 w-4 text-[var(--accent-rust)]" />
                </div>
                <div>
                  <p className="font-medium text-[var(--ink)]">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">{item.message}</p>
                  {(item.actionLabel || getNotificationNavigationTarget(item)) && (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-rust)]">
                      {item.actionLabel || 'Open now'}
                    </p>
                  )}
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)]">{formatDateTime(item.createdAt)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>

    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Continue learning" caption="Resume playback" />
        <div className="mt-6 space-y-4">
          {overview.dashboard.continueLearning.length > 0 ? overview.dashboard.continueLearning.map((course) => (
            <button
              key={course._id}
              onClick={() => onContinueLearning(course._id, course.continueLesson?.id || null)}
              className="w-full rounded-[26px] border border-[var(--line)] p-4 text-left transition hover:border-[var(--accent-rust)]"
            >
              <div className="flex items-start gap-4">
                <img src={course.thumbnailUrl} alt={course.title} className="h-24 w-24 rounded-[20px] object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-soft)]">{course.exam}</p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--ink)]">{course.title}</h3>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    Resume: {course.continueLesson?.title || 'Start your next lesson'}
                    {course.continueProgressSeconds
                      ? ` at ${formatPlaybackTime(course.continueProgressSeconds)}`
                      : ''}
                  </p>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-xs text-[var(--ink-soft)]">
                      <span>Progress</span>
                      <span>{course.progressPercent || 0}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--accent-cream)]">
                      <div className="h-full rounded-full bg-[var(--accent-rust)]" style={{ width: `${course.progressPercent || 0}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </button>
          )) : (
            <div className="rounded-[26px] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
              No watch history yet. Unlock a course or replay a live class to build learning continuity.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Performance signals" caption="What stands out" />
        <div className="mt-6 space-y-4">
          <div className="rounded-[24px] bg-[var(--accent-cream)] p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">Weak topics</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {overview.dashboard.weakTopics.map((topic) => (
                <span key={topic} className="rounded-full bg-white px-3 py-2 text-sm text-[var(--danger)]">
                  {topic}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] bg-[var(--accent-cream)] p-4">
            <p className="text-sm font-semibold text-[var(--ink)]">Strong topics</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(overview.dashboard.strongTopics.length > 0 ? overview.dashboard.strongTopics : ['General Awareness']).map((topic) => (
                <span key={topic} className="rounded-full bg-white px-3 py-2 text-sm text-[var(--success)]">
                  {topic}
                </span>
              ))}
            </div>
          </div>
          {overview.dashboard.latestMockTest && (
            <div className="rounded-[24px] border border-[var(--line)] p-4">
              <p className="text-sm font-semibold text-[var(--ink)]">Latest mock result</p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-[var(--accent-cream)] p-3">
                  <p className="text-[var(--ink-soft)]">Score</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{overview.dashboard.latestMockTest.score}</p>
                </div>
                <div className="rounded-2xl bg-[var(--accent-cream)] p-3">
                  <p className="text-[var(--ink-soft)]">Rank</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--ink)]">#{overview.dashboard.latestMockTest.rank}</p>
                </div>
              </div>
            </div>
          )}
          {overview.sessionActivity && (
            <div className="rounded-[24px] border border-[var(--line)] p-4">
              <p className="text-sm font-semibold text-[var(--ink)]">Session & device activity</p>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">
                Active sessions: <span className="font-semibold text-[var(--ink)]">{overview.sessionActivity.activeSessions}</span>
              </p>
              <div className="mt-4 space-y-2">
                {overview.sessionActivity.recentDeviceActivity.slice(0, 3).map((activity) => (
                  <div key={activity._id} className="rounded-2xl bg-[var(--accent-cream)] px-3 py-3 text-sm text-[var(--ink-soft)]">
                    <span className="font-semibold text-[var(--ink)]">{formatEventLabel(activity.eventType)}</span>
                    {' '}on {activity.device || 'unknown device'} • {formatDateTime(activity.createdAt)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Saved topics" caption="Quick return" />
        <div className="mt-6 space-y-3">
          {savedTopics.length > 0 ? savedTopics.slice(0, 6).map((topic) => (
            <button
              key={`${topic.courseId}:${topic.lessonId}`}
              onClick={() => onContinueLearning(topic.courseId, topic.lessonId)}
              className="w-full rounded-[22px] border border-[var(--line)] bg-[var(--accent-cream)] p-4 text-left transition hover:border-[var(--accent-rust)]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">{topic.exam}</p>
              <h3 className="mt-2 text-base font-semibold text-[var(--ink)]">{topic.lessonTitle}</h3>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{topic.courseTitle}</p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                {topic.chapterTitle ? `${topic.moduleTitle} • ${topic.chapterTitle}` : topic.moduleTitle || 'Saved topic'}
                {topic.progressSeconds ? ` • resume at ${formatPlaybackTime(topic.progressSeconds)}` : ''}
              </p>
            </button>
          )) : (
            <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
              Save important topics while studying and they will appear here for faster revision.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Study focus" caption="What to do next" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] bg-[var(--accent-cream)] p-4">
            <p className="text-sm text-[var(--ink-soft)]">Active courses</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{overview.courses.filter((course) => course.enrolled).length}</p>
          </div>
          <div className="rounded-[24px] bg-[var(--accent-cream)] p-4">
            <p className="text-sm text-[var(--ink-soft)]">Saved topics</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{savedTopics.length}</p>
          </div>
          <div className="rounded-[24px] bg-[var(--accent-cream)] p-4">
            <p className="text-sm text-[var(--ink-soft)]">Continue queue</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{overview.dashboard.continueLearning.length}</p>
          </div>
        </div>
        <div className="mt-5 rounded-[24px] border border-[var(--line)] p-4">
          <p className="text-sm font-semibold text-[var(--ink)]">Recommended next action</p>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">
            {overview.dashboard.continueLearning[0]
              ? `Resume ${overview.dashboard.continueLearning[0].continueLesson?.title || overview.dashboard.continueLearning[0].title} and finish that study streak before starting a new topic.`
              : savedTopics[0]
                ? `Revisit your saved topic ${savedTopics[0].lessonTitle} for revision or note-making.`
                : 'Start one course topic and save key lessons so your revision queue becomes easier to manage.'}
          </p>
        </div>
      </div>
    </section>
  </div>
);

type ExamStage = 'instructions' | 'declaration' | 'exam';
type ExamWorkspaceTab = 'question' | 'symbols' | 'calculator' | 'instructions' | 'summary';
type ExamQuestionState = 'unvisited' | 'unanswered' | 'answered' | 'review' | 'answered-review';
type ExamFamily = 'ssc' | 'rrb' | 'banking' | 'default';
type ExamSection = {
  name: string;
  questionCount: number;
  startIndex: number;
  endIndex: number;
};

const examWorkspaceTabs: { id: Exclude<ExamWorkspaceTab, 'question'>; label: string }[] = [
  { id: 'symbols', label: 'Symbols' },
  { id: 'calculator', label: 'Calculator' },
  { id: 'instructions', label: 'Instructions' },
  { id: 'summary', label: 'Overall Test Summary' },
];

const questionStateLegend: { state: ExamQuestionState; label: string; description: string }[] = [
  { state: 'unvisited', label: 'Not Visited', description: 'You have not visited the question yet.' },
  { state: 'unanswered', label: 'Not Answered', description: 'You have not answered the question.' },
  { state: 'answered', label: 'Answered', description: 'You have answered the question.' },
  { state: 'review', label: 'Marked For Review', description: 'You have NOT answered the question, but have marked the question for review.' },
  { state: 'answered-review', label: 'Answered & Review', description: 'You have answered the question, but marked it for review.' },
];

const distributeSectionCounts = (totalQuestions: number, weights: number[]) => {
  if (totalQuestions <= 0 || weights.length === 0) {
    return [];
  }

  const safeWeights = weights.map((weight) => Math.max(weight, 1));
  const counts = new Array(safeWeights.length).fill(0);
  let remaining = totalQuestions;

  for (let index = 0; index < safeWeights.length && remaining > 0; index += 1) {
    counts[index] = 1;
    remaining -= 1;
  }

  if (remaining <= 0) {
    return counts;
  }

  const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0);
  const rawAllocations = safeWeights.map((weight) => (weight / totalWeight) * remaining);
  const floorAllocations = rawAllocations.map((value) => Math.floor(value));
  const remainders = rawAllocations.map((value, index) => ({
    index,
    remainder: value - floorAllocations[index],
  })).sort((left, right) => right.remainder - left.remainder);

  floorAllocations.forEach((value, index) => {
    counts[index] += value;
  });

  let stillRemaining = remaining - floorAllocations.reduce((sum, value) => sum + value, 0);

  for (let index = 0; index < remainders.length && stillRemaining > 0; index += 1) {
    counts[remainders[index].index] += 1;
    stillRemaining -= 1;
  }

  return counts;
};

const buildExamSections = (test: MockTest): ExamSection[] => {
  if (test.questions.length === 0) {
    return [];
  }

  const examSource = `${test.category} ${test.title} ${test.type}`.toLowerCase();
  const shouldForceJeThreePartLayout = examSource.includes('ssc je');

  const declaredSections = shouldForceJeThreePartLayout
    ? [
      { name: 'General Intelligence and Reasoning', questions: 1 },
      { name: 'General Awareness', questions: 1 },
      { name: 'General Engineering', questions: 2 },
    ]
    : test.sectionBreakup.length > 0
      ? test.sectionBreakup
      : [{ name: 'Section 1', questions: test.questions.length }];

  const declaredTotal = declaredSections.reduce((sum, section) => sum + Math.max(section.questions, 0), 0);

  const counts = declaredTotal === test.questions.length
    ? declaredSections.map((section) => Math.max(section.questions, 0))
    : distributeSectionCounts(
      test.questions.length,
      declaredSections.map((section) => Math.max(section.questions, 1)),
    );

  let cursor = 0;
  return declaredSections
    .map((section, index) => {
      const questionCount = counts[index] || 0;
      if (questionCount <= 0) {
        return null;
      }

      const startIndex = cursor;
      const endIndex = Math.min(cursor + questionCount - 1, test.questions.length - 1);
      cursor = endIndex + 1;

      return {
        name: section.name,
        questionCount: endIndex - startIndex + 1,
        startIndex,
        endIndex,
      };
    })
    .filter((section): section is ExamSection => Boolean(section));
};

const getExamFamily = (test: MockTest): ExamFamily => {
  const source = `${test.category} ${test.title} ${test.type}`.toLowerCase();

  if (source.includes('bank') || source.includes('ibps') || source.includes('sbi') || source.includes('clerk') || source.includes('po')) {
    return 'banking';
  }

  if (source.includes('rrb') || source.includes('railway')) {
    return 'rrb';
  }

  if (source.includes('ssc')) {
    return 'ssc';
  }

  return 'default';
};

const buildMockRollNumber = (userId: string | undefined, testId: string) => {
  const source = `${userId || 'candidate'}${testId}`;
  const digits = source
    .split('')
    .map((character) => String(character.charCodeAt(0) % 10))
    .join('');

  return digits.slice(0, 12).padEnd(12, '0');
};

const getExamFamilyLabel = (family: ExamFamily) => {
  if (family === 'ssc') {
    return 'SSC CBT Interface';
  }

  if (family === 'rrb') {
    return 'RRB CBT Interface';
  }

  if (family === 'banking') {
    return 'Banking CBT Interface';
  }

  return 'CBT Exam Interface';
};

const getExamFamilySupportCopy = (family: ExamFamily) => {
  if (family === 'ssc') {
    return 'Built to feel like a full SSC exam simulation with instructions, declaration, and a real question palette.';
  }

  if (family === 'rrb') {
    return 'Structured like a railway CBT experience so topic tests and full mocks feel operational, not generic.';
  }

  if (family === 'banking') {
    return 'Prepared for banking-style mocks with declaration, language selection, and a high-focus solving layout.';
  }

  return 'Prepared as a clean CBT workflow so learners move from instructions to declaration to the actual test environment.';
};

const getExamInstructionChecklist = (test: MockTest) => [
  `The exam timer starts only after you click "I am ready to begin" and runs continuously until submission or timeout.`,
  `This mock contains ${test.questions.length} questions for a maximum of ${test.totalMarks} marks in ${test.durationMinutes} minutes.`,
  `Use Save & Next to store your answer and move ahead. Use Mark for Review when you want to revisit a question before final submission.`,
  `You may move between questions through the palette at the right side. Status colors always update live while you attempt the paper.`,
  `Negative marking is ${test.negativeMarking} for every incorrect answer. Unattempted questions are not penalized.`,
  'The final scorecard and explanations will appear immediately after you submit the paper.',
];

const getDeclarationChecklist = (test: MockTest) => [
  `The test contains ${test.questions.length} total questions.`,
  `Each question carries its configured marks and uses the same negative marking settings as the real mock.`,
  `You are expected to complete the exam in ${test.durationMinutes} minutes without refreshing or closing the window.`,
  'Changing questions from the palette does not auto-save the current response unless you use Save & Next.',
  'Marked for review questions stay highlighted so you can revisit them before the timer ends.',
  'This exam can be submitted any time before the timer reaches zero.',
];

const getExamQuestionState = (
  questionId: string,
  answers: Record<string, number>,
  visitedQuestions: Record<string, boolean>,
  reviewQuestions: Record<string, boolean>,
): ExamQuestionState => {
  const isAnswered = answers[questionId] !== undefined;
  const isVisited = Boolean(visitedQuestions[questionId]);
  const isReview = Boolean(reviewQuestions[questionId]);

  if (isReview && isAnswered) {
    return 'answered-review';
  }

  if (isReview) {
    return 'review';
  }

  if (isAnswered) {
    return 'answered';
  }

  if (isVisited) {
    return 'unanswered';
  }

  return 'unvisited';
};

const getQuestionStateButtonClasses = (state: ExamQuestionState, active: boolean) => cn(
  'relative flex h-10 w-full min-w-[42px] items-center justify-center border text-sm font-semibold transition',
  active && 'ring-2 ring-[#2598e8] ring-offset-2 ring-offset-white',
  state === 'unvisited' && 'rounded-md border-slate-500 bg-white text-slate-700',
  state === 'unanswered' && 'rounded-[12px] border-[#c64a2f] bg-[#c64a2f] text-white',
  state === 'answered' && 'rounded-[12px] border-[#2dad5c] bg-[#2dad5c] text-white',
  state === 'review' && 'rounded-[999px] border-[#8c53d8] bg-[#8c53d8] text-white',
  state === 'answered-review' && 'rounded-[999px] border-[#8c53d8] bg-[#8c53d8] text-white',
);

const TestPlayer = ({
  test,
  onClose,
  onSubmitted,
}: {
  test: MockTest;
  onClose: () => void;
  onSubmitted: (result: TestAttemptResult) => void;
}) => {
  const { user } = useAuth();
  const stageContentRef = useRef<HTMLElement | null>(null);
  const examMainRef = useRef<HTMLElement | null>(null);
  const [stage, setStage] = useState<ExamStage>('instructions');
  const [workspaceTab, setWorkspaceTab] = useState<ExamWorkspaceTab>('question');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<string, boolean>>({});
  const [reviewQuestions, setReviewQuestions] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(test.durationMinutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [questionZoom, setQuestionZoom] = useState(1);
  const [calculatorExpression, setCalculatorExpression] = useState('');
  const [calculatorResult, setCalculatorResult] = useState('0');

  const examFamily = useMemo(() => getExamFamily(test), [test]);
  const examSections = useMemo(() => buildExamSections(test), [test]);
  const rollNumber = useMemo(() => buildMockRollNumber(user?._id, test._id), [test._id, user?._id]);
  const instructionChecklist = useMemo(() => getExamInstructionChecklist(test), [test]);
  const declarationChecklist = useMemo(() => getDeclarationChecklist(test), [test]);
  const currentQuestion = test.questions[currentIndex];
  const questionTextClass = ['text-lg leading-8', 'text-xl leading-9', 'text-2xl leading-10'][questionZoom];

  const currentSection = useMemo(() => (
    examSections.find((section) => currentIndex >= section.startIndex && currentIndex <= section.endIndex)
    || examSections[0]
    || null
  ), [currentIndex, examSections]);

  const currentSectionIndex = currentSection ? examSections.findIndex((section) => section.name === currentSection.name) : 0;
  const currentSectionLabel = `PART-${String.fromCharCode(65 + Math.max(currentSectionIndex, 0))}`;
  const currentQuestionNumberInSection = currentSection ? (currentIndex - currentSection.startIndex + 1) : (currentIndex + 1);

  const questionStates = useMemo(() => test.questions.reduce<Record<string, ExamQuestionState>>((stateMap, question) => {
    stateMap[question.id] = getExamQuestionState(question.id, answers, visitedQuestions, reviewQuestions);
    return stateMap;
  }, {}), [answers, reviewQuestions, test.questions, visitedQuestions]);

  const statusCounts = useMemo(() => test.questions.reduce((counts, question) => {
    const state = questionStates[question.id];
    if (state === 'answered') {
      counts.answered += 1;
    } else if (state === 'answered-review') {
      counts.answeredReview += 1;
    } else if (state === 'review') {
      counts.review += 1;
    } else if (state === 'unanswered') {
      counts.unanswered += 1;
    } else {
      counts.unvisited += 1;
    }

    return counts;
  }, {
    answered: 0,
    answeredReview: 0,
    review: 0,
    unanswered: 0,
    unvisited: 0,
  }), [questionStates, test.questions]);

  const answeredCount = statusCounts.answered + statusCounts.answeredReview;
  const attentionCount = statusCounts.unanswered + statusCounts.review + statusCounts.unvisited;

  useEffect(() => {
    if (stage !== 'exam' || !currentQuestion) {
      return;
    }

    setVisitedQuestions((current) => (
      current[currentQuestion.id]
        ? current
        : { ...current, [currentQuestion.id]: true }
    ));
  }, [currentQuestion, stage]);

  useEffect(() => {
    if (stage !== 'exam' || submitting) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [stage, submitting]);

  useEffect(() => {
    if (stage === 'exam' && timeLeft === 0 && !submitting) {
      void submitTest(true);
    }
  }, [stage, submitting, timeLeft]);

  useEffect(() => {
    stageContentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    examMainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [stage, workspaceTab, currentIndex]);

  useEffect(() => {
    if (!draggingCalculator) {
      return undefined;
    }

    const handlePointerMove = (event: MouseEvent) => {
      const container = examMainRef.current;
      const panel = calculatorPanelRef.current;
      if (!container || !panel) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const nextX = event.clientX - containerRect.left - calculatorDragOffsetRef.current.x;
      const nextY = event.clientY - containerRect.top - calculatorDragOffsetRef.current.y;
      const maxX = Math.max(container.clientWidth - panelRect.width - 12, 12);
      const maxY = Math.max(container.clientHeight - panelRect.height - 12, 12);

      setCalculatorPosition({
        x: Math.min(Math.max(nextX, 12), maxX),
        y: Math.min(Math.max(nextY, 12), maxY),
      });
    };

    const stopDragging = () => {
      setDraggingCalculator(false);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopDragging);
    };
  }, [draggingCalculator]);

  const handleExit = () => {
    if (stage === 'exam' && startedAt && !submitting) {
      const confirmed = window.confirm('Exit this exam interface now? Your current mock progress will not be submitted.');
      if (!confirmed) {
        return;
      }
    }

    onClose();
  };

  const goToQuestion = (questionIndex: number) => {
    setCurrentIndex(Math.min(Math.max(questionIndex, 0), Math.max(test.questions.length - 1, 0)));
    setWorkspaceTab('question');
  };

  const saveCurrentResponse = () => {
    if (!currentQuestion) {
      return;
    }

    setVisitedQuestions((current) => ({ ...current, [currentQuestion.id]: true }));
  };

  const moveToNextQuestion = () => {
    if (currentIndex < test.questions.length - 1) {
      goToQuestion(currentIndex + 1);
    }
  };

  const submitTest = async (forced = false) => {
    if (!user || submitting) {
      return;
    }

    if (!forced) {
      const confirmed = window.confirm('Submit this mock test now? You will move to the scorecard immediately after submission.');
      if (!confirmed) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const effectiveStartedAt = startedAt || new Date().toISOString();
      const result = await EduService.submitMockTest(test._id, answers, effectiveStartedAt);
      onSubmitted(result);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndNext = () => {
    saveCurrentResponse();

    if (currentIndex === test.questions.length - 1) {
      return;
    }

    moveToNextQuestion();
  };

  const handleToggleReview = () => {
    if (!currentQuestion) {
      return;
    }

    const isMarked = Boolean(reviewQuestions[currentQuestion.id]);
    setVisitedQuestions((current) => ({ ...current, [currentQuestion.id]: true }));
    setReviewQuestions((current) => {
      const nextState = { ...current };
      if (isMarked) {
        delete nextState[currentQuestion.id];
      } else {
        nextState[currentQuestion.id] = true;
      }
      return nextState;
    });

    if (!isMarked && currentIndex < test.questions.length - 1) {
      moveToNextQuestion();
    }
  };

  const handleClearResponse = () => {
    if (!currentQuestion) {
      return;
    }

    setAnswers((current) => {
      const nextAnswers = { ...current };
      delete nextAnswers[currentQuestion.id];
      return nextAnswers;
    });
    setVisitedQuestions((current) => ({ ...current, [currentQuestion.id]: true }));
  };

  const appendCalculatorValue = (value: string) => {
    setCalculatorExpression((current) => `${current}${value}`);
  };

  const evaluateCalculator = () => {
    const normalizedExpression = calculatorExpression
      .replace(/x/g, '*')
      .replace(/X/g, '*')
      .replace(/÷/g, '/');

    if (!normalizedExpression.trim()) {
      setCalculatorResult('0');
      return;
    }

    if (!/^[0-9+\-*/().\s]+$/.test(normalizedExpression)) {
      setCalculatorResult('Invalid');
      return;
    }

    try {
      const value = Function(`"use strict"; return (${normalizedExpression});`)();
      setCalculatorResult(Number.isFinite(value) ? String(value) : 'Invalid');
    } catch {
      setCalculatorResult('Invalid');
    }
  };

  const candidatePanel = (
    <aside className="border-l border-slate-200 bg-[#f5f8fc] p-6">
      <div className="rounded-[30px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-sky-100 text-sky-600">
          <UserCircle2 className="h-16 w-16" />
        </div>
        <p className="mt-5 text-4xl font-semibold text-slate-900">{user?.name || 'Candidate'}</p>
        <p className="mt-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{test.category}</p>
        <div className="mt-6 grid gap-3 text-left">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Roll Number</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{rollNumber}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Duration</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{test.durationMinutes} mins</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Sections</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{examSections.length || 1}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 rounded-[28px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Interface style</p>
        <p className="mt-3 text-lg font-semibold text-slate-900">{getExamFamilyLabel(examFamily)}</p>
        <p className="mt-3 text-sm leading-7 text-slate-600">{getExamFamilySupportCopy(examFamily)}</p>
      </div>
    </aside>
  );

  const renderQuestionView = () => {
    if (!currentQuestion) {
      return (
        <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-slate-600">
          No questions are available in this mock test yet.
        </div>
      );
    }

    const currentQuestionState = questionStates[currentQuestion.id];

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-green-600 px-4 py-2 text-lg font-semibold text-white">{currentSectionLabel}</span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{currentSection?.name || 'Section'}</p>
            <p className="mt-1 text-sm text-slate-600">
              Question {currentIndex + 1} of {test.questions.length}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleToggleReview}
            className="rounded-lg bg-[#2f69d9] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#275bbf]"
          >
            {currentQuestionState === 'review' || currentQuestionState === 'answered-review' ? 'Unmark Review' : 'Mark for Review'}
          </button>
          <button
            onClick={handleSaveAndNext}
            className="rounded-lg bg-[#2f69d9] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#275bbf]"
          >
            {currentIndex === test.questions.length - 1 ? 'Save Response' : 'Save & Next'}
          </button>
          <button
            onClick={() => void submitTest()}
            disabled={submitting}
            className="rounded-lg bg-[#2f69d9] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#275bbf] disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : 'Submit Test'}
          </button>
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-3xl font-semibold text-slate-900">Question No. {currentIndex + 1}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                <span className="rounded-full bg-slate-100 px-3 py-2">{currentQuestion.topic}</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">+{currentQuestion.marks} marks</span>
                <span className="rounded-full bg-slate-100 px-3 py-2">-{test.negativeMarking} negative</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
                <span className="font-semibold">Select Language</span>
                <select
                  value={selectedLanguage}
                  onChange={(event) => setSelectedLanguage(event.target.value)}
                  className="bg-transparent outline-none"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                </select>
              </div>
              <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600">
                Report
              </button>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="rounded-[28px] border border-slate-200">
              <div className="border-b border-slate-200 px-6 py-6">
                <p className={cn('font-medium text-slate-900', questionTextClass)}>{currentQuestion.questionText}</p>
              </div>

              <div className="divide-y divide-slate-200">
                {currentQuestion.options.map((option, optionIndex) => {
                  const isSelected = answers[currentQuestion.id] === optionIndex;

                  return (
                    <button
                      key={`${currentQuestion.id}-${option}`}
                      onClick={() => {
                        setAnswers((current) => ({ ...current, [currentQuestion.id]: optionIndex }));
                        setVisitedQuestions((current) => ({ ...current, [currentQuestion.id]: true }));
                        setWorkspaceTab('question');
                      }}
                      className={cn(
                        'grid w-full grid-cols-[84px_minmax(0,1fr)] items-center text-left transition',
                        isSelected ? 'bg-sky-50' : 'bg-white hover:bg-slate-50',
                      )}
                    >
                      <div className="flex h-full items-center justify-center border-r border-slate-200 py-6">
                        <div className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-full border text-lg font-semibold',
                          isSelected
                            ? 'border-sky-500 bg-sky-500 text-white'
                            : 'border-slate-300 bg-white text-slate-600',
                        )}>
                          {String.fromCharCode(65 + optionIndex)}
                        </div>
                      </div>
                      <div className="px-6 py-6 text-lg leading-8 text-slate-800">{option}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => goToQuestion(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Previous
          </button>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleClearResponse}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            >
              Clear Response
            </button>
            <button
              onClick={handleSaveAndNext}
              className="rounded-lg bg-[#2f69d9] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#275bbf]"
            >
              {currentIndex === test.questions.length - 1 ? 'Save Response' : 'Save & Next'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSymbolsView = () => (
    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Status legend</p>
          <h3 className="mt-2 text-3xl font-semibold text-slate-900">Question palette symbols</h3>
        </div>
        <button
          onClick={() => setWorkspaceTab('question')}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Return to question
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {questionStateLegend.map((item) => (
          <div key={item.state} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-4">
              <div className={getQuestionStateButtonClasses(item.state, false)}>1</div>
              <div>
                <p className="text-lg font-semibold text-slate-900">{item.label}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[24px] bg-[#f6fbff] p-5">
        <p className="text-sm font-semibold text-slate-900">How to use the controls</p>
        <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
          <p>Save & Next stores the current answer and moves you forward in the paper.</p>
          <p>Mark for Review flags the question so it stands out in the palette and summary before final submission.</p>
          <p>Total answered, unvisited, and review counts update in real time on the right panel.</p>
        </div>
      </div>
    </div>
  );

  const renderInstructionsView = () => (
    <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Exam guide</p>
          <h3 className="mt-2 text-3xl font-semibold text-slate-900">Instructions</h3>
        </div>
        <button
          onClick={() => setWorkspaceTab('question')}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Return to question
        </button>
      </div>

      <ol className="mt-6 space-y-4 pl-6 text-base leading-8 text-slate-700">
        {instructionChecklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>

      <div className="mt-6 rounded-[24px] bg-[#f9fbff] p-5">
        <p className="text-sm font-semibold text-slate-900">Sections in this paper</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {examSections.map((section) => (
            <span key={section.name} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
              {section.name} • {section.questionCount} questions
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSummaryView = () => {
    const pendingQuestions = test.questions
      .map((question, index) => ({
        question,
        index,
        state: questionStates[question.id],
      }))
      .filter((item) => item.state !== 'answered' && item.state !== 'answered-review');

    return (
      <div className="space-y-6">
        <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Review snapshot</p>
              <h3 className="mt-2 text-3xl font-semibold text-slate-900">Overall test summary</h3>
            </div>
            <button
              onClick={() => setWorkspaceTab('question')}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Return to question
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-5">
            <div className="rounded-[24px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Answered</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">{answeredCount}</p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Not Answered</p>
              <p className="mt-2 text-3xl font-semibold text-orange-500">{statusCounts.unanswered}</p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Review</p>
              <p className="mt-2 text-3xl font-semibold text-violet-600">{statusCounts.review + statusCounts.answeredReview}</p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unvisited</p>
              <p className="mt-2 text-3xl font-semibold text-slate-700">{statusCounts.unvisited}</p>
            </div>
            <div className="rounded-[24px] bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Attention</p>
              <p className="mt-2 text-3xl font-semibold text-rose-500">{attentionCount}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <p className="text-lg font-semibold text-slate-900">Section wise coverage</p>
            <div className="mt-5 space-y-4">
              {examSections.map((section, sectionIndex) => {
                const sectionQuestions = test.questions.slice(section.startIndex, section.endIndex + 1);
                const sectionAnswered = sectionQuestions.filter((question) => {
                  const state = questionStates[question.id];
                  return state === 'answered' || state === 'answered-review';
                }).length;

                return (
                  <div key={section.name} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                          PART-{String.fromCharCode(65 + sectionIndex)}
                        </p>
                        <p className="mt-1 text-xl font-semibold text-slate-900">{section.name}</p>
                        <p className="mt-2 text-sm text-slate-600">{sectionAnswered}/{section.questionCount} answered</p>
                      </div>
                      <button
                        onClick={() => goToQuestion(section.startIndex)}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                      >
                        Open section
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
            <p className="text-lg font-semibold text-slate-900">Questions needing attention</p>
            <div className="mt-5 space-y-3">
              {pendingQuestions.length > 0 ? pendingQuestions.map((item) => (
                <button
                  key={item.question.id}
                  onClick={() => goToQuestion(item.index)}
                  className="flex w-full items-center justify-between rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-sky-400 hover:bg-sky-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Question {item.index + 1}</p>
                    <p className="mt-1 text-sm text-slate-600">{questionStateLegend.find((legend) => legend.state === item.state)?.label}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </button>
              )) : (
                <div className="rounded-[20px] bg-emerald-50 px-4 py-5 text-sm font-medium text-emerald-700">
                  Every question has been attempted or saved for review. You are ready for final submission.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCalculatorView = () => (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Exam utility</p>
            <h3 className="mt-2 text-3xl font-semibold text-slate-900">Calculator</h3>
          </div>
          <button
            onClick={() => setWorkspaceTab('question')}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Return to question
          </button>
        </div>

        <div className="mt-6 rounded-[26px] bg-slate-900 p-6 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Expression</p>
          <p className="mt-3 min-h-[56px] break-words text-2xl font-semibold">{calculatorExpression || '0'}</p>
          <div className="mt-5 border-t border-white/10 pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Result</p>
            <p className="mt-3 text-3xl font-semibold text-sky-300">{calculatorResult}</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-7 text-slate-600">
          This quick calculator stays inside the exam screen so learners do not need to leave the paper for rough arithmetic.
        </p>
      </div>

      <div className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)]">
        <div className="grid grid-cols-4 gap-3">
          {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '(', ')'].map((item) => (
            <button
              key={item}
              onClick={() => appendCalculatorValue(item)}
              className="rounded-2xl bg-slate-100 px-4 py-4 text-lg font-semibold text-slate-900 transition hover:bg-slate-200"
            >
              {item}
            </button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <button
            onClick={() => {
              setCalculatorExpression('');
              setCalculatorResult('0');
            }}
            className="rounded-2xl bg-rose-100 px-4 py-4 text-lg font-semibold text-rose-700 transition hover:bg-rose-200"
          >
            C
          </button>
          <button
            onClick={() => setCalculatorExpression((current) => current.slice(0, -1))}
            className="rounded-2xl bg-amber-100 px-4 py-4 text-lg font-semibold text-amber-700 transition hover:bg-amber-200"
          >
            DEL
          </button>
          <button
            onClick={() => appendCalculatorValue('+')}
            className="rounded-2xl bg-slate-100 px-4 py-4 text-lg font-semibold text-slate-900 transition hover:bg-slate-200"
          >
            +
          </button>
        </div>
        <button
          onClick={evaluateCalculator}
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-[#2f69d9] px-5 py-4 text-lg font-semibold text-white transition hover:bg-[#275bbf]"
        >
          =
        </button>
      </div>
    </div>
  );

  const renderWorkspace = () => {
    if (workspaceTab === 'symbols') {
      return renderSymbolsView();
    }

    if (workspaceTab === 'calculator') {
      return renderCalculatorView();
    }

    if (workspaceTab === 'instructions') {
      return renderInstructionsView();
    }

    if (workspaceTab === 'summary') {
      return renderSummaryView();
    }

    return renderQuestionView();
  };

  const examScreen = (
    <div className="flex h-full flex-col bg-[#f3f7fb]">
      <div className="border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_auto] xl:items-center">
          <div>
            <p className="text-4xl font-bold text-sky-500">EduMaster</p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{test.title}</p>
          </div>
          <div className="text-center">
            <h3 className="text-[38px] font-semibold text-slate-900">{test.title}</h3>
            <p className="mt-2 text-xl font-semibold text-slate-700">Roll No : {rollNumber}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={() => setQuestionZoom((current) => Math.min(current + 1, 2))}
              className="rounded-xl bg-[#2f69d9] px-4 py-3 text-sm font-semibold text-white"
            >
              Zoom (+)
            </button>
            <button
              onClick={() => setQuestionZoom((current) => Math.max(current - 1, 0))}
              className="rounded-xl bg-[#2f69d9] px-4 py-3 text-sm font-semibold text-white"
            >
              Zoom (-)
            </button>
            <div className="rounded-[20px] bg-[#fff8bf] px-5 py-3 text-right">
              <p className="text-sm font-semibold text-slate-700">Time Left</p>
              <p className="text-4xl font-semibold text-red-600">{formatTimeLeft(timeLeft).replace(':', ' : ')}</p>
            </div>
            <button
              onClick={handleExit}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700"
            >
              Exit Test
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          {examWorkspaceTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setWorkspaceTab(tab.id)}
              className={cn(
                'text-xl font-semibold underline-offset-4 transition',
                workspaceTab === tab.id ? 'text-[#c34b32] underline' : 'text-[#1f7ecb] hover:text-[#185d97]',
              )}
            >
              {tab.label.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="rounded-full bg-[#fff7ce] px-4 py-3 text-lg font-semibold text-slate-800">
          Total Questions Answered: <span className="text-[#ff2400]">{answeredCount}</span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="overflow-y-auto px-6 py-6">
          {renderWorkspace()}
        </main>

        <aside className="border-l border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-5">
            <div className="flex flex-col items-center rounded-[28px] bg-[#f5f8fc] px-4 py-6 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                <UserCircle2 className="h-14 w-14" />
              </div>
              <p className="mt-4 text-4xl font-semibold text-slate-900">{user?.name || 'Candidate'}</p>
              <p className="mt-2 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">{test.category}</p>
            </div>
          </div>

          <div className="h-[calc(100vh-212px)] overflow-y-auto px-5 py-5">
            <div className="rounded-[28px] border border-slate-200 bg-white p-4">
              <p className="text-3xl font-semibold text-slate-900">Question palette</p>
              <div className="mt-5 space-y-5">
                {examSections.map((section) => (
                  <div key={section.name}>
                    <div className="flex items-center gap-3">
                      <div className="h-0 w-0 border-y-[12px] border-y-transparent border-l-[18px] border-l-sky-500" />
                      <p className="text-lg font-semibold text-slate-900">{section.name}</p>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-3">
                      {test.questions.slice(section.startIndex, section.endIndex + 1).map((question, sectionQuestionIndex) => {
                        const questionIndex = section.startIndex + sectionQuestionIndex;
                        const questionState = questionStates[question.id];

                        return (
                          <button
                            key={question.id}
                            onClick={() => goToQuestion(questionIndex)}
                            className={getQuestionStateButtonClasses(questionState, currentIndex === questionIndex)}
                          >
                            {questionIndex + 1}
                            {questionState === 'answered-review' && (
                              <CheckCircle2 className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-white text-emerald-500" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-[28px] border border-slate-300 bg-white">
              <div className="border-b border-slate-300 bg-slate-100 px-4 py-3 text-center text-2xl font-semibold text-slate-900">
                Analysis
              </div>
              <div className="divide-y divide-slate-200 text-lg">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-700">Answered</span>
                  <span className="font-semibold text-[#ffb300]">{answeredCount}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-700">Not Answered</span>
                  <span className="font-semibold text-[#ffb300]">{statusCounts.unanswered}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-700">Mark for Review</span>
                  <span className="font-semibold text-[#ffb300]">{statusCounts.review}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-700">Answered & Review</span>
                  <span className="font-semibold text-[#ffb300]">{statusCounts.answeredReview}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-slate-700">Not Visited</span>
                  <span className="font-semibold text-[#ffb300]">{statusCounts.unvisited}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => void submitTest()}
              disabled={submitting}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-[20px] bg-[#2f69d9] px-5 py-4 text-lg font-semibold text-white transition hover:bg-[#275bbf] disabled:opacity-60"
            >
              {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
              Submit Test
            </button>
          </div>
        </aside>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/70 px-3 py-3 backdrop-blur sm:px-5 sm:py-5">
      <div className="mx-auto flex h-full max-w-[1840px] flex-col overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-[0_30px_120px_rgba(2,8,23,0.32)]">
        {stage === 'instructions' && (
          <div className="flex h-full flex-col bg-[#f3f7fb]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                  <ClipboardCheck className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-4xl font-bold text-sky-500">EduMaster</p>
                  <p className="mt-1 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">{getExamFamilyLabel(examFamily)}</p>
                </div>
              </div>
              <button
                onClick={handleExit}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Go to tests
              </button>
            </div>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="overflow-y-auto px-6 py-6">
                <div className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.06)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">General instructions</p>
                  <h2 className="mt-3 text-5xl font-semibold text-slate-900">{test.title}</h2>
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-[24px] bg-slate-50 p-5">
                      <p className="text-sm text-slate-500">Duration</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">{test.durationMinutes} mins</p>
                    </div>
                    <div className="rounded-[24px] bg-slate-50 p-5">
                      <p className="text-sm text-slate-500">Maximum marks</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">{test.totalMarks}</p>
                    </div>
                    <div className="rounded-[24px] bg-slate-50 p-5">
                      <p className="text-sm text-slate-500">Negative marking</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">{test.negativeMarking}</p>
                    </div>
                  </div>

                  <ol className="mt-8 space-y-4 pl-6 text-lg leading-8 text-slate-700">
                    {instructionChecklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>

                  <div className="mt-8 rounded-[28px] border border-slate-200 bg-[#f8fbff] p-6">
                    <p className="text-lg font-semibold text-slate-900">Question palette meanings</p>
                    <div className="mt-5 space-y-4">
                      {questionStateLegend.map((item) => (
                        <div key={item.state} className="flex items-center gap-4">
                          <div className={getQuestionStateButtonClasses(item.state, false)}>1</div>
                          <p className="text-base text-slate-700">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {candidatePanel}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
              <button
                onClick={handleExit}
                className="rounded-xl border border-slate-300 px-5 py-3 text-lg font-semibold text-slate-700"
              >
                Go to Tests
              </button>
              <button
                onClick={() => setStage('declaration')}
                className="rounded-xl bg-[#2f69d9] px-6 py-3 text-lg font-semibold text-white transition hover:bg-[#275bbf]"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {stage === 'declaration' && (
          <div className="flex h-full flex-col bg-[#f3f7fb]">
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="overflow-y-auto bg-white px-6 py-8">
                <div className="mx-auto max-w-6xl">
                  <div className="text-center">
                    <h2 className="text-6xl font-semibold text-slate-900">{test.title}</h2>
                  </div>

                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-2xl font-semibold text-slate-700">
                    <p>Duration: {test.durationMinutes} Mins</p>
                    <p>Maximum Marks: {test.totalMarks}</p>
                  </div>

                  <div className="mt-8">
                    <p className="text-3xl font-semibold text-slate-900">Read the following instructions carefully.</p>
                    <ol className="mt-5 space-y-4 pl-8 text-xl leading-9 text-slate-700">
                      {declarationChecklist.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-10 rounded-[28px] border border-slate-200 p-6">
                    <div className="flex flex-wrap items-center gap-4">
                      <label className="text-2xl font-semibold text-slate-900">Choose your default language</label>
                      <select
                        value={selectedLanguage}
                        onChange={(event) => setSelectedLanguage(event.target.value)}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xl text-slate-900 outline-none"
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi</option>
                      </select>
                    </div>
                    <p className="mt-4 text-xl leading-8 text-rose-600">
                      Questions currently appear in the selected app language. This selection can be changed later while you are inside the paper.
                    </p>
                  </div>

                  <div className="mt-8 border-t border-slate-200 pt-6">
                    <p className="text-2xl font-semibold text-slate-900">Declaration</p>
                    <label className="mt-5 flex items-start gap-4 text-xl leading-9 text-slate-700">
                      <input
                        type="checkbox"
                        checked={declarationAccepted}
                        onChange={(event) => setDeclarationAccepted(event.target.checked)}
                        className="mt-2 h-6 w-6 rounded border-slate-300"
                      />
                      <span>
                        I have read all the instructions carefully and I am ready to begin this mock test in the real exam-style interface.
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              {candidatePanel}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
              <button
                onClick={() => setStage('instructions')}
                className="rounded-xl border border-slate-300 px-5 py-3 text-lg font-semibold text-slate-700"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setStartedAt(new Date().toISOString());
                  setStage('exam');
                  setWorkspaceTab('question');
                }}
                disabled={!declarationAccepted}
                className="rounded-xl bg-[#79d7ef] px-6 py-3 text-lg font-semibold text-white transition hover:bg-[#56c9e7] disabled:cursor-not-allowed disabled:opacity-50"
              >
                I am ready to begin
              </button>
            </div>
          </div>
        )}

        {stage === 'exam' && examScreen}
      </div>
    </div>
  );
};

void TestPlayer;

const ExactCbtTestPlayer = ({
  test,
  onClose,
  onSubmitted,
}: {
  test: MockTest;
  onClose: () => void;
  onSubmitted: (result: TestAttemptResult) => void;
}) => {
  const { user } = useAuth();
  const stageContentRef = useRef<HTMLElement | null>(null);
  const examMainRef = useRef<HTMLElement | null>(null);
  const [stage, setStage] = useState<ExamStage>('instructions');
  const [workspaceTab, setWorkspaceTab] = useState<ExamWorkspaceTab>('question');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [visitedQuestions, setVisitedQuestions] = useState<Record<string, boolean>>({});
  const [reviewQuestions, setReviewQuestions] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(test.durationMinutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [defaultLanguage, setDefaultLanguage] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('English');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [questionZoom, setQuestionZoom] = useState(1);
  const [examPaused, setExamPaused] = useState(false);
  const [calculatorExpression, setCalculatorExpression] = useState('');
  const [calculatorResult, setCalculatorResult] = useState('0');
  const [calculatorAngleMode, setCalculatorAngleMode] = useState<'deg' | 'rad'>('deg');
  const [calculatorMemory, setCalculatorMemory] = useState(0);
  const [calculatorPosition, setCalculatorPosition] = useState({ x: 300, y: 170 });
  const [draggingCalculator, setDraggingCalculator] = useState(false);
  const calculatorDragOffsetRef = useRef({ x: 0, y: 0 });
  const calculatorPanelRef = useRef<HTMLDivElement | null>(null);
  const paletteScrollRef = useRef<HTMLDivElement | null>(null);

  const examSections = useMemo(() => buildExamSections(test), [test]);
  const rollNumber = useMemo(() => buildMockRollNumber(user?._id, test._id), [test._id, user?._id]);
  const candidateName = user?.name || 'Candidate';
  const currentQuestion = test.questions[currentIndex];
  const questionTextClass = ['text-[14px] leading-7', 'text-[16px] leading-8', 'text-[19px] leading-9'][questionZoom];
  const timerLabel = formatTimeLeft(timeLeft).replace(':', ' : ');

  const currentSection = useMemo(() => (
    examSections.find((section) => currentIndex >= section.startIndex && currentIndex <= section.endIndex)
    || examSections[0]
    || null
  ), [currentIndex, examSections]);

  const currentSectionIndex = currentSection ? examSections.findIndex((section) => section.name === currentSection.name) : 0;
  const currentSectionLabel = `PART-${String.fromCharCode(65 + Math.max(currentSectionIndex, 0))}`;
  const currentQuestionNumberInSection = currentSection ? (currentIndex - currentSection.startIndex + 1) : (currentIndex + 1);

  const questionStates = useMemo(() => test.questions.reduce<Record<string, ExamQuestionState>>((stateMap, question) => {
    stateMap[question.id] = getExamQuestionState(question.id, answers, visitedQuestions, reviewQuestions);
    return stateMap;
  }, {}), [answers, reviewQuestions, test.questions, visitedQuestions]);

  const overallCounts = useMemo(() => test.questions.reduce((counts, question) => {
    const state = questionStates[question.id];
    if (state === 'answered') {
      counts.answered += 1;
    } else if (state === 'answered-review') {
      counts.answeredReview += 1;
    } else if (state === 'review') {
      counts.review += 1;
    } else if (state === 'unanswered') {
      counts.unanswered += 1;
    } else {
      counts.unvisited += 1;
    }

    return counts;
  }, {
    answered: 0,
    answeredReview: 0,
    review: 0,
    unanswered: 0,
    unvisited: 0,
  }), [questionStates, test.questions]);

  const answeredCount = overallCounts.answered + overallCounts.answeredReview;
  const isCurrentQuestionMarkedForReview = currentQuestion ? Boolean(reviewQuestions[currentQuestion.id]) : false;

  const currentSectionCounts = useMemo(() => {
    if (!currentSection) {
      return {
        answered: 0,
        unanswered: 0,
        review: 0,
        answeredReview: 0,
        unvisited: 0,
      };
    }

    return test.questions.slice(currentSection.startIndex, currentSection.endIndex + 1).reduce((counts, question) => {
      const state = questionStates[question.id];
      if (state === 'answered') {
        counts.answered += 1;
      } else if (state === 'answered-review') {
        counts.answeredReview += 1;
      } else if (state === 'review') {
        counts.review += 1;
      } else if (state === 'unanswered') {
        counts.unanswered += 1;
      } else {
        counts.unvisited += 1;
      }

      return counts;
    }, {
      answered: 0,
      unanswered: 0,
      review: 0,
      answeredReview: 0,
      unvisited: 0,
    });
  }, [currentSection, questionStates, test.questions]);

  useEffect(() => {
    if (stage !== 'exam' || !currentQuestion) {
      return;
    }

    setVisitedQuestions((current) => (
      current[currentQuestion.id]
        ? current
        : { ...current, [currentQuestion.id]: true }
    ));
  }, [currentQuestion, stage]);

  useEffect(() => {
    if (stage !== 'exam' || submitting || examPaused) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [examPaused, stage, submitting]);

  useEffect(() => {
    if (stage === 'exam' && timeLeft === 0 && !submitting) {
      void submitTest(true);
    }
  }, [stage, submitting, timeLeft]);

  useEffect(() => {
    stageContentRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    examMainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [stage, workspaceTab, currentIndex]);

  useEffect(() => {
    if (stage !== 'exam') {
      return;
    }

    const activePaletteItem = paletteScrollRef.current?.querySelector<HTMLElement>('[data-active-palette="true"]');
    activePaletteItem?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [currentIndex, currentSection?.name, stage]);

  const handleExit = () => {
    if (stage === 'exam' && startedAt && !submitting) {
      const confirmed = window.confirm('Exit this test now? Your progress will not be submitted.');
      if (!confirmed) {
        return;
      }
    }

    onClose();
  };

  const goToQuestion = (questionIndex: number) => {
    if (stage === 'exam' && currentQuestion) {
      setVisitedQuestions((current) => (
        current[currentQuestion.id]
          ? current
          : { ...current, [currentQuestion.id]: true }
      ));
    }

    setCurrentIndex(Math.min(Math.max(questionIndex, 0), Math.max(test.questions.length - 1, 0)));
    setWorkspaceTab((current) => (current === 'calculator' ? 'calculator' : 'question'));
  };

  const submitTest = async (forced = false) => {
    if (!user || submitting) {
      return;
    }

    if (!forced) {
      const confirmed = window.confirm('Submit this test now?');
      if (!confirmed) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const effectiveStartedAt = startedAt || new Date().toISOString();
      const result = await EduService.submitMockTest(test._id, answers, effectiveStartedAt);
      onSubmitted(result);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndNext = () => {
    if (!currentQuestion) {
      return;
    }

    setVisitedQuestions((current) => ({ ...current, [currentQuestion.id]: true }));
    if (currentIndex < test.questions.length - 1) {
      goToQuestion(currentIndex + 1);
    }
  };

  const handleMarkForReview = () => {
    if (!currentQuestion) {
      return;
    }

    setVisitedQuestions((current) => ({ ...current, [currentQuestion.id]: true }));
    setReviewQuestions((current) => {
      const next = { ...current };
      if (next[currentQuestion.id]) {
        delete next[currentQuestion.id];
      } else {
        next[currentQuestion.id] = true;
      }
      return next;
    });
  };

  const handleClearResponse = () => {
    if (!currentQuestion) {
      return;
    }

    setAnswers((current) => {
      const next = { ...current };
      delete next[currentQuestion.id];
      return next;
    });
    setVisitedQuestions((current) => ({ ...current, [currentQuestion.id]: true }));
  };

  const appendCalculatorValue = (value: string) => {
    setCalculatorExpression((current) => `${current}${value}`);
  };

  const wrapCalculatorExpression = (token: string) => {
    setCalculatorExpression((current) => {
      const trimmed = current.trim();
      return trimmed ? `${token}(${trimmed})` : `${token}(`;
    });
  };

  const evaluateCalculator = () => {
    const normalizedExpression = calculatorExpression.trim();

    if (!normalizedExpression.trim()) {
      setCalculatorResult('0');
      return;
    }

    if (!/^[0-9A-Z_+\-*/%,().\s]+$/.test(normalizedExpression)) {
      setCalculatorResult('Invalid');
      return;
    }

    try {
      const toRadians = (value: number) => (calculatorAngleMode === 'deg' ? (value * Math.PI) / 180 : value);
      const fromRadians = (value: number) => (calculatorAngleMode === 'deg' ? (value * 180) / Math.PI : value);
      const factorial = (value: number) => {
        if (!Number.isInteger(value) || value < 0) {
          throw new Error('Invalid factorial');
        }

        let result = 1;
        for (let index = 2; index <= value; index += 1) {
          result *= index;
        }
        return result;
      };

      const scope = {
        PI: Math.PI,
        CONST_E: Math.E,
        SIN: (value: number) => Math.sin(toRadians(value)),
        COS: (value: number) => Math.cos(toRadians(value)),
        TAN: (value: number) => Math.tan(toRadians(value)),
        ASIN: (value: number) => fromRadians(Math.asin(value)),
        ACOS: (value: number) => fromRadians(Math.acos(value)),
        ATAN: (value: number) => fromRadians(Math.atan(value)),
        SINH: (value: number) => Math.sinh(value),
        COSH: (value: number) => Math.cosh(value),
        TANH: (value: number) => Math.tanh(value),
        ASINH: (value: number) => Math.asinh(value),
        ACOSH: (value: number) => Math.acosh(value),
        ATANH: (value: number) => Math.atanh(value),
        EXP: (value: number) => Math.exp(value),
        LN: (value: number) => Math.log(value),
        LOG10: (value: number) => Math.log10(value),
        LOG2: (value: number) => Math.log2(value),
        SQRT: (value: number) => Math.sqrt(value),
        CBRT: (value: number) => Math.cbrt(value),
        SQR: (value: number) => value ** 2,
        CUBE: (value: number) => value ** 3,
        RECIP: (value: number) => 1 / value,
        ABS: (value: number) => Math.abs(value),
        FACT: (value: number) => factorial(value),
        POW: (left: number, right: number) => left ** right,
        NEG: (value: number) => value * -1,
      };

      const evaluator = Function(
        ...Object.keys(scope),
        `"use strict"; return (${normalizedExpression});`,
      );
      const value = evaluator(...Object.values(scope));
      setCalculatorResult(Number.isFinite(value) ? String(value) : 'Invalid');
    } catch {
      setCalculatorResult('Invalid');
    }
  };

  const toggleFullscreen = async () => {
    if (typeof document === 'undefined') {
      return;
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      return;
    }
  };

  const renderBrandMark = (size: 'sm' | 'md' = 'sm') => {
    const large = size === 'md';

    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-[5px] border border-[#cfd6df] bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.85)]',
          large ? 'h-[39px] w-[39px]' : 'h-[34px] w-[34px]',
        )}
      >
        <div
          className={cn(
            'absolute bottom-[5px] left-[6px] rounded-[1px] bg-[#15395f]',
            large ? 'top-[5px] w-[8px]' : 'top-[4px] w-[7px]',
          )}
        />
        <div
          className={cn(
            'absolute bg-[#23bbe8]',
            large ? 'bottom-[5px] left-[13px] top-[5px] w-[15px]' : 'bottom-[4px] left-[12px] top-[4px] w-[13px]',
          )}
          style={{ clipPath: 'polygon(0 0,100% 10%,100% 72%,56% 100%,0 74%)' }}
        />
      </div>
    );
  };

  const renderSidebarAvatar = () => (
    <div className="flex h-[136px] w-[136px] items-center justify-center rounded-full bg-[#34bddf] text-white">
      <svg viewBox="0 0 120 120" className="h-[78px] w-[78px] fill-current" aria-hidden="true">
        <path d="M60 18c10.1 0 18.3 8.2 18.3 18.3S70.1 54.6 60 54.6s-18.3-8.2-18.3-18.3S49.9 18 60 18Zm0 44.4c17.7 0 32.1 10.4 32.1 23.1V98H27.9V85.5C27.9 72.8 42.3 62.4 60 62.4Z" />
      </svg>
    </div>
  );

  const renderPhotoPlaceholder = (label: string) => (
    <div className="w-[78px] text-center">
      <div className="flex h-[58px] items-center justify-center bg-[#dfe6f1] text-[#99a5b9]">
        <svg viewBox="0 0 120 120" className="h-[42px] w-[42px] fill-current" aria-hidden="true">
          <path d="M60 16c12.4 0 22.4 10.2 22.4 22.8S72.4 61.6 60 61.6 37.6 51.4 37.6 38.8 47.6 16 60 16Zm0 52c22 0 39.9 13.2 39.9 29.5V108H20.1V97.5C20.1 81.2 38 68 60 68Z" />
        </svg>
      </div>
      <p className="mt-1 text-[9px] font-medium leading-[1.15] text-slate-600">{label}</p>
    </div>
  );

  const renderLegendBadge = (state: ExamQuestionState) => (
    <div className="relative flex h-6 w-6 items-center justify-center">
      {state === 'unvisited' && <div className="h-[20px] w-[20px] border border-[#6b7280] bg-white" />}
      {state === 'unanswered' && (
        <div
          className="h-[20px] w-[20px] bg-[#c54c31]"
          style={{ clipPath: 'polygon(0 0,100% 0,100% 64%,50% 100%,0 64%)' }}
        />
      )}
      {state === 'answered' && (
        <div
          className="h-[20px] w-[20px] bg-[#2daa59]"
          style={{ clipPath: 'polygon(0 40%,50% 0,100% 40%,100% 100%,0 100%)' }}
        />
      )}
      {state === 'review' && <div className="h-[20px] w-[20px] rounded-full bg-[#8f4ee2]" />}
      {state === 'answered-review' && (
        <>
          <div className="h-[20px] w-[20px] rounded-full bg-[#8f4ee2]" />
          <div className="absolute -right-[1px] -top-[1px] flex h-3 w-3 items-center justify-center rounded-full bg-white">
            <CheckCircle2 className="h-3 w-3 text-[#2daa59]" />
          </div>
        </>
      )}
    </div>
  );

  const renderPaletteBadge = (state: ExamQuestionState, label: string | number, active = false) => (
    <div className="relative inline-flex flex-col items-center">
      <div
        className={cn(
          'relative flex h-[28px] w-[38px] items-center justify-center rounded-[7px] border px-1 text-[11px] font-semibold leading-none transition',
          active && 'border-[#fff36d] bg-[#fff36d] text-[#111111]',
          !active && state === 'unvisited' && 'border-[#2237dd] bg-[#2237dd] text-white',
          !active && state === 'unanswered' && 'border-[#2237dd] bg-[#2237dd] text-white',
          !active && state === 'answered' && 'border-[#2dad5c] bg-[#2dad5c] text-white',
          !active && state === 'review' && 'border-[#ff1414] bg-[#ff1414] text-white',
          !active && state === 'answered-review' && 'border-[#2dad5c] bg-[#2dad5c] text-white',
        )}
      >
        {label}
        {state === 'answered-review' && (
          <CheckCircle2 className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-white text-[#2dad5c]" />
        )}
      </div>
      {active && (
        <div className="absolute top-[29px] h-0 w-0 border-x-[5px] border-x-transparent border-t-[9px] border-t-black" />
      )}
    </div>
  );

  const renderInstructionBody = (compact = false) => (
    <div className={cn(compact ? 'space-y-4' : 'space-y-5', 'text-[13px] leading-[1.65] text-slate-800')}>
      <div>
        <p className="text-[14px] font-semibold text-slate-900">General Instructions:</p>
        <ol className="mt-3 list-decimal space-y-3 pl-7">
          <li>
            The clock will be set at the server. The countdown timer at the top right corner of screen will display the remaining time available for you
            to complete the examination. When the timer reaches zero, the examination will end by itself. You need not terminate the examination or submit
            your paper.
          </li>
          <li>
            The Question Palette displayed on the right side of screen will show the status of each question using one of the following symbols:
          </li>
        </ol>
      </div>

      <div className="ml-7 space-y-2.5">
        {questionStateLegend.map((item) => (
          <div key={item.state} className="flex items-center gap-3">
            {renderLegendBadge(item.state)}
            <p>{item.description}</p>
          </div>
        ))}
      </div>

      <p>
        <span className="font-semibold">The Mark For Review</span> status for a question simply indicates that you would like to look at that question again.
        If a question is answered, but marked for review, then the answer will be considered for evaluation unless the status is modified by the candidate.
      </p>

      <div>
        <p className="text-[14px] font-semibold text-slate-900">Navigating to a Question :</p>
        <ol start={3} className="mt-3 list-decimal space-y-3 pl-7">
          <li>
            To answer a question, do the following:
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>
                Click on the question number in the Question Palette at the right of your screen to go to that numbered question directly. Note that using
                this option does NOT save your answer to the current question.
              </li>
              <li>
                Click on <span className="font-semibold">Save &amp; Next</span> to save your answer for the current question and then go to the next question.
              </li>
              <li>
                Click on <span className="font-semibold">Mark for Review &amp; Next</span> to save your answer for the current question and also mark it for review,
                and then go to the next question.
              </li>
            </ol>
          </li>
        </ol>
      </div>

      <p>
        Note that your answer for the current question will not be saved, if you navigate to another question directly by clicking on a question number without
        saving the answer to the previous question.
      </p>

      <p>
        You can view all the questions by clicking on the <span className="font-semibold">Question Paper</span> button.
        <span className="ml-1 text-[#e5503f]">
          This feature is provided, so that if you want you can just see the entire question paper at a glance.
        </span>
      </p>

      <div>
        <p className="text-[14px] font-semibold text-slate-900">Answering a Question :</p>
        <ol start={4} className="mt-3 list-decimal space-y-3 pl-7">
          <li>
            Procedure for answering a multiple choice (MCQ) type question:
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>Choose one answer from the 4 options (A,B,C,D) given below the question, click on the bubble placed before the chosen option.</li>
              <li>To deselect your chosen answer, click on the bubble of the chosen option again or click on the <span className="font-semibold">Clear Response</span> button.</li>
              <li>To change your chosen answer, click on the bubble of another option.</li>
              <li>To save your answer, you MUST click on the <span className="font-semibold">Save &amp; Next</span> button.</li>
            </ol>
          </li>
          <li>
            Procedure for answering a numerical answer type question :
            <ol className="mt-2 list-decimal space-y-1.5 pl-5">
              <li>To enter a number as your answer, use the virtual numerical keypad.</li>
              <li>
                A fraction (e.g. -0.3 or -.3) can be entered as an answer with or without &apos;0&apos; before the decimal point.
                <span className="ml-1 text-[#e5503f]">
                  As many as four decimal points, e.g. 12.5435 or 0.003 or -932.6711 or 12.82 can be entered.
                </span>
              </li>
              <li>To clear your answer, click on the <span className="font-semibold">Clear Response</span> button.</li>
              <li>To save your answer, you MUST click on the <span className="font-semibold">Save &amp; Next</span> button.</li>
            </ol>
          </li>
          <li>
            To mark a question for review, click on the <span className="font-semibold">Mark for Review &amp; Next</span> button. If an answer is selected
            (for MCQ/MCAQ) entered (for numerical answer type) for a question that is <span className="font-semibold">Marked For Review</span>, that answer
            will be considered in the evaluation unless the status is modified by the candidate.
          </li>
          <li>
            To change your answer to a question that has already been answered, first select that question for answering and then follow the procedure for
            answering that type of question.
          </li>
          <li>
            Note that <span className="font-semibold">ONLY</span> questions for which answers are <span className="font-semibold">saved</span> or
            <span className="font-semibold"> marked for review after answering</span> will be considered for evaluation.
          </li>
          <li>
            Sections in this question paper are displayed on the top bar of the screen. Questions in a Section can be viewed by clicking on the name of that Section.
            The Section you are currently viewing will be highlighted.
          </li>
          <li>
            After clicking the <span className="font-semibold">Save &amp; Next</span> button for the last question in a Section, you will automatically be taken to
            the first question of the next Section in sequence.
          </li>
          <li>
            You can move the mouse cursor over the name of a Section to view the answering status for that Section.
          </li>
        </ol>
      </div>
    </div>
  );

  const renderExamRichText = (content: string, className: string, imageClassName?: string) => {
    const trimmed = String(content || '').trim();
    const isHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
    const isStandaloneImage = /^(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg))(?:\?\S*)?$/i.test(trimmed);

    if (isStandaloneImage) {
      return <img src={trimmed} alt="" className={cn('max-w-full', imageClassName)} />;
    }

    if (isHtml) {
      return <div className={className} dangerouslySetInnerHTML={{ __html: trimmed }} />;
    }

    return <div className={cn(className, 'whitespace-pre-wrap')}>{trimmed}</div>;
  };

  const startCalculatorDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const panel = calculatorPanelRef.current;
    if (!panel) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    calculatorDragOffsetRef.current = {
      x: event.clientX - panelRect.left,
      y: event.clientY - panelRect.top,
    };
    setDraggingCalculator(true);
  };

  const renderQuestionView = () => {
    if (!currentQuestion) {
      return <div className="border border-slate-300 bg-white p-8 text-[13px] text-slate-600">No questions found.</div>;
    }

    return (
        <div className="space-y-4">
          <p className="text-[18px] font-semibold text-[#333333]">Question No. {currentQuestionNumberInSection}</p>

        <div className="border border-[#d6dde7] bg-white">
          <div className="flex items-center justify-end gap-5 border-b border-[#e3e8ef] px-[22px] py-[10px]">
            <label className="flex items-center gap-3 text-[12px] font-semibold text-slate-700">
              <span>Select Language</span>
              <select
                value={selectedLanguage}
                onChange={(event) => setSelectedLanguage(event.target.value)}
                className="h-[38px] min-w-[108px] border border-[#cad3de] bg-white px-3 text-[12px] font-normal text-slate-700 outline-none"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
              </select>
            </label>
            <button className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500">
              <AlertTriangle className="h-4 w-4" />
              Report
            </button>
          </div>

          <div className="cbt-scroll h-[calc(100vh-343px)] min-h-[555px] overflow-y-scroll">
            <div className="px-[14px] py-[14px]">
              <div className="border border-[#e2e7ee] bg-white">
                <div className="border-b border-[#e2e7ee] px-5 py-5">
                  {renderExamRichText(
                    currentQuestion.questionText,
                    cn('font-normal text-slate-900', questionTextClass),
                    'max-h-[340px] object-contain',
                  )}
                </div>

                <div className="divide-y divide-[#e2e7ee]">
                  {currentQuestion.options.map((option, optionIndex) => {
                    const isSelected = answers[currentQuestion.id] === optionIndex;

                    return (
                      <button
                        key={`${currentQuestion.id}-${option}`}
                        onClick={() => {
                          setAnswers((current) => ({ ...current, [currentQuestion.id]: optionIndex }));
                          setVisitedQuestions((current) => ({ ...current, [currentQuestion.id]: true }));
                        }}
                        className="grid w-full grid-cols-[58px_minmax(0,1fr)] items-center text-left transition hover:bg-slate-50"
                      >
                        <div className="flex h-full items-center justify-center border-r border-[#e2e7ee] py-6">
                          <div className={cn(
                            'flex h-[19px] w-[19px] items-center justify-center rounded-full border border-slate-400 bg-white',
                            isSelected && 'border-[#1e88e5]',
                          )}>
                            {isSelected && <div className="h-[8px] w-[8px] rounded-full bg-[#1e88e5]" />}
                          </div>
                        </div>
                        <div className="px-[28px] py-[20px]">
                          {renderExamRichText(option, 'text-[14px] leading-[1.5] text-slate-800', 'max-h-[240px] object-contain')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleClearResponse}
            className="h-[42px] min-w-[142px] rounded-[2px] bg-white px-5 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-300"
          >
            Clear Response
          </button>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => goToQuestion(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="h-[42px] min-w-[112px] rounded-[2px] bg-white px-5 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-300 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={handleSaveAndNext}
              className="h-[42px] min-w-[142px] rounded-[2px] bg-[#2f69d9] px-5 text-[12px] font-semibold text-white"
            >
              Save &amp; Next
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSymbolsView = () => (
    <div className="border border-slate-300 bg-white p-5">
      <p className="text-[15px] font-semibold text-slate-900">Symbols</p>
      <div className="mt-4 space-y-3">
        {questionStateLegend.map((item) => (
          <div key={item.state} className="flex items-center gap-3">
            {renderLegendBadge(item.state)}
            <p className="text-[13px] leading-7 text-slate-800">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderInstructionsView = () => (
    <div className="border border-slate-300 bg-white p-5">
      {renderInstructionBody(true)}
    </div>
  );

  const renderSummaryView = () => {
    const unresolvedQuestions = test.questions
      .map((question, index) => ({
        question,
        index,
        state: questionStates[question.id],
      }))
      .filter((item) => item.state !== 'answered' && item.state !== 'answered-review');

    return (
      <div className="space-y-5">
        <div className="border border-slate-300 bg-white p-5">
          <p className="text-[15px] font-semibold text-slate-900">Overall Test Summary</p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <div className="border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Answered</p>
              <p className="mt-2 text-[18px] font-semibold text-slate-900">{answeredCount}</p>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Not Answered</p>
              <p className="mt-2 text-[18px] font-semibold text-slate-900">{overallCounts.unanswered}</p>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Review</p>
              <p className="mt-2 text-[18px] font-semibold text-slate-900">{overallCounts.review + overallCounts.answeredReview}</p>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Not Visited</p>
              <p className="mt-2 text-[18px] font-semibold text-slate-900">{overallCounts.unvisited}</p>
            </div>
            <div className="border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Time Left</p>
              <p className="mt-2 text-[18px] font-semibold text-slate-900">{timerLabel}</p>
            </div>
          </div>
        </div>

        <div className="border border-slate-300 bg-white p-5">
          <p className="text-[15px] font-semibold text-slate-900">Questions Needing Attention</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {unresolvedQuestions.length > 0 ? unresolvedQuestions.map((item) => (
              <button
                key={item.question.id}
                onClick={() => goToQuestion(item.index)}
                className="flex items-center justify-between border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50"
              >
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">Question {item.index + 1}</p>
                  <p className="mt-1 text-[12px] text-slate-600">{questionStateLegend.find((legend) => legend.state === item.state)?.label}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            )) : (
              <div className="border border-emerald-200 bg-emerald-50 px-4 py-4 text-[13px] font-medium text-emerald-700">
                Every question has been attempted or saved for review.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCalculatorView = () => {
    const baseButtonClass = 'flex h-[34px] items-center justify-center rounded-[4px] border border-[#a7a7a7] bg-[#f3f3f3] px-2 text-[12px] font-semibold text-[#454545] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]';

    const scientificButtons = [
      [
        { label: 'sinh', onClick: () => appendCalculatorValue('SINH(') },
        { label: 'cosh', onClick: () => appendCalculatorValue('COSH(') },
        { label: 'tanh', onClick: () => appendCalculatorValue('TANH(') },
        { label: 'Exp', onClick: () => appendCalculatorValue('EXP(') },
        { label: '(', onClick: () => appendCalculatorValue('(') },
        { label: ')', onClick: () => appendCalculatorValue(')') },
        { label: '←', onClick: () => setCalculatorExpression((current) => current.slice(0, -1)), className: 'bg-[#e95d44] text-white' },
        { label: 'C', onClick: () => { setCalculatorExpression(''); setCalculatorResult('0'); }, className: 'bg-[#ef6841] text-white' },
        { label: '+/-', onClick: () => wrapCalculatorExpression('NEG'), className: 'bg-[#ef6841] text-white' },
        { label: '√', onClick: () => wrapCalculatorExpression('SQRT') },
      ],
      [
        { label: 'sinh⁻¹', onClick: () => appendCalculatorValue('ASINH(') },
        { label: 'cosh⁻¹', onClick: () => appendCalculatorValue('ACOSH(') },
        { label: 'tanh⁻¹', onClick: () => appendCalculatorValue('ATANH(') },
        { label: 'log₂x', onClick: () => appendCalculatorValue('LOG2(') },
        { label: 'ln', onClick: () => appendCalculatorValue('LN(') },
        { label: 'log', onClick: () => appendCalculatorValue('LOG10(') },
        { label: '7', onClick: () => appendCalculatorValue('7') },
        { label: '8', onClick: () => appendCalculatorValue('8') },
        { label: '9', onClick: () => appendCalculatorValue('9') },
        { label: '/', onClick: () => appendCalculatorValue('/') },
      ],
      [
        { label: 'π', onClick: () => appendCalculatorValue('PI') },
        { label: 'e', onClick: () => appendCalculatorValue('CONST_E') },
        { label: 'n!', onClick: () => wrapCalculatorExpression('FACT') },
        { label: 'logₓy', onClick: () => appendCalculatorValue('POW(') },
        { label: 'eˣ', onClick: () => wrapCalculatorExpression('EXP') },
        { label: '10ˣ', onClick: () => appendCalculatorValue('POW(10,') },
        { label: '4', onClick: () => appendCalculatorValue('4') },
        { label: '5', onClick: () => appendCalculatorValue('5') },
        { label: '6', onClick: () => appendCalculatorValue('6') },
        { label: '*', onClick: () => appendCalculatorValue('*') },
      ],
      [
        { label: 'sin', onClick: () => appendCalculatorValue('SIN(') },
        { label: 'cos', onClick: () => appendCalculatorValue('COS(') },
        { label: 'tan', onClick: () => appendCalculatorValue('TAN(') },
        { label: 'xʸ', onClick: () => appendCalculatorValue('POW(') },
        { label: 'x³', onClick: () => wrapCalculatorExpression('CUBE') },
        { label: 'x²', onClick: () => wrapCalculatorExpression('SQR') },
        { label: '1', onClick: () => appendCalculatorValue('1') },
        { label: '2', onClick: () => appendCalculatorValue('2') },
        { label: '3', onClick: () => appendCalculatorValue('3') },
        { label: '-', onClick: () => appendCalculatorValue('-') },
      ],
      [
        { label: 'sin⁻¹', onClick: () => appendCalculatorValue('ASIN(') },
        { label: 'cos⁻¹', onClick: () => appendCalculatorValue('ACOS(') },
        { label: 'tan⁻¹', onClick: () => appendCalculatorValue('ATAN(') },
        { label: '√x', onClick: () => wrapCalculatorExpression('SQRT') },
        { label: '∛', onClick: () => wrapCalculatorExpression('CBRT') },
        { label: '|x|', onClick: () => wrapCalculatorExpression('ABS') },
        { label: '0', onClick: () => appendCalculatorValue('0') },
        { label: '.', onClick: () => appendCalculatorValue('.') },
        { label: '+', onClick: () => appendCalculatorValue('+') },
        { label: '=', onClick: evaluateCalculator, className: 'bg-[#2bc56f] text-white' },
      ],
    ];

    return (
      <div
        ref={calculatorPanelRef}
        className="pointer-events-auto absolute z-20 w-[620px] max-w-[calc(100%-24px)] overflow-hidden border border-[#8d8d8d] bg-[#d7d7d7] shadow-[0_10px_24px_rgba(0,0,0,0.22)]"
        style={{ left: `${calculatorPosition.x}px`, top: `${calculatorPosition.y}px` }}
      >
        <div className="overflow-hidden">
          <div
            onMouseDown={startCalculatorDrag}
            className={cn(
              'flex cursor-move select-none items-center justify-between bg-[#4c8cf0] px-2 py-1.5 text-white',
              draggingCalculator && 'cursor-grabbing',
            )}
          >
            <p className="text-[12px] font-normal">Scientific Calculator</p>
            <div className="flex items-center gap-px">
              <button type="button" className="border border-[#437be8] bg-[#4c8cf0] px-3 py-0.5 text-[11px]">Help</button>
              <button type="button" onClick={() => setWorkspaceTab('question')} className="border border-[#437be8] bg-[#4c8cf0] px-3 py-0.5 text-[16px] leading-none">-</button>
              <button type="button" onClick={() => setWorkspaceTab('question')} className="border border-[#437be8] bg-[#4c8cf0] px-3 py-0.5 text-[16px] leading-none">x</button>
            </div>
          </div>

          <div className="bg-[#ececec] p-2">
            <div className="h-[38px] overflow-hidden border border-[#a0a0a0] bg-white px-2 py-1 text-right text-[16px] leading-[28px] text-[#4d4d4d]">
              {calculatorExpression || ''}
            </div>
            <div className="mt-2 h-[40px] overflow-hidden border border-[#a0a0a0] bg-white px-2 py-1 text-right text-[22px] leading-[28px] text-[#1f1f1f]">
              {calculatorResult}
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => appendCalculatorValue('%')} className={cn(baseButtonClass, 'h-[32px] px-3')}>mod</button>
                <label className="flex items-center gap-1 text-[11px] text-[#444]">
                  <input
                    type="radio"
                    checked={calculatorAngleMode === 'deg'}
                    onChange={() => setCalculatorAngleMode('deg')}
                    className="h-3 w-3"
                  />
                  Deg
                </label>
                <label className="flex items-center gap-1 text-[11px] text-[#444]">
                  <input
                    type="radio"
                    checked={calculatorAngleMode === 'rad'}
                    onChange={() => setCalculatorAngleMode('rad')}
                    className="h-3 w-3"
                  />
                  Rad
                </label>
              </div>

              <div className="grid grid-cols-5 gap-2">
                <button onClick={() => setCalculatorMemory(0)} className={baseButtonClass}>MC</button>
                <button onClick={() => appendCalculatorValue(String(calculatorMemory))} className={baseButtonClass}>MR</button>
                <button onClick={() => setCalculatorMemory(Number(calculatorResult) || 0)} className={baseButtonClass}>MS</button>
                <button onClick={() => setCalculatorMemory((current) => current + (Number(calculatorResult) || 0))} className={baseButtonClass}>M+</button>
                <button onClick={() => setCalculatorMemory((current) => current - (Number(calculatorResult) || 0))} className={baseButtonClass}>M-</button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {scientificButtons.map((row, rowIndex) => (
                <div key={`row-${rowIndex}`} className="grid grid-cols-10 gap-2">
                  {row.map((button) => (
                    <button
                      type="button"
                      key={`${rowIndex}-${button.label}`}
                      onClick={button.onClick}
                      className={cn(baseButtonClass, button.className)}
                    >
                      {button.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWorkspace = () => {
    if (workspaceTab === 'calculator') {
      return (
        <div className="relative">
          {renderQuestionView()}
          {renderCalculatorView()}
        </div>
      );
    }

    if (workspaceTab === 'symbols') {
      return renderSymbolsView();
    }

    if (workspaceTab === 'instructions') {
      return renderInstructionsView();
    }

    if (workspaceTab === 'summary') {
      return renderSummaryView();
    }

    return renderQuestionView();
  };

  const preExamHeader = (
    <div className="flex items-center gap-5 border-b border-slate-200 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3">
        {renderBrandMark('md')}
        <p className="text-[18px] font-bold leading-none text-[#1bb9e8]">{CBT_BRAND_NAME}</p>
      </div>
      <p className="text-[13px] font-medium text-slate-800">{test.title}</p>
    </div>
  );

  const preExamSidebar = (
    <aside className="border-l border-slate-200 bg-[#f7f9fc] px-6 py-8">
      <div className="flex h-full flex-col items-center text-center">
        {renderSidebarAvatar()}
        <p className="mt-9 max-w-[190px] text-[24px] font-normal leading-tight text-[#343434]">{candidateName}</p>
      </div>
    </aside>
  );

  const examScreen = (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="grid gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(15,23,42,0.06)] lg:grid-cols-[290px_160px_minmax(0,1fr)_360px] lg:items-center">
        <div className="flex items-center gap-3">
          {renderBrandMark('md')}
          <div>
            <p className="text-[20px] font-bold leading-none text-[#1bb9e8]">{CBT_BRAND_NAME}</p>
            <p className="mt-1 text-[10px] font-semibold leading-tight text-slate-900">{test.title}</p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 lg:justify-start">
          <button
            onClick={() => setQuestionZoom((current) => Math.min(current + 1, 2))}
            className="rounded-[14px] bg-[#2f69d9] px-4 py-2 text-[10px] font-semibold text-white"
          >
            Zoom (+)
          </button>
          <button
            onClick={() => setQuestionZoom((current) => Math.max(current - 1, 0))}
            className="rounded-[14px] bg-[#2f69d9] px-4 py-2 text-[10px] font-semibold text-white"
          >
            Zoom (-)
          </button>
        </div>

        <div className="text-center">
          <p className="text-[17px] font-semibold text-slate-900">{test.title}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-700">Roll No : {rollNumber}</p>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-3">
          <button
            onClick={() => void toggleFullscreen()}
            className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-[#37b3eb] bg-white text-[#37b3eb]"
          >
            <Expand className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExamPaused((current) => !current)}
            className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-[#37b3eb] bg-white text-[#37b3eb]"
          >
            {examPaused ? <PlayCircle className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <div className="px-1 text-right">
            <p className="text-[11px] font-semibold text-slate-800">Time Left</p>
            <p className="mt-1 bg-[#fff36d] px-3 py-1 text-[17px] font-bold tracking-[0.08em] text-red-600">{timerLabel}</p>
          </div>
          <div className="flex gap-2">{renderPhotoPlaceholder('Registration Photo')}{renderPhotoPlaceholder('Captured Photo')}</div>
        </div>
      </div>

      <div className="grid border-b border-slate-200 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="flex flex-wrap items-center gap-5 px-4 py-3">
          {examWorkspaceTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setWorkspaceTab(tab.id)}
              className={cn(
                'text-[11px] font-semibold uppercase underline underline-offset-4',
                tab.id === 'symbols' || tab.id === 'calculator' ? 'text-[#1f78c5]' : 'text-[#cc4b2a]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="border-l border-slate-200 px-4 py-3 text-right">
          <p className="text-[12px] font-semibold text-slate-900">
            Total Questions Answered: <span className="bg-[#fff36d] px-1.5 py-0.5 text-[#ff1b00]">{answeredCount}</span>
          </p>
        </div>
      </div>

      <div className="grid border-b border-slate-200 lg:grid-cols-[minmax(0,1fr)_430px]">
        <div className="px-4 py-3">
          <div className="grid items-center gap-4 xl:grid-cols-[auto_1fr_auto]">
            <div className="flex flex-wrap gap-2">
              {examSections.map((section, sectionIndex) => {
                const sectionLabel = `PART-${String.fromCharCode(65 + sectionIndex)}`;
                const isActiveSection = currentSection?.name === section.name;

                return (
                  <button
                    key={section.name}
                    onClick={() => goToQuestion(section.startIndex)}
                    className={cn(
                      'rounded-[4px] px-4 py-[7px] text-[12px] font-semibold text-white',
                      isActiveSection ? 'bg-[#179b17]' : 'bg-[#2237dd]',
                    )}
                  >
                    {sectionLabel}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-center">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={handleMarkForReview}
                  className={cn(
                    'min-w-[134px] rounded-[4px] px-4 py-[8px] text-[12px] font-semibold',
                    isCurrentQuestionMarkedForReview
                      ? 'bg-[#ece3c9] text-[#242424]'
                      : 'bg-[#2f69d9] text-white',
                  )}
                >
                  {isCurrentQuestionMarkedForReview ? 'Unmark Review' : 'Mark for Review'}
                </button>
                <button onClick={handleSaveAndNext} className="min-w-[122px] rounded-[4px] bg-[#2f69d9] px-4 py-[8px] text-[12px] font-semibold text-white">Save &amp; Next</button>
                <button
                  onClick={() => void submitTest()}
                  disabled={submitting}
                  className="min-w-[114px] rounded-[4px] bg-[#2f69d9] px-4 py-[8px] text-[12px] font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? 'Submitting...' : 'Submit Test'}
                </button>
              </div>
            </div>

            <div />
          </div>
        </div>
        <div className="border-l border-slate-200 bg-white" />
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_430px]">
        <main ref={examMainRef} className="cbt-scroll min-h-0 overflow-y-scroll px-4 py-5">
          {renderWorkspace()}
        </main>

        <aside className="min-h-0 border-l border-slate-200 bg-white">
          <div className="flex h-full min-h-0 flex-col px-4 py-3">
            {currentSection && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <div className="h-0 w-0 border-y-[10px] border-y-transparent border-l-[14px] border-l-[#31a8dd]" />
                  <p className="text-[13px] font-semibold text-slate-900">{currentSection.name}</p>
                </div>

                <div ref={paletteScrollRef} className="cbt-scroll mt-3 min-h-0 flex-1 overflow-y-scroll pr-1">
                  <div
                    className="grid grid-cols-4 justify-items-center gap-y-4 pb-2"
                  >
                    {test.questions.slice(currentSection.startIndex, currentSection.endIndex + 1).map((question, sectionQuestionIndex) => {
                      const questionIndex = currentSection.startIndex + sectionQuestionIndex;
                      const questionState = questionStates[question.id];

                      return (
                        <button
                          key={question.id}
                          data-active-palette={currentIndex === questionIndex ? 'true' : 'false'}
                          onClick={() => goToQuestion(questionIndex)}
                        >
                          {renderPaletteBadge(questionState, sectionQuestionIndex + 1, currentIndex === questionIndex)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-3 shrink-0 border border-slate-400 bg-white">
              <div className="border-b border-slate-400 bg-slate-100 px-3 py-[8px] text-center text-[13px] font-semibold text-slate-900">
                {currentSectionLabel} Analysis
              </div>
              <div className="divide-y divide-slate-200">
                <div className="grid grid-cols-[minmax(0,1fr)_40px] text-[12px]">
                  <span className="px-4 py-[9px] text-slate-700">Answered</span>
                  <span className="flex items-center justify-center border-l border-slate-200 bg-[#fff36d] font-semibold text-[#ff1b00]">{currentSectionCounts.answered + currentSectionCounts.answeredReview}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_40px] text-[12px]">
                  <span className="px-4 py-[9px] text-slate-700">Not Answered</span>
                  <span className="flex items-center justify-center border-l border-slate-200 bg-[#fff36d] font-semibold text-[#ff1b00]">{currentSectionCounts.unanswered + currentSectionCounts.unvisited}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_40px] text-[12px]">
                  <span className="px-4 py-[9px] text-slate-700">Mark for Review</span>
                  <span className="flex items-center justify-center border-l border-slate-200 bg-[#fff36d] font-semibold text-[#ff1b00]">{currentSectionCounts.review + currentSectionCounts.answeredReview}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 bg-white text-slate-900 [font-family:Arial,_Helvetica,_sans-serif]">
      {stage === 'instructions' && (
        <div className="flex h-full flex-col bg-white">
          {preExamHeader}
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section ref={stageContentRef} className="cbt-scroll overflow-y-scroll px-5 py-6">
              {renderInstructionBody()}
            </section>
            {preExamSidebar}
          </div>

          <div className="grid border-t border-slate-200 bg-white lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex items-center justify-between px-5 py-3">
              <button
                onClick={handleExit}
                className="text-[13px] font-medium text-[#4a94cb]"
              >
                ← Go to Tests
              </button>
              <button
                onClick={() => setStage('declaration')}
                className="rounded-[3px] bg-[#7db3ec] px-8 py-2 text-[12px] font-semibold text-white"
              >
                Next
              </button>
            </div>
            <div className="border-l border-slate-200 bg-[#f7f9fc]" />
          </div>
        </div>
      )}

      {stage === 'declaration' && (
        <div className="flex h-full flex-col bg-white">
          {preExamHeader}
          <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section ref={stageContentRef} className="cbt-scroll overflow-y-scroll px-5 py-6">
              <div>
                <p className="text-center text-[21px] font-semibold text-slate-900">{test.title}</p>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-[14px] font-semibold text-slate-800">
                  <p>Duration: {test.durationMinutes} Mins</p>
                  <p>Maximum Marks: {test.totalMarks}</p>
                </div>

                <p className="mt-6 text-[15px] font-semibold text-slate-900">Read the following instructions carefully.</p>
                <ol className="mt-4 list-decimal space-y-3 pl-6 text-[13px] leading-8 text-slate-800">
                  <li>The test contains {test.questions.length} total questions.</li>
                  <li>Each question has 4 Options out of which only one is correct.</li>
                  <li>You have to finish the test in {test.durationMinutes} minutes.</li>
                  <li>Try not to guess the answer as there is negative marking.</li>
                  <li>You will be awarded {test.questions[0]?.marks || 1} mark for each correct answer and {test.negativeMarking} will be deducted for each wrong answer.</li>
                  <li>There is no negative marking for the questions that you have not attempted.</li>
                  <li>You can write this test only once. Make sure that you complete the test before you submit the test and/or close the browser.</li>
                </ol>

                <div className="mt-8 border-y border-slate-200 py-6">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="text-[13px] font-semibold text-slate-900">Choose your default language:</label>
                    <select
                      value={defaultLanguage}
                      onChange={(event) => setDefaultLanguage(event.target.value)}
                      className="h-[35px] border border-slate-300 bg-white px-3 text-[12px] text-slate-900 outline-none"
                    >
                      <option value="">-- Select --</option>
                      <option value="English">English</option>
                      <option value="Hindi">Hindi</option>
                    </select>
                  </div>
                  <p className="mt-4 text-[13px] leading-7 text-[#e54d42]">
                    Please note all questions will appear in your default language. This language can be changed for a particular question later on.
                  </p>
                </div>

                <div className="mt-6">
                  <p className="text-[15px] font-semibold text-slate-900">Declaration:</p>
                  <label className="mt-3 flex items-start gap-3 text-[13px] leading-7 text-slate-800">
                    <input
                      type="checkbox"
                      checked={declarationAccepted}
                      onChange={(event) => setDeclarationAccepted(event.target.checked)}
                      className="mt-1 h-3.5 w-3.5 rounded-none border-slate-300"
                    />
                    <span>
                      I have read all the instructions carefully and have understood them. I agree not to cheat or use unfair means in this examination.
                      I understand that using unfair means of any sort for my own or someone else&apos;s advantage will lead to my immediate disqualification.
                      The decision of {CBT_BRAND_NAME} will be final in these matters and cannot be appealed.
                    </span>
                  </label>
                </div>
              </div>
            </section>
            {preExamSidebar}
          </div>

          <div className="grid border-t border-slate-200 bg-white lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid grid-cols-[auto_1fr_auto] items-center px-5 py-3">
              <button
                onClick={() => setStage('instructions')}
                className="rounded-[3px] bg-[#eef5ff] px-5 py-2 text-[12px] font-semibold text-slate-700 ring-1 ring-slate-300"
              >
                Previous
              </button>
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    setStartedAt(new Date().toISOString());
                    setExamPaused(false);
                    setSelectedLanguage(defaultLanguage || 'English');
                    setStage('exam');
                    setWorkspaceTab('question');
                  }}
                  disabled={!declarationAccepted}
                  className="rounded-[3px] bg-[#72d0e9] px-8 py-2 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  I am ready to begin
                </button>
              </div>
              <div />
            </div>
            <div className="border-l border-slate-200 bg-[#f7f9fc]" />
          </div>
        </div>
      )}

      {stage === 'exam' && examScreen}
    </div>
  );
};

const TestsTab = ({ overview, onRefresh }: { overview: PlatformOverview; onRefresh: () => Promise<void> }) => {
  const [activeTest, setActiveTest] = useState<MockTest | null>(null);
  const [lastResult, setLastResult] = useState<TestAttemptResult | null>(null);
  const [solutionFilter, setSolutionFilter] = useState<'all' | 'correct' | 'incorrect' | 'skipped'>('all');
  const [openSolutions, setOpenSolutions] = useState<Record<string, boolean>>({});
  const filteredSolutions = (lastResult?.solutions || []).filter((solution) => {
    if (solutionFilter === 'all') {
      return true;
    }

    if (solutionFilter === 'skipped') {
      return solution.selectedOption === null;
    }

    const isCorrect = solution.selectedOption !== null && solution.selectedOption === solution.correctOption;
    return solutionFilter === 'correct' ? isCorrect : !isCorrect && solution.selectedOption !== null;
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title="CBT mock test series"
        caption="Instructions, declaration, live timer, palette, scorecard"
        action={lastResult ? (
          <div className="rounded-full bg-[var(--success-soft)] px-4 py-2 text-sm font-semibold text-[var(--success)]">
            Latest result: {lastResult.score}/{lastResult.totalMarks}
          </div>
        ) : undefined}
      />

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {overview.testSeries.map((test) => (
          <div key={test._id} className="rounded-[28px] border border-white/70 bg-white/92 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-full bg-[var(--accent-cream)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-rust)]">
                {test.category}
              </span>
              <span className="text-sm text-[var(--ink-soft)]">{test.durationMinutes} min</span>
            </div>
            <h3 className="mt-4 text-xl font-semibold text-[var(--ink)]">{test.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{test.description}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-[var(--accent-cream)] p-3">
                <p className="text-[var(--ink-soft)]">Marks</p>
                <p className="mt-1 font-semibold text-[var(--ink)]">{test.totalMarks}</p>
              </div>
              <div className="rounded-2xl bg-[var(--accent-cream)] p-3">
                <p className="text-[var(--ink-soft)]">Negative</p>
                <p className="mt-1 font-semibold text-[var(--danger)]">-{test.negativeMarking}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {test.sectionBreakup.map((section) => (
                <span key={section.name} className="rounded-full border border-[var(--line)] px-3 py-2 text-xs text-[var(--ink-soft)]">
                  {section.name}: {section.questions}
                </span>
              ))}
            </div>
            <button
              onClick={() => setActiveTest(test)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--accent-rust)]"
            >
              Open exam instructions
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {lastResult && (
        <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
          <SectionHeader title="Scorecard" caption="Post-test analytics" />
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <MetricCard title="Score" value={`${lastResult.score}`} hint="Final score after negative marking" icon={Trophy} />
            <MetricCard title="Rank" value={`#${lastResult.rank}`} hint="All India style mock ranking" icon={Target} />
            <MetricCard title="Percentile" value={`${lastResult.percentile}%`} hint="Relative performance among attempts" icon={Gauge} />
            <MetricCard title="Accuracy band" value={`${lastResult.correctCount} correct`} hint={`${lastResult.incorrectCount} incorrect, ${lastResult.unattemptedCount} skipped`} icon={ClipboardCheck} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] bg-[var(--accent-cream)] p-5">
              <p className="font-semibold text-[var(--ink)]">Weak topics</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lastResult.weakTopics.map((topic) => (
                  <span key={topic} className="rounded-full bg-white px-3 py-2 text-sm text-[var(--danger)]">{topic}</span>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] bg-[var(--accent-cream)] p-5">
              <p className="font-semibold text-[var(--ink)]">Strong topics</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {lastResult.strongTopics.map((topic) => (
                  <span key={topic} className="rounded-full bg-white px-3 py-2 text-sm text-[var(--success)]">{topic}</span>
                ))}
              </div>
            </div>
          </div>
          {lastResult.solutions.length > 0 && (
            <div className="mt-6 rounded-[24px] border border-[var(--line)] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-[var(--ink)]">Solutions with explanations</p>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">Each explanation is already stored with the test and is revealed only when the learner opens it.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(['all', 'correct', 'incorrect', 'skipped'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setSolutionFilter(filter)}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm font-semibold capitalize transition',
                        solutionFilter === filter
                          ? 'bg-[var(--ink)] text-white'
                          : 'bg-[var(--accent-cream)] text-[var(--ink-soft)]',
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {filteredSolutions.map((solution) => {
                  const originalIndex = lastResult.solutions.findIndex((item) => item.questionId === solution.questionId);
                  return (
                    <MockSolutionCard
                      key={solution.questionId}
                      solution={solution}
                      index={originalIndex >= 0 ? originalIndex : 0}
                      open={Boolean(openSolutions[solution.questionId])}
                      onToggle={() => setOpenSolutions((current) => ({
                        ...current,
                        [solution.questionId]: !current[solution.questionId],
                      }))}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {activeTest && (
          <ExactCbtTestPlayer
            test={activeTest}
            onClose={() => setActiveTest(null)}
            onSubmitted={async (result) => {
              setLastResult(result);
              setActiveTest(null);
              await onRefresh();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const QuizTab = ({ overview, onRefresh }: { overview: PlatformOverview; onRefresh: () => Promise<void> }) => {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DailyQuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openQuizSolutions, setOpenQuizSolutions] = useState<Record<string, boolean>>({});

  const quiz = overview.dailyQuiz?.quiz;
  const attemptedCount = quiz ? quiz.questions.filter((question) => Boolean(answers[question.id])).length : 0;

  const submitQuiz = async () => {
    if (!quiz || !user) {
      return;
    }

    setSubmitting(true);
    try {
      const orderedAnswers = quiz.questions.map((question) => answers[question.id] || '');
      const quizResult = await EduService.submitDailyQuiz(quiz._id, orderedAnswers);
      setResult(quizResult);
      await onRefresh();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.55fr]">
      <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Daily quiz system" caption="5 to 20 questions • instant result • streaks" />
        {quiz ? (
          <div className="mt-6 space-y-5">
            {quiz.questions.map((question, index) => (
              <div key={question.id} className="rounded-[26px] border border-[var(--line)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--ink-soft)]">Question {index + 1}</p>
                <h3 className="mt-3 text-lg font-semibold text-[var(--ink)]">{question.prompt}</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {question.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                      className={cn(
                        'rounded-[20px] border px-4 py-4 text-left text-sm transition',
                        answers[question.id] === option
                          ? 'border-[var(--accent-rust)] bg-[var(--accent-cream)]'
                          : 'border-[var(--line)] bg-white hover:border-[var(--accent-rust)]/40',
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                {result?.review.find((entry) => entry.questionId === question.id) && (
                  <QuizReviewCard
                    reviewItem={result.review.find((entry) => entry.questionId === question.id)!}
                    questionIndex={index}
                    open={Boolean(openQuizSolutions[question.id])}
                    onToggle={() => setOpenQuizSolutions((current) => ({
                      ...current,
                      [question.id]: !current[question.id],
                    }))}
                  />
                )}
              </div>
            ))}

            <button
              onClick={() => void submitQuiz()}
              disabled={submitting}
              className="flex items-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white"
            >
              {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              Submit daily quiz
            </button>
            {result && (
              <div className="rounded-[24px] bg-[var(--success-soft)] p-5 text-[var(--success)]">
                You scored {result.score}/{result.total}. Your streak and leaderboard are updated on the backend.
              </div>
            )}
          </div>
        ) : (
          <p className="mt-6 text-sm text-[var(--ink-soft)]">No daily quiz is scheduled right now.</p>
        )}
      </section>

      <aside className="space-y-6">
        <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
          <SectionHeader title="Streak & rank" caption="Engagement loop" />
          <div className="mt-6 grid gap-4">
            <MetricCard title="Attempted" value={`${attemptedCount}/${quiz?.questions.length || 0}`} hint="Live progress inside today's quiz" icon={ClipboardCheck} />
            <MetricCard title="Current streak" value={`${overview.dailyQuiz?.streak || 0} days`} hint="Attempt before midnight to extend it" icon={Flame} />
            <MetricCard title="Leaderboard" value={`${overview.dailyQuiz?.leaderboard.length || 0} visible`} hint="Daily and weekly style positioning" icon={Trophy} />
            {result && <MetricCard title="Latest score" value={`${result.score}/${result.total}`} hint="Solutions unlock below each question" icon={Sparkles} />}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
          <SectionHeader title="Today’s leaderboard" caption="Top performers" />
          <div className="mt-6 space-y-3">
            {(overview.dailyQuiz?.leaderboard || []).map((entry, index) => (
              <div key={`${entry.userId}-${entry.submittedAt}`} className="flex items-center justify-between rounded-[20px] bg-[var(--accent-cream)] px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">Rank #{index + 1}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{entry.name || entry.userId}</p>
                </div>
                <p className="text-lg font-semibold text-[var(--accent-rust)]">{entry.score}/{entry.total}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
          <SectionHeader title="Weekly leaderboard" caption="Seven-day engagement ranking" />
          <div className="mt-6 space-y-3">
            {(overview.dailyQuiz?.weeklyLeaderboard || []).map((entry, index) => (
              <div key={`${entry.userId}-${entry.submittedAt}-weekly`} className="flex items-center justify-between rounded-[20px] bg-[var(--accent-cream)] px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">Rank #{index + 1}</p>
                  <p className="text-xs text-[var(--ink-soft)]">{entry.name || entry.userId} • {entry.attempts || 1} attempts</p>
                </div>
                <p className="text-lg font-semibold text-[var(--accent-rust)]">{entry.score}/{entry.total}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
};

const LiveTab = ({
  overview,
  onRefresh,
  initialLiveClassId = null,
}: {
  overview: PlatformOverview;
  onRefresh: () => Promise<void>;
  initialLiveClassId?: string | null;
}) => {
  const { user } = useAuth();
  const [selectedLiveClassId, setSelectedLiveClassId] = useState<string | null>(initialLiveClassId || overview.liveClasses[0]?._id || null);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatKind, setChatKind] = useState<'chat' | 'doubt'>('chat');
  const [chatBusy, setChatBusy] = useState(false);
  const [access, setAccess] = useState<LiveClassAccess | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'saving'>('idle');
  const [adminCourseId, setAdminCourseId] = useState('');
  const [adminModuleId, setAdminModuleId] = useState('');
  const [adminChapterId, setAdminChapterId] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const playbackSectionRef = useRef<HTMLDivElement | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingContextRef = useRef<{
    liveClassId: string;
    title: string;
    durationMinutes: number;
    courseId: string;
    moduleId: string;
    chapterId: string | null;
  } | null>(null);
  const selectedLiveClass = useMemo(
    () => overview.liveClasses.find((item) => item._id === selectedLiveClassId) || overview.liveClasses[0] || null,
    [overview.liveClasses, selectedLiveClassId],
  );
  const adminSelectedCourse = useMemo(
    () => overview.courses.find((course) => course._id === adminCourseId) || null,
    [overview.courses, adminCourseId],
  );
  const adminSelectedModule = useMemo(
    () => adminSelectedCourse?.modules?.find((module) => module.id === adminModuleId) || null,
    [adminSelectedCourse, adminModuleId],
  );

  useEffect(() => {
    if (initialLiveClassId && overview.liveClasses.some((item) => item._id === initialLiveClassId)) {
      setSelectedLiveClassId(initialLiveClassId);
    }
  }, [initialLiveClassId, overview.liveClasses]);

  useEffect(() => {
    setAdminCourseId(selectedLiveClass?.courseId || '');
    setAdminModuleId(selectedLiveClass?.moduleId || '');
    setAdminChapterId(selectedLiveClass?.chapterId || '');
  }, [selectedLiveClass?._id, selectedLiveClass?.courseId, selectedLiveClass?.moduleId, selectedLiveClass?.chapterId]);

  const stopRecordingTracks = () => {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  };

  const clearRecordingSession = () => {
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    recordingContextRef.current = null;
    stopRecordingTracks();
    setRecordingState('idle');
  };

  const buildRecordingContext = (liveClass = selectedLiveClass) => {
    if (!liveClass?._id) {
      throw new Error('Choose a live class first.');
    }

    if (!adminCourseId || !adminModuleId) {
      throw new Error('Choose the course and subject before starting this live class.');
    }

    return {
      liveClassId: liveClass._id,
      title: liveClass.title,
      durationMinutes: liveClass.durationMinutes,
      courseId: adminCourseId,
      moduleId: adminModuleId,
      chapterId: adminChapterId || null,
    };
  };

  const startLectureRecording = async (context = buildRecordingContext()) => {
    if (recordingState === 'recording') {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('This browser does not support live recording.');
    }

    if (typeof MediaRecorder === 'undefined') {
      throw new Error('Media recording is not supported in this browser.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 24, max: 30 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    recordingStreamRef.current = stream;
    recordedChunksRef.current = [];

    const recorder = new MediaRecorder(
      stream,
      MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? { mimeType: 'video/webm;codecs=vp9,opus' }
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? { mimeType: 'video/webm;codecs=vp8,opus' }
          : undefined,
    );

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      stopRecordingTracks();
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    recordingContextRef.current = context;
    setRecordingState('recording');
  };

  const stopLectureRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      clearRecordingSession();
      return null;
    }

    setRecordingState('saving');

    const recordedFile = await new Promise<File | null>((resolve) => {
      const recordingContext = recordingContextRef.current;
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
        clearRecordingSession();

        if (!blob.size) {
          resolve(null);
          return;
        }

        const extension = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const safeTitle = (recordingContext?.title || 'live-class').replace(/\s+/g, '-').toLowerCase();
        resolve(new File([blob], `${safeTitle}-${Date.now()}.${extension}`, {
          type: recorder.mimeType || `video/${extension}`,
        }));
      };
      recorder.stop();
    });

    return recordedFile;
  };

  const discardLectureRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      clearRecordingSession();
      return;
    }

    setRecordingState('saving');
    await new Promise<void>((resolve) => {
      recorder.onstop = () => {
        clearRecordingSession();
        resolve();
      };
      recorder.stop();
    });
  };

  const uploadLectureRecording = async (recordedFile: File, context = recordingContextRef.current) => {
    if (!context?.courseId || !context?.moduleId) {
      throw new Error('Map this live class to a course and subject before saving the recording.');
    }

    const upload = await EduService.uploadVideoToModule(
      context.courseId,
      context.moduleId,
      recordedFile,
      `${context.title} Recording`,
      context.durationMinutes,
      true,
      context.chapterId || undefined,
    ) as any;

    return upload?.video?.id || null;
  };

  const syncLiveClassPath = async () => {
    if (!selectedLiveClass?._id) {
      throw new Error('Choose a live class first.');
    }

    if (!adminCourseId || !adminModuleId) {
      throw new Error('Choose the course and subject before starting this live class.');
    }

    const nextPayload: Partial<typeof selectedLiveClass> = {
      courseId: adminCourseId,
      moduleId: adminModuleId,
      moduleTitle: adminSelectedModule?.title || null,
      chapterId: adminChapterId || null,
      chapterTitle: adminSelectedModule?.chapters?.find((chapter) => chapter.id === adminChapterId)?.title || null,
      replayCourseId: adminCourseId,
    };

    await EduService.updateLiveClass(selectedLiveClass._id, nextPayload);
  };

  useEffect(() => {
    if (!selectedLiveClass?._id || !user) {
      setChatMessages([]);
      return;
    }

    let cancelled = false;
    void EduService.getLiveChat(selectedLiveClass._id).then((messages) => {
      if (!cancelled) {
        setChatMessages(messages);
      }
    }).catch(() => {
      if (!cancelled) {
        setChatMessages([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedLiveClass?._id, user]);

  useEffect(() => {
    if (!selectedLiveClass?._id || !user) {
      setAccess(null);
      setAccessError(null);
      return;
    }

    let cancelled = false;
    setAccessBusy(true);
    void EduService.getLiveClassAccess(selectedLiveClass._id)
      .then((payload) => {
        if (!cancelled) {
          setAccess(payload);
          setAccessError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAccess(null);
          setAccessError(error instanceof Error ? error.message : 'Secure access could not be prepared right now.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAccessBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedLiveClass?._id, user]);

  const sendLiveMessage = async () => {
    if (!selectedLiveClass || !user || !chatMessage.trim()) {
      return;
    }

    setChatBusy(true);
    try {
      const posted = await EduService.postLiveChat(selectedLiveClass._id, chatMessage, chatKind);
      setChatMessages((current) => [...current, posted]);
      setChatMessage('');
      setChatKind('chat');
    } finally {
      setChatBusy(false);
    }
  };

  const refreshLiveAccess = async () => {
    if (!selectedLiveClass?._id || !user) {
      return;
    }

    setAccessBusy(true);
    try {
      const payload = await EduService.getLiveClassAccess(selectedLiveClass._id);
      setAccess(payload);
      setAccessError(null);
    } catch (error) {
      setAccess(null);
      setAccessError(error instanceof Error ? error.message : 'Secure access could not be prepared right now.');
    } finally {
      setAccessBusy(false);
    }
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void onRefresh();
    }, 20_000);

    return () => window.clearInterval(intervalId);
  }, [onRefresh]);

  const scrollToPlayback = () => {
    playbackSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleStudentJoinLive = async () => {
    if (!selectedLiveClass?._id || !user) {
      return;
    }

    await refreshLiveAccess();
    window.setTimeout(() => {
      scrollToPlayback();
    }, 120);
  };

  const handleLiveClassSelection = async (nextLiveClassId: string) => {
    if (nextLiveClassId === selectedLiveClassId) {
      return;
    }

    if (recordingState === 'saving') {
      setAdminMessage('Please wait until the current recording finishes saving.');
      return;
    }

    if (recordingState === 'recording') {
      const shouldDiscard = window.confirm('A recording is still running. Switch classes and discard the current unsaved recording?');
      if (!shouldDiscard) {
        return;
      }
      await discardLectureRecording();
      setAdminMessage('The unfinished recording was discarded before switching classes.');
    }

    setSelectedLiveClassId(nextLiveClassId);
  };

  const adminStartLive = async () => {
    if (!selectedLiveClass?._id) {
      return;
    }

    setAdminBusy(true);
    setAdminMessage(null);
    try {
      await syncLiveClassPath();
      const recordingContext = buildRecordingContext(selectedLiveClass);
      let recordingWarning: string | null = null;

      try {
        await startLectureRecording(recordingContext);
      } catch (error) {
        recordingWarning = error instanceof Error ? error.message : 'Recording could not be started automatically.';
      }

      await EduService.startLiveClass(selectedLiveClass._id);
      await onRefresh();
      await refreshLiveAccess();

      setAdminMessage(
        recordingWarning
          ? `Live class started, but automatic recording could not begin: ${recordingWarning}`
          : 'Live class started and recording began automatically.',
      );
    } catch (error) {
      if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== 'inactive') {
        await discardLectureRecording().catch(() => undefined);
      }
      setAdminMessage(error instanceof Error ? error.message : 'Unable to start live class.');
    } finally {
      setAdminBusy(false);
    }
  };

  const adminEndLive = async () => {
    if (!selectedLiveClass?._id) {
      return;
    }

    setAdminBusy(true);
    setAdminMessage(null);
    try {
      const liveClassId = selectedLiveClass._id;
      const recordingContext = recordingContextRef.current || (() => {
        try {
          return buildRecordingContext(selectedLiveClass);
        } catch {
          return null;
        }
      })();
      const recordedFile = await stopLectureRecording();
      let replayLessonId = selectedLiveClass.replayLessonId || null;
      let uploadError: string | null = null;

      if (recordedFile) {
        try {
          replayLessonId = await uploadLectureRecording(recordedFile, recordingContext);
        } catch (error) {
          uploadError = error instanceof Error ? error.message : 'Recording upload failed.';
        }
      }

      await EduService.endLiveClass(liveClassId, {
        replayAvailable: Boolean(replayLessonId),
        replayCourseId: recordingContext?.courseId || selectedLiveClass.courseId || null,
        replayLessonId,
        recordingUrl: null,
      });
      await onRefresh();
      await refreshLiveAccess();
      setAdminMessage(
        replayLessonId
          ? 'Live class ended and the recording was saved under the selected topic.'
          : uploadError
            ? `Live class ended, but the recording could not be saved: ${uploadError}`
            : 'Live class ended. No recording file was available to save.',
      );
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Unable to end live class.');
    } finally {
      setAdminBusy(false);
    }
  };

  const adminStartRecordingOnly = async () => {
    setAdminBusy(true);
    setAdminMessage(null);
    try {
      await syncLiveClassPath();
      const recordingContext = buildRecordingContext(selectedLiveClass);
      await startLectureRecording(recordingContext);
      setAdminMessage('Lecture recording started.');
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Unable to start recording.');
    } finally {
      setAdminBusy(false);
    }
  };

  const adminStopRecordingOnly = async () => {
    setAdminBusy(true);
    setAdminMessage(null);
    try {
      const recordingContext = recordingContextRef.current || (() => {
        try {
          return buildRecordingContext(selectedLiveClass);
        } catch {
          return null;
        }
      })();
      const recordedFile = await stopLectureRecording();
      if (!recordedFile) {
        setAdminMessage('No recording was captured.');
        return;
      }

      const replayLessonId = await uploadLectureRecording(recordedFile, recordingContext);
      await EduService.updateLiveClass(selectedLiveClass?._id || '', {
        replayAvailable: Boolean(replayLessonId),
        replayCourseId: recordingContext?.courseId || selectedLiveClass?.courseId || null,
        replayLessonId,
        recordingUrl: null,
      });
      await onRefresh();
      setAdminMessage('Recording saved under the selected topic.');
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Unable to save recording.');
    } finally {
      setAdminBusy(false);
    }
  };

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopRecordingTracks();
  }, []);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Live classes & replay" caption="WebRTC / Zoom / Agora ready" />
        <div className="mt-6 space-y-4">
          {overview.liveClasses.map((liveClass) => (
            <button
              key={liveClass._id}
              onClick={() => void handleLiveClassSelection(liveClass._id)}
              className={cn(
                'w-full rounded-[26px] border p-4 text-left transition',
                selectedLiveClass?._id === liveClass._id
                  ? 'border-[var(--accent-rust)] bg-[var(--accent-cream)]'
                  : 'border-[var(--line)] bg-white hover:border-[var(--accent-rust)]/35',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn(
                  'rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]',
                  (liveClass.status || liveClass.mode) === 'live' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-white text-[var(--accent-rust)]',
                )}>
                  {liveClass.status || liveClass.mode}
                </span>
                <span className="text-sm text-[var(--ink-soft)]">{liveClass.provider}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--ink)]">{liveClass.title}</h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">{liveClass.instructor}</p>
              <p className="mt-3 text-sm text-[var(--ink-soft)]">{formatDateTime(liveClass.startTime)} • {liveClass.attendees}/{liveClass.maxAttendees || 1000} learners</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {liveClass.joinEnabled && (
                  <span className="rounded-full bg-[var(--success-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--success)]">
                    Join available
                  </span>
                )}
                {liveClass.replayReady && (
                  <span className="rounded-full bg-[var(--accent-cream)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-rust)]">
                    Replay ready
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        {selectedLiveClass ? (
          <>
            <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--ink-soft)]">{selectedLiveClass.provider}</p>
                  <h3 className="mt-2 text-3xl font-semibold text-[var(--ink)]">{selectedLiveClass.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">
                    {selectedLiveClass.mode === 'live'
                      ? 'Attend the class inside EduMaster with protected playback, chat, and replay handoff.'
                      : 'Replay stays available inside the platform so learners can revisit the session later.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-[var(--ink-soft)]">
                  <span>Capacity target: {selectedLiveClass.maxAttendees || 1000}</span>
                  <span>Enrollment: {selectedLiveClass.requiresEnrollment === false ? 'Open to logged-in users' : 'Protected'}</span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <MetricCard title="Format" value={selectedLiveClass.livePlaybackType || selectedLiveClass.mode} hint="Protected in-app delivery" icon={Radio} />
                <MetricCard title="Chat" value={selectedLiveClass.chatEnabled ? 'On' : 'Off'} hint="Real-time class discussion" icon={MessageSquare} />
                <MetricCard title="Recordings" value={selectedLiveClass.replayAvailable ? 'Stored' : 'None'} hint="Replay available after class ends" icon={Video} />
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {!user ? (
                  <button
                    onClick={scrollToPlayback}
                    className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 font-semibold text-[var(--ink)]"
                  >
                    Log in to join
                  </button>
                ) : selectedLiveClass.joinEnabled ? (
                  <button
                    onClick={() => void handleStudentJoinLive()}
                    disabled={accessBusy}
                    className="rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {accessBusy ? 'Preparing join...' : 'Join live now'}
                  </button>
                ) : selectedLiveClass.replayReady ? (
                  <button
                    onClick={scrollToPlayback}
                    className="rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white"
                  >
                    Watch replay
                  </button>
                ) : (
                  <div className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 text-sm font-medium text-[var(--ink-soft)]">
                    {(selectedLiveClass.status || '').toLowerCase() === 'scheduled'
                      ? 'Join button appears automatically when the class goes live.'
                      : 'Live access will appear here when the class starts.'}
                  </div>
                )}
                {access?.accessType === 'embedded-room' && access.roomUrl && (
                  <a
                    href={access.roomUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 font-semibold text-[var(--ink)]"
                  >
                    Open in new tab
                  </a>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {selectedLiveClass.topicTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[var(--accent-cream)] px-3 py-2 text-xs text-[var(--ink)]">{tag}</span>
                ))}
              </div>

              {user?.role === 'admin' && (
                <div className="mt-6 rounded-[24px] border border-[var(--line)] bg-[var(--accent-cream)] p-4">
                  <div className="mb-4 grid gap-3 md:grid-cols-3">
                    <select
                      value={adminCourseId}
                      onChange={(event) => {
                        setAdminCourseId(event.target.value);
                        setAdminModuleId('');
                        setAdminChapterId('');
                      }}
                      disabled={adminBusy || recordingState !== 'idle'}
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none"
                    >
                      <option value="">Choose course</option>
                      {overview.courses.map((course) => (
                        <option key={course._id} value={course._id}>{course.title}</option>
                      ))}
                    </select>
                    <select
                      value={adminModuleId}
                      onChange={(event) => {
                        setAdminModuleId(event.target.value);
                        setAdminChapterId('');
                      }}
                      disabled={!adminSelectedCourse || adminBusy || recordingState !== 'idle'}
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none disabled:opacity-60"
                    >
                      <option value="">Choose subject</option>
                      {(adminSelectedCourse?.modules || []).map((module) => (
                        <option key={module.id} value={module.id}>{module.title}</option>
                      ))}
                    </select>
                    <select
                      value={adminChapterId}
                      onChange={(event) => setAdminChapterId(event.target.value)}
                      disabled={!adminSelectedModule || adminBusy || recordingState !== 'idle'}
                      className="rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm text-[var(--ink)] outline-none disabled:opacity-60"
                    >
                      <option value="">Choose topic (optional)</option>
                      {(adminSelectedModule?.chapters || []).map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>{chapter.title}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm text-[var(--ink-soft)]">
                    Live path:
                    {' '}
                    {[adminSelectedCourse?.title, adminSelectedModule?.title, adminSelectedModule?.chapters?.find((chapter) => chapter.id === adminChapterId)?.title]
                      .filter(Boolean)
                      .join(' > ') || 'Choose course and subject before starting live.'}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => void adminStartLive()}
                      disabled={adminBusy || (selectedLiveClass.status || '').toLowerCase() === 'live'}
                      className="rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white disabled:opacity-60"
                    >
                      {adminBusy ? 'Working...' : 'Start Live Now'}
                    </button>
                    <button
                      onClick={() => void adminEndLive()}
                      disabled={adminBusy || (selectedLiveClass.status || '').toLowerCase() !== 'live'}
                      className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 font-semibold text-[var(--ink)] disabled:opacity-60"
                    >
                      End Live
                    </button>
                    <button
                      onClick={() => void adminStartRecordingOnly()}
                      disabled={adminBusy || recordingState === 'recording'}
                      className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 font-semibold text-[var(--ink)] disabled:opacity-60"
                    >
                      {recordingState === 'recording' ? 'Recording On' : 'Start Recording'}
                    </button>
                    <button
                      onClick={() => void adminStopRecordingOnly()}
                      disabled={adminBusy || recordingState !== 'recording'}
                      className="rounded-2xl border border-[var(--line)] bg-white px-5 py-3 font-semibold text-[var(--ink)] disabled:opacity-60"
                    >
                      Stop Recording
                    </button>
                    <span className="text-sm text-[var(--ink-soft)]">
                      Admin controls are available directly in the live-class screen. Recording is saved into the mapped course path.
                    </span>
                  </div>
                  {adminMessage && (
                    <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-[var(--ink)]">
                      {adminMessage}
                    </div>
                  )}
                </div>
              )}

              <div ref={playbackSectionRef} className="mt-6">
                {!user ? (
                  <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
                    Log in to join the protected live class inside the app.
                  </div>
                ) : accessBusy ? (
                  <div className="flex items-center gap-3 rounded-[24px] border border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Preparing secure live access…
                  </div>
                ) : access ? (
                  <div className="space-y-4">
                    {(access.accessType === 'webrtc-live' || access.accessType === 'livekit-room') && selectedLiveClass ? (
                      <LiveBroadcastViewer liveClassId={selectedLiveClass._id} access={access} />
                    ) : (
                      <ProtectedLivePlayback access={access} />
                    )}
                    <div className="rounded-[24px] bg-[var(--accent-cream)] p-4 text-sm text-[var(--ink-soft)]">
                      {access.statusMessage}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
                    {accessError || 'Secure access could not be prepared right now.'}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
              <SectionHeader title="Live chat & doubts" caption="Backend-synced class thread" />
              <div className="mt-6 space-y-3">
                {chatMessages.length > 0 ? chatMessages.map((message) => (
                  <div key={message._id} className="rounded-[22px] bg-[var(--accent-cream)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--ink)]">{message.userName}</p>
                      <span className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]',
                        message.kind === 'doubt' ? 'bg-white text-[var(--accent-rust)]' : 'bg-white text-[var(--ink-soft)]',
                      )}>
                        {message.kind}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">{message.message}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">{formatDateTime(message.createdAt)}</p>
                  </div>
                )) : (
                  <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-sm text-[var(--ink-soft)]">
                    No class messages yet. Start the first chat or doubt thread.
                  </div>
                )}
              </div>

              {selectedLiveClass.chatEnabled && user && (
                <div className="mt-6 rounded-[24px] border border-[var(--line)] p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setChatKind('chat')}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm font-medium',
                        chatKind === 'chat' ? 'bg-[var(--ink)] text-white' : 'bg-[var(--accent-cream)] text-[var(--ink)]',
                      )}
                    >
                      Class chat
                    </button>
                    <button
                      onClick={() => setChatKind('doubt')}
                      className={cn(
                        'rounded-full px-4 py-2 text-sm font-medium',
                        chatKind === 'doubt' ? 'bg-[var(--accent-rust)] text-white' : 'bg-[var(--accent-cream)] text-[var(--ink)]',
                      )}
                    >
                      Ask doubt
                    </button>
                  </div>
                  <textarea
                    value={chatMessage}
                    onChange={(event) => setChatMessage(event.target.value)}
                    className="mt-4 h-28 w-full rounded-[20px] border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 text-sm outline-none"
                    placeholder={chatKind === 'doubt' ? 'Ask your class doubt here…' : 'Send a message to the live class thread…'}
                  />
                  <button
                    onClick={() => void sendLiveMessage()}
                    disabled={chatBusy}
                    className="mt-4 flex items-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white disabled:opacity-60"
                  >
                    {chatBusy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    Send to class thread
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--line)] p-8 text-[var(--ink-soft)]">
            Select a live class to see room access, replay, and chat.
          </div>
        )}
      </section>
    </div>
  );
};

const AnalyticsTab = ({ overview }: { overview: PlatformOverview }) => {
  const { user } = useAuth();
  const [aiMessage, setAiMessage] = useState('');
  const [aiReply, setAiReply] = useState<AiResponse | null>(null);
  const [asking, setAsking] = useState(false);

  const sendAi = async (message: string) => {
    if (!user || !message.trim()) {
      return;
    }

    setAsking(true);
    try {
      const response = await EduService.askAi(message);
      setAiReply(response);
      setAiMessage(message);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Performance analytics" caption="Accuracy, speed, topic health" />
        <div className="mt-6 grid gap-4">
          <MetricCard title="Accuracy" value={`${overview.analytics.accuracy}%`} hint="Derived from quiz + mock test results" icon={Target} />
          <MetricCard title="Speed" value={`${overview.analytics.speed}x`} hint="Tracks pace for mock environments" icon={Gauge} />
          <MetricCard title="Attempts" value={`${overview.analytics.attempts}`} hint="Quiz and test participation count" icon={ClipboardCheck} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] bg-[var(--accent-cream)] p-4">
            <p className="font-semibold text-[var(--ink)]">Weak topics</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {overview.analytics.weakTopics.map((topic) => (
                <span key={topic} className="rounded-full bg-white px-3 py-2 text-sm text-[var(--danger)]">{topic}</span>
              ))}
            </div>
          </div>
          <div className="rounded-[24px] bg-[var(--accent-cream)] p-4">
            <p className="font-semibold text-[var(--ink)]">Strong topics</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(overview.analytics.strongTopics.length > 0 ? overview.analytics.strongTopics : ['General Awareness']).map((topic) => (
                <span key={topic} className="rounded-full bg-white px-3 py-2 text-sm text-[var(--success)]">{topic}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 rounded-[24px] bg-[var(--card-dark)] p-5 text-white">
          <p className="text-sm font-semibold">Recommendation engine</p>
          <p className="mt-3 text-sm leading-7 text-white/75">{overview.analytics.suggestions[0]}</p>
        </div>
        <div className="mt-6 rounded-[24px] border border-[var(--line)] p-5">
          <p className="text-sm font-semibold text-[var(--ink)]">Adaptive test difficulty</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-[var(--accent-cream)] px-3 py-2 text-sm text-[var(--ink)]">
              Next: {overview.analytics.adaptivePlan.nextTestType}
            </span>
            <span className="rounded-full bg-[var(--accent-cream)] px-3 py-2 text-sm text-[var(--ink)]">
              Difficulty: {overview.analytics.adaptivePlan.difficulty}
            </span>
          </div>
          <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{overview.analytics.adaptivePlan.reason}</p>
        </div>
      </section>

      <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader title="AI coach" caption="Doubt solving + graph-based insights" />
        <div className="mt-6 rounded-[24px] bg-[var(--accent-cream)] p-4">
          <p className="text-sm font-semibold text-[var(--ink)]">Performance trend</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overview.analytics.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.25)" />
                <XAxis dataKey="label" stroke="#6b7280" tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" tickLine={false} axisLine={false} width={42} />
                <Tooltip />
                <Line type="monotone" dataKey="accuracy" stroke="#c25b2d" strokeWidth={3} dot={{ r: 4 }} name="Accuracy %" />
                <Line type="monotone" dataKey="score" stroke="#0f172a" strokeWidth={3} dot={{ r: 4 }} name="Score" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {overview.ai.prompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => void sendAi(prompt)}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink-soft)] transition hover:border-[var(--accent-rust)]"
            >
              {prompt}
            </button>
          ))}
        </div>
        <textarea
          value={aiMessage}
          onChange={(event) => setAiMessage(event.target.value)}
          className="mt-6 h-40 w-full rounded-[24px] border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 text-sm outline-none transition focus:border-[var(--accent-rust)]"
          placeholder="Ask for a 7-day revision plan, a topic strategy, or a recommendation on what to study next."
        />
        <button
          onClick={() => void sendAi(aiMessage)}
          disabled={asking}
          className="mt-4 flex items-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white"
        >
          {asking ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Bot className="h-5 w-5" />}
          Ask AI coach
        </button>
        {aiReply && (
          <div className="mt-6 rounded-[24px] border border-[var(--line)] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-cream)]">
                <Brain className="h-5 w-5 text-[var(--accent-rust)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">AI answer</p>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--ink-soft)]">{formatDateTime(aiReply.createdAt)}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{aiReply.answer}</p>
          </div>
        )}
      </section>
    </div>
  );
};

const PlansTab = ({ overview, onRefresh }: { overview: PlatformOverview; onRefresh: () => Promise<void> }) => {
  const { user } = useAuth();
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({
    type: null,
    text: '',
  });

  const activatePlan = async (plan: (typeof overview.subscriptions)[number]) => {
    if (!user || plan.active) {
      return;
    }

    setBusyPlanId(plan._id);
    try {
      setPaymentMessage({ type: null, text: '' });
      const checkout = await EduService.unlockSubscription(plan);
      const popup = window.open(
        checkout.url,
        'edumaster-stripe-subscription',
        'popup=yes,width=520,height=760',
      );

      if (!popup) {
        throw new Error('Stripe popup was blocked. Please allow popups and try again.');
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener('message', handleMessage);
          reject(new Error('Subscription confirmation timed out. If payment succeeded, refresh and try again.'));
        }, 5 * 60 * 1000);

        const closeWatcher = window.setInterval(() => {
          if (popup.closed && !settled) {
            settled = true;
            window.clearTimeout(timeoutId);
            window.clearInterval(closeWatcher);
            window.removeEventListener('message', handleMessage);
            reject(new Error('Payment window was closed before confirmation.'));
          }
        }, 500);

        const handleMessage = async (event: MessageEvent) => {
          if (event.origin !== window.location.origin) {
            return;
          }

          const data = event.data || {};
          if (
            data.type !== 'STRIPE_PAYMENT_SUCCESS'
            || data.accessType !== 'subscription'
            || data.planId !== plan._id
            || !data.sessionId
          ) {
            return;
          }

          try {
            await EduService.confirmSubscriptionPayment(data.sessionId, plan._id);
            if (!popup.closed) {
              popup.close();
            }
            if (!settled) {
              settled = true;
              window.clearTimeout(timeoutId);
              window.clearInterval(closeWatcher);
              window.removeEventListener('message', handleMessage);
              resolve();
            }
          } catch (error) {
            if (!settled) {
              settled = true;
              window.clearTimeout(timeoutId);
              window.clearInterval(closeWatcher);
              window.removeEventListener('message', handleMessage);
              reject(error instanceof Error ? error : new Error('Subscription confirmation failed.'));
            }
          }
        };

        window.addEventListener('message', handleMessage);
      });

      setPaymentMessage({ type: 'success', text: `${plan.title} is now active on your account.` });
      await onRefresh();
    } catch (error) {
      setPaymentMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Unable to activate subscription right now.',
      });
    } finally {
      setBusyPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Payments & subscriptions" caption="Stripe / Razorpay style flows + instant access" />
      <div className="grid gap-5 lg:grid-cols-2">
        {overview.subscriptions.map((plan) => (
          <div key={plan._id} className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">{plan.billingCycle}</p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--ink)]">{plan.title}</h3>
              </div>
              <div className="rounded-[24px] bg-[var(--card-dark)] px-4 py-3 text-right text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-white/50">Price</p>
                <p className="mt-1 text-xl font-semibold">{currency.format(plan.price)}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{plan.description}</p>
            <div className="mt-5 space-y-3">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-sm text-[var(--ink-soft)]">
                  <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                  {feature}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {plan.active ? (
                <span className="rounded-full bg-[var(--success-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
                  Active subscription
                </span>
              ) : (
                <button
                  onClick={() => void activatePlan(plan)}
                  disabled={busyPlanId === plan._id}
                  className="flex items-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white disabled:opacity-60"
                >
                  {busyPlanId === plan._id ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                  Activate plan
                </button>
              )}
              <p className="text-sm text-[var(--ink-soft)]">Access is activated after the subscription payment and backend confirmation flow.</p>
            </div>
            <div className="mt-6 rounded-[24px] bg-[var(--accent-cream)] p-4 text-sm text-[var(--ink-soft)]">
              Payment retries, failure handling, and activation handoff are modeled in the backend payment, webhook, and subscription flow.
            </div>
          </div>
        ))}
      </div>
      {paymentMessage.type && (
        <div className={`rounded-[24px] p-4 text-sm ${paymentMessage.type === 'success' ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-red-50 text-red-600'}`}>
          {paymentMessage.text}
        </div>
      )}
    </div>
  );
};

const AdminTab = ({ overview, onRefresh }: { overview: PlatformOverview; onRefresh: () => Promise<void> }) => {
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    category: 'SSC JE',
    exam: 'SSC JE',
    subject: '',
    instructor: '',
    officialChannelUrl: '',
    price: 0,
    validityDays: 365,
    level: 'Full Course',
  });
  const [mockTestForm, setMockTestForm] = useState({
    title: '',
    category: 'SSC JE',
    type: 'sectional',
    durationMinutes: 60,
    negativeMarking: 0.25,
    topic: '',
    questionsJson: '',
  });
  const [quizForm, setQuizForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    prompt: '',
    options: '',
    answer: '',
    explanation: '',
    topic: '',
    questionsJson: '',
  });
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const aiProviderOptions = overview.ai.generation?.providers || [
    { id: 'auto', label: 'Auto', available: true, mode: 'fallback', description: 'Pick the best provider automatically.' },
    { id: 'mock', label: 'Local Fallback', available: true, mode: 'fallback', description: 'Generate local draft content without an external API.' },
  ];
  const defaultAiProvider = overview.ai.generation?.defaultProvider || 'auto';
  const [generatingMock, setGeneratingMock] = useState(false);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [mockAiForm, setMockAiForm] = useState({
    provider: defaultAiProvider,
    subject: '',
    topic: '',
    difficulty: 'medium',
    questionCount: 20,
    durationMinutes: 60,
    instructions: '',
  });
  const [quizAiForm, setQuizAiForm] = useState({
    provider: defaultAiProvider,
    subject: '',
    topic: '',
    difficulty: 'medium',
    questionCount: 5,
    instructions: '',
  });

  const createCourse = async () => {
    setBusy(true);
    try {
      await EduService.createCourse({
        ...courseForm,
        modules: [],
        thumbnailUrl: 'https://picsum.photos/seed/new-course/900/600',
      });
      setAdminMessage('Course created through the backend API.');
      await onRefresh();
      setCourseForm({
        title: '',
        description: '',
        category: 'SSC JE',
        exam: 'SSC JE',
        subject: '',
        instructor: '',
        officialChannelUrl: '',
        price: 0,
        validityDays: 365,
        level: 'Full Course',
      });
    } finally {
      setBusy(false);
    }
  };

  const createMockTest = async () => {
    setBusy(true);
    try {
      const questions = JSON.parse(mockTestForm.questionsJson || '[]');
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Add real mock questions in JSON format before creating the test.');
      }

      const sectionMap = questions.reduce((accumulator, question) => {
        const sectionName = String(question.topic || mockTestForm.topic || 'General').trim() || 'General';
        accumulator.set(sectionName, (accumulator.get(sectionName) || 0) + 1);
        return accumulator;
      }, new Map<string, number>());

      await EduService.createMockTest({
        title: mockTestForm.title,
        description: `Admin-created ${mockTestForm.type} test for ${mockTestForm.topic || 'selected topics'}`,
        category: mockTestForm.category,
        type: mockTestForm.type,
        durationMinutes: mockTestForm.durationMinutes,
        negativeMarking: mockTestForm.negativeMarking,
        totalMarks: questions.reduce((sum, question) => sum + Number(question.marks || 1), 0),
        sectionBreakup: Array.from(sectionMap.entries()).map(([name, questionCount]) => ({ name, questions: questionCount })),
        questions,
      });
      setAdminMessage('Mock test created through the secured admin flow.');
      await onRefresh();
      setMockTestForm({
        title: '',
        category: 'SSC JE',
        type: 'sectional',
        durationMinutes: 60,
        negativeMarking: 0.25,
        topic: '',
        questionsJson: '',
      });
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Unable to create mock test.');
    } finally {
      setBusy(false);
    }
  };

  const createQuiz = async () => {
    setBusy(true);
    try {
      let questions = [];
      if (quizForm.questionsJson.trim()) {
        const parsed = JSON.parse(quizForm.questionsJson);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          throw new Error('Questions JSON must be a non-empty array.');
        }

        questions = parsed.map((question, index) => {
          const options = Array.isArray(question.options)
            ? question.options.map((item: string) => String(item || '').trim()).filter(Boolean)
            : [];

          if (!String(question.prompt || '').trim() || options.length < 2 || !String(question.answer || '').trim() || !String(question.topic || '').trim()) {
            throw new Error(`Quiz question ${index + 1} is missing prompt, options, answer, or topic.`);
          }

          return {
            id: String(question.id || `quiz_${Date.now()}_${index + 1}`),
            prompt: String(question.prompt).trim(),
            options,
            answer: String(question.answer).trim(),
            explanation: String(question.explanation || '').trim(),
            topic: String(question.topic).trim(),
          };
        });
      } else {
        const options = quizForm.options.split(',').map((item) => item.trim()).filter(Boolean);
        if (!quizForm.prompt.trim() || options.length < 2 || !quizForm.answer.trim() || !quizForm.topic.trim()) {
          throw new Error('Enter a real quiz question, at least two options, the correct answer, and a topic.');
        }

        questions = [
          {
            id: `quiz_${Date.now()}`,
            prompt: quizForm.prompt,
            options,
            answer: quizForm.answer,
            explanation: quizForm.explanation,
            topic: quizForm.topic,
          },
        ];
      }

      await EduService.createQuiz({
        date: quizForm.date,
        questions,
      });
      setAdminMessage('Daily quiz created through the secured admin flow.');
      await onRefresh();
      setQuizForm({
        date: new Date().toISOString().slice(0, 10),
        prompt: '',
        options: '',
        answer: '',
        explanation: '',
        topic: '',
        questionsJson: '',
      });
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Unable to create daily quiz.');
    } finally {
      setBusy(false);
    }
  };

  const generateMockTestDraft = async () => {
    setGeneratingMock(true);
    setAdminMessage(null);
    try {
      const generated = await EduService.generateAssessmentDraft({
        provider: mockAiForm.provider,
        contentType: 'mock-test',
        exam: mockTestForm.category,
        subject: mockAiForm.subject,
        topic: mockAiForm.topic || mockTestForm.topic,
        title: mockTestForm.title,
        type: mockTestForm.type,
        difficulty: mockAiForm.difficulty,
        questionCount: mockAiForm.questionCount,
        durationMinutes: mockAiForm.durationMinutes,
        negativeMarking: mockTestForm.negativeMarking,
        instructions: mockAiForm.instructions,
      });

      if (!generated.mockTest) {
        throw new Error('Mock test draft was not returned by the AI generator.');
      }

      setMockTestForm((current) => ({
        ...current,
        title: generated.mockTest?.title || current.title,
        category: generated.mockTest?.category || current.category,
        type: generated.mockTest?.type || current.type,
        durationMinutes: generated.mockTest?.durationMinutes || current.durationMinutes,
        negativeMarking: generated.mockTest?.negativeMarking ?? current.negativeMarking,
        topic: generated.mockTest?.sectionBreakup?.[0]?.name || mockAiForm.topic || current.topic,
        questionsJson: JSON.stringify(generated.mockTest.questions, null, 2),
      }));
      setAdminMessage(`${generated.message} The mock test draft is loaded below for review.`);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Unable to generate mock test draft.');
    } finally {
      setGeneratingMock(false);
    }
  };

  const generateDailyQuizDraft = async () => {
    setGeneratingQuiz(true);
    setAdminMessage(null);
    try {
      const generated = await EduService.generateAssessmentDraft({
        provider: quizAiForm.provider,
        contentType: 'daily-quiz',
        exam: mockTestForm.category,
        subject: quizAiForm.subject,
        topic: quizAiForm.topic || quizForm.topic,
        difficulty: quizAiForm.difficulty,
        questionCount: quizAiForm.questionCount,
        quizDate: quizForm.date,
        instructions: quizAiForm.instructions,
      });

      if (!generated.dailyQuiz) {
        throw new Error('Daily quiz draft was not returned by the AI generator.');
      }

      const firstQuestion = generated.dailyQuiz.questions[0];
      setQuizForm((current) => ({
        ...current,
        date: generated.dailyQuiz?.date || current.date,
        prompt: firstQuestion?.prompt || '',
        options: firstQuestion?.options?.join(', ') || '',
        answer: firstQuestion?.answer || '',
        explanation: firstQuestion?.explanation || '',
        topic: firstQuestion?.topic || quizAiForm.topic || current.topic,
        questionsJson: JSON.stringify(generated.dailyQuiz.questions, null, 2),
      }));
      setAdminMessage(`${generated.message} The daily quiz draft is loaded below for review.`);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : 'Unable to generate daily quiz draft.');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Admin command center" caption="Users, courses, test series, analytics" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard title="Active users" value={`${overview.adminOverview?.activeUsers || 0}`} hint="Current seed + registered users" icon={UserCircle2} />
        <MetricCard title="Active sessions" value={`${overview.adminOverview?.activeSessions || 0}`} hint="Single active session enforcement" icon={ShieldCheck} />
        <MetricCard title="Revenue" value={currency.format(overview.adminOverview?.revenue || 0)} hint="Paid webhook totals" icon={Wallet} />
        <MetricCard title="Participation" value={`${overview.adminOverview?.testParticipation || 0}`} hint="Quiz plus mock submissions" icon={ClipboardCheck} />
        <MetricCard title="Capacity target" value={overview.adminOverview?.concurrentCapacityTarget || '10K'} hint="Designed for 10K-100K users" icon={ShieldCheck} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
          <SectionHeader title="Operations" caption="Real admin workflows only" />
          <div className="mt-6 space-y-4">
            <div className="rounded-[24px] bg-[var(--accent-cream)] p-4 text-sm text-[var(--ink-soft)]">
              This panel now works with actual platform data only. Create courses, subjects, topics, videos, live classes, tests, and quizzes through the secured backend flows below. AI generation creates reviewable drafts first, then you publish them through the same admin APIs.
            </div>
            <div className="rounded-[24px] border border-[var(--line)] bg-white p-4">
              <p className="text-sm font-semibold text-[var(--ink)]">AI provider status</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {aiProviderOptions.map((provider) => (
                  <span
                    key={provider.id}
                    className={cn(
                      'rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em]',
                      provider.available
                        ? provider.mode === 'fallback'
                          ? 'bg-[var(--accent-cream)] text-[var(--accent-rust)]'
                          : 'bg-[var(--success-soft)] text-[var(--success)]'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {provider.label} • {provider.available ? provider.mode : 'off'}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm text-[var(--ink-soft)]">
                For low-cost production use, set `GEMINI_API_KEY`. For any other model vendor, configure `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL`.
              </p>
            </div>
            {adminMessage && <div className="rounded-[24px] bg-[var(--success-soft)] p-4 text-sm text-[var(--success)]">{adminMessage}</div>}
          </div>
        </section>

        <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
          <SectionHeader title="Create course" caption="Backend course management" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={courseForm.title} onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))} placeholder="Course title" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={courseForm.subject} onChange={(event) => setCourseForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Subject" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={courseForm.instructor} onChange={(event) => setCourseForm((current) => ({ ...current, instructor: event.target.value }))} placeholder="Instructor" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={courseForm.officialChannelUrl} onChange={(event) => setCourseForm((current) => ({ ...current, officialChannelUrl: event.target.value }))} placeholder="Official channel URL" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input type="number" value={courseForm.price} onChange={(event) => setCourseForm((current) => ({ ...current, price: Number(event.target.value) }))} placeholder="Price" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={courseForm.category} onChange={(event) => setCourseForm((current) => ({ ...current, category: event.target.value }))} placeholder="Category" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={courseForm.level} onChange={(event) => setCourseForm((current) => ({ ...current, level: event.target.value }))} placeholder="Level" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <textarea value={courseForm.description} onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))} placeholder="Course description" className="md:col-span-2 h-32 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <div className="md:col-span-2">
              <button onClick={() => void createCourse()} disabled={busy} className="rounded-2xl bg-[var(--ink)] px-5 py-4 font-semibold text-white">
                Create course
              </button>
            </div>
          </div>
        </section>
      </div>

      <AdminCourseManager courses={overview.courses || []} onCoursesChanged={onRefresh} />
      <AdminLiveClassManager courses={overview.courses || []} onChanged={onRefresh} />
      <AdminVideoUpload courses={overview.courses || []} onVideoUploaded={onRefresh} />
      <AdminModuleManager courses={overview.courses || []} onModulesChanged={onRefresh} />

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
          <SectionHeader title="Create mock test" caption="Sectional, topic-wise, or full-length" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <select
              value={mockAiForm.provider}
              onChange={(event) => setMockAiForm((current) => ({ ...current, provider: event.target.value }))}
              className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none"
            >
              {aiProviderOptions.map((provider) => (
                <option key={provider.id} value={provider.id} disabled={!provider.available && provider.id !== 'auto'}>
                  {provider.label} {provider.available ? '' : '(Not configured)'}
                </option>
              ))}
            </select>
            <input value={mockAiForm.subject} onChange={(event) => setMockAiForm((current) => ({ ...current, subject: event.target.value }))} placeholder="AI subject" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={mockAiForm.topic} onChange={(event) => setMockAiForm((current) => ({ ...current, topic: event.target.value }))} placeholder="AI topic focus" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <select value={mockAiForm.difficulty} onChange={(event) => setMockAiForm((current) => ({ ...current, difficulty: event.target.value }))} className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none">
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <input type="number" value={mockAiForm.questionCount} onChange={(event) => setMockAiForm((current) => ({ ...current, questionCount: Number(event.target.value) }))} placeholder="AI question count" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input type="number" value={mockAiForm.durationMinutes} onChange={(event) => setMockAiForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} placeholder="AI duration" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <textarea
              value={mockAiForm.instructions}
              onChange={(event) => setMockAiForm((current) => ({ ...current, instructions: event.target.value }))}
              placeholder="Optional AI instructions: chapter mix, exam style, calculation-heavy, etc."
              className="md:col-span-2 h-24 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none"
            />
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <button onClick={() => void generateMockTestDraft()} disabled={generatingMock} className="rounded-2xl bg-[var(--accent-rust)] px-5 py-4 font-semibold text-white disabled:opacity-60">
                {generatingMock ? 'Generating mock draft...' : 'Generate with AI'}
              </button>
              <span className="self-center text-sm text-[var(--ink-soft)]">AI fills the JSON draft below. You can edit it before saving.</span>
            </div>
            <input value={mockTestForm.title} onChange={(event) => setMockTestForm((current) => ({ ...current, title: event.target.value }))} placeholder="Mock test title" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={mockTestForm.topic} onChange={(event) => setMockTestForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Topic / section" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={mockTestForm.category} onChange={(event) => setMockTestForm((current) => ({ ...current, category: event.target.value }))} placeholder="Category" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={mockTestForm.type} onChange={(event) => setMockTestForm((current) => ({ ...current, type: event.target.value }))} placeholder="Type" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input type="number" value={mockTestForm.durationMinutes} onChange={(event) => setMockTestForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} placeholder="Duration" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input type="number" step="0.01" value={mockTestForm.negativeMarking} onChange={(event) => setMockTestForm((current) => ({ ...current, negativeMarking: Number(event.target.value) }))} placeholder="Negative marking" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <textarea
              value={mockTestForm.questionsJson}
              onChange={(event) => setMockTestForm((current) => ({ ...current, questionsJson: event.target.value }))}
              placeholder='Questions JSON: [{"id":"q1","questionText":"...","options":["A","B","C","D"],"correctOption":1,"explanation":"...","marks":1,"topic":"Network Theory"}]'
              className="md:col-span-2 h-36 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none"
            />
            <div className="md:col-span-2">
              <button onClick={() => void createMockTest()} disabled={busy} className="rounded-2xl bg-[var(--ink)] px-5 py-4 font-semibold text-white">
                Create mock test
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
          <SectionHeader title="Create daily quiz" caption="Engagement + streak engine" />
          <div className="mt-6 grid gap-4">
            <input value={quizForm.date} onChange={(event) => setQuizForm((current) => ({ ...current, date: event.target.value }))} type="date" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <select
              value={quizAiForm.provider}
              onChange={(event) => setQuizAiForm((current) => ({ ...current, provider: event.target.value }))}
              className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none"
            >
              {aiProviderOptions.map((provider) => (
                <option key={provider.id} value={provider.id} disabled={!provider.available && provider.id !== 'auto'}>
                  {provider.label} {provider.available ? '' : '(Not configured)'}
                </option>
              ))}
            </select>
            <input value={quizAiForm.subject} onChange={(event) => setQuizAiForm((current) => ({ ...current, subject: event.target.value }))} placeholder="AI subject" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={quizAiForm.topic} onChange={(event) => setQuizAiForm((current) => ({ ...current, topic: event.target.value }))} placeholder="AI topic focus" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <div className="grid gap-4 md:grid-cols-2">
              <select value={quizAiForm.difficulty} onChange={(event) => setQuizAiForm((current) => ({ ...current, difficulty: event.target.value }))} className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none">
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <input type="number" value={quizAiForm.questionCount} onChange={(event) => setQuizAiForm((current) => ({ ...current, questionCount: Number(event.target.value) }))} placeholder="AI question count" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            </div>
            <textarea value={quizAiForm.instructions} onChange={(event) => setQuizAiForm((current) => ({ ...current, instructions: event.target.value }))} placeholder="Optional AI instructions: quick recall, mixed topics, one-liners, etc." className="h-24 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <div className="flex flex-wrap gap-3">
              <button onClick={() => void generateDailyQuizDraft()} disabled={generatingQuiz} className="rounded-2xl bg-[var(--accent-rust)] px-5 py-4 font-semibold text-white disabled:opacity-60">
                {generatingQuiz ? 'Generating quiz draft...' : 'Generate with AI'}
              </button>
              <span className="self-center text-sm text-[var(--ink-soft)]">AI can prepare a multi-question quiz. Review the JSON before saving.</span>
            </div>
            <input value={quizForm.prompt} onChange={(event) => setQuizForm((current) => ({ ...current, prompt: event.target.value }))} placeholder="Quiz question" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={quizForm.options} onChange={(event) => setQuizForm((current) => ({ ...current, options: event.target.value }))} placeholder="Comma-separated options" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <div className="grid gap-4 md:grid-cols-2">
              <input value={quizForm.answer} onChange={(event) => setQuizForm((current) => ({ ...current, answer: event.target.value }))} placeholder="Correct answer" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
              <input value={quizForm.topic} onChange={(event) => setQuizForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Topic" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            </div>
            <textarea value={quizForm.explanation} onChange={(event) => setQuizForm((current) => ({ ...current, explanation: event.target.value }))} placeholder="Explanation" className="h-28 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <textarea value={quizForm.questionsJson} onChange={(event) => setQuizForm((current) => ({ ...current, questionsJson: event.target.value }))} placeholder='Questions JSON (optional for multi-question quiz): [{"prompt":"...","options":["A","B","C","D"],"answer":"A","explanation":"...","topic":"..."}]' className="h-36 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <div>
              <button onClick={() => void createQuiz()} disabled={busy} className="rounded-2xl bg-[var(--accent-rust)] px-5 py-4 font-semibold text-white">
                Create daily quiz
              </button>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Recent device activity" caption="Login sessions and device events" />
        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {(overview.adminOverview?.recentDeviceActivity || []).map((activity) => (
            <div key={activity._id} className="rounded-[22px] bg-[var(--accent-cream)] p-4">
              <p className="text-sm font-semibold text-[var(--ink)]">{formatEventLabel(activity.eventType)}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--ink-soft)]">{activity.device || 'unknown device'}</p>
              <p className="mt-3 text-sm text-[var(--ink-soft)]">User: {activity.userId}</p>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">{formatDateTime(activity.createdAt)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const AppContent = () => {
  const { user, loading, logout } = useAuth();
  const [publicOverview, setPublicOverview] = useState<PlatformOverview | null>(null);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [resumeTarget, setResumeTarget] = useState<{ courseId: string; lessonId?: string | null } | null>(null);
  const [liveNavigationTarget, setLiveNavigationTarget] = useState<string | null>(null);
  const [savedTopicIds, setSavedTopicIds] = useState<string[]>([]);

  const refreshOverview = async (background = true) => {
    if (!background) {
      setLoadingOverview(true);
    }
    try {
      const nextPublicOverview = await EduService.getPlatformOverview();
      setPublicOverview(nextPublicOverview);

      if (user) {
        const nextOverview = await EduService.getPlatformOverview();
        setOverview(nextOverview);
      } else {
        setOverview(null);
      }
    } finally {
      if (!background) {
        setLoadingOverview(false);
      }
    }
  };

  useEffect(() => {
    void refreshOverview(false);
  }, [user]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const liveClassId = params.get('liveClassId');

    if (tab === 'live') {
      setActiveTab('live');
    }

    if (liveClassId) {
      setLiveNavigationTarget(liveClassId);
    }
  }, []);

  useEffect(() => {
    if (!user || typeof window === 'undefined') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void refreshOverview(true);
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    if (!user?._id || typeof window === 'undefined') {
      setSavedTopicIds([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(buildSavedTopicsKey(user._id));
      const parsed = raw ? JSON.parse(raw) as string[] : [];
      setSavedTopicIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSavedTopicIds([]);
    }
  }, [user?._id]);

  const savedTopics = useMemo(() => {
    if (!overview || !savedTopicIds.length) {
      return [];
    }

    const savedTopicSet = new Set(savedTopicIds);
    return overview.courses.flatMap((course) =>
      flattenCourseLessons(course)
        .filter((entry) => savedTopicSet.has(`${course._id}:${entry.lesson.id}`))
        .map((entry) => {
          const progress = (course.lessonProgress || []).find((item) => item.lessonId === entry.lesson.id);
          return {
            courseId: course._id,
            lessonId: entry.lesson.id,
            savedAt: '',
            courseTitle: course.title,
            lessonTitle: entry.lesson.title,
            exam: course.exam,
            thumbnailUrl: course.thumbnailUrl,
            moduleTitle: entry.moduleTitle,
            chapterTitle: entry.chapterTitle,
            progressSeconds: progress?.progressSeconds || 0,
            completed: progress?.completed || false,
          } as SavedTopic;
        }))
      .sort((left, right) => savedTopicIds.indexOf(`${left.courseId}:${left.lessonId}`) - savedTopicIds.indexOf(`${right.courseId}:${right.lessonId}`));
  }, [overview, savedTopicIds]);

  const toggleSavedTopic = (courseId: string, lessonId: string) => {
    if (!user?._id || typeof window === 'undefined') {
      return;
    }

    setSavedTopicIds((current) => {
      const topicKey = `${courseId}:${lessonId}`;
      const next = current.includes(topicKey)
        ? current.filter((item) => item !== topicKey)
        : [topicKey, ...current];
      window.localStorage.setItem(buildSavedTopicsKey(user._id), JSON.stringify(next));
      return next;
    });
  };

  const openNotification = (notification: NotificationItem) => {
    const target = getNotificationNavigationTarget(notification);

    if (target?.tab === 'live' && target.liveClassId) {
      setActiveTab('live');
      setLiveNavigationTarget(target.liveClassId);

      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', 'live');
        url.searchParams.set('liveClassId', target.liveClassId);
        window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`);
      }
      return;
    }

    if (notification.actionUrl && typeof window !== 'undefined') {
      window.location.href = notification.actionUrl;
    }
  };

  if (loading || loadingOverview) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--page-bg)]">
        <div className="flex flex-col items-center gap-4 text-[var(--ink-soft)]">
          <LoaderCircle className="h-12 w-12 animate-spin text-[var(--accent-rust)]" />
          <p className="text-sm font-medium">Loading unified prep platform…</p>
        </div>
      </div>
    );
  }

  if (!user || !overview) {
    return <AuthScreen publicOverview={publicOverview} />;
  }

  return (
    <Shell
      overview={overview}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={logout}
      onRefresh={() => refreshOverview(true)}
      resumeTarget={resumeTarget}
      liveNavigationTarget={liveNavigationTarget}
      onContinueLearningNavigate={(courseId, lessonId) => setResumeTarget({ courseId, lessonId })}
      onOpenNotification={openNotification}
      onResumeNavigationHandled={() => setResumeTarget(null)}
      savedTopicIds={savedTopicIds}
      savedTopics={savedTopics}
      onToggleSavedTopic={toggleSavedTopic}
    />
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
