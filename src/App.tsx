import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Bot,
  Brain,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Flame,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  LoaderCircle,
  Lock,
  LogOut,
  MessageSquare,
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
import { EduService } from './EduService';
import {
  AiResponse,
  CourseCard,
  CourseLesson,
  DailyQuizResult,
  LiveChatMessage,
  MockTest,
  PlatformOverview,
  RegisterPayload,
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

const getYouTubeEmbedUrl = (value?: string) => {
  if (!value) {
    return null;
  }

  if (value.includes('/embed/')) {
    return value;
  }

  try {
    const url = new URL(value);
    const videoId = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop();
    return videoId ? `https://www.youtube.com/embed/${videoId}` : value;
  } catch {
    return value;
  }
};

const formatEventLabel = (eventType: string) =>
  eventType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

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

  const demoCreds = publicOverview?.sampleCredentials;

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

            {demoCreds && (
              <div className="mt-10 rounded-[28px] border border-white/15 bg-black/18 p-5 backdrop-blur">
                <p className="text-sm font-semibold text-white">Demo access</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => submitLogin(demoCreds.studentEmail, demoCreds.studentPassword)}
                    disabled={submitting}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-left text-sm text-white/84 transition hover:bg-white/14"
                  >
                    <p className="font-semibold text-white">Student demo</p>
                    <p className="mt-1 text-white/66">{demoCreds.studentEmail}</p>
                  </button>
                  <button
                    onClick={() => submitLogin(demoCreds.adminEmail, demoCreds.adminPassword)}
                    disabled={submitting}
                    className="rounded-2xl border border-white/15 bg-white/10 px-4 py-4 text-left text-sm text-white/84 transition hover:bg-white/14"
                  >
                    <p className="font-semibold text-white">Admin demo</p>
                    <p className="mt-1 text-white/66">{demoCreds.adminEmail}</p>
                  </button>
                </div>
              </div>
            )}
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
}: {
  overview: PlatformOverview;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  onLogout: () => Promise<void>;
  onRefresh: () => Promise<void>;
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
          {activeTab === 'overview' && <OverviewTab overview={overview} />}
          {activeTab === 'courses' && <CoursesTab overview={overview} onRefresh={onRefresh} />}
          {activeTab === 'tests' && <TestsTab overview={overview} onRefresh={onRefresh} />}
          {activeTab === 'quiz' && <QuizTab overview={overview} onRefresh={onRefresh} />}
          {activeTab === 'live' && <LiveTab overview={overview} />}
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

const OverviewTab = ({ overview }: { overview: PlatformOverview }) => (
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
            <div key={item._id} className="rounded-[24px] border border-[var(--line)] bg-[var(--accent-cream)] p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-white">
                  <BellRing className="h-4 w-4 text-[var(--accent-rust)]" />
                </div>
                <div>
                  <p className="font-medium text-[var(--ink)]">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--ink-soft)]">{item.message}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--ink-soft)]">{formatDateTime(item.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Continue learning" caption="Resume playback" />
        <div className="mt-6 space-y-4">
          {overview.dashboard.continueLearning.length > 0 ? overview.dashboard.continueLearning.map((course) => (
            <div key={course._id} className="rounded-[26px] border border-[var(--line)] p-4">
              <div className="flex items-start gap-4">
                <img src={course.thumbnailUrl} alt={course.title} className="h-24 w-24 rounded-[20px] object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-soft)]">{course.exam}</p>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--ink)]">{course.title}</h3>
                  <p className="mt-1 text-sm text-[var(--ink-soft)]">
                    Resume: {course.continueLesson?.title || 'Start your next lesson'}
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
            </div>
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
  </div>
);

const CoursesTab = ({ overview, onRefresh }: { overview: PlatformOverview; onRefresh: () => Promise<void> }) => {
  const { user } = useAuth();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(overview.courses[0]?._id || null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const selectedCourse = useMemo(
    () => overview.courses.find((course) => course._id === selectedCourseId) || overview.courses[0] || null,
    [overview.courses, selectedCourseId],
  );
  const selectedLessonMeta = useMemo(() => {
    if (!selectedCourse) {
      return null;
    }

    const lessons = selectedCourse.modules.flatMap((module) =>
      module.lessons.map((lesson) => ({
        lesson,
        moduleTitle: module.title,
      })),
    );

    return lessons.find((entry) => entry.lesson.id === selectedLessonId)
      || lessons.find((entry) => entry.lesson.id === selectedCourse.continueLesson?.id)
      || lessons[0]
      || null;
  }, [selectedCourse, selectedLessonId]);

  useEffect(() => {
    if (!selectedCourseId && overview.courses[0]) {
      setSelectedCourseId(overview.courses[0]._id);
    }
  }, [overview.courses, selectedCourseId]);

  useEffect(() => {
    if (!selectedCourse) {
      return;
    }

    const lessonIds = selectedCourse.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id));
    if (selectedLessonId && lessonIds.includes(selectedLessonId)) {
      return;
    }

    setSelectedLessonId(selectedCourse.continueLesson?.id || lessonIds[0] || null);
  }, [selectedCourse, selectedLessonId]);

  const handleUnlock = async (course: CourseCard) => {
    if (!user) {
      return;
    }

    setBusyCourseId(course._id);
    try {
      await EduService.unlockCourse(course);
      await onRefresh();
    } finally {
      setBusyCourseId(null);
    }
  };

  const markLessonComplete = async (courseId: string, lesson: CourseLesson) => {
    if (!user) {
      return;
    }

    setBusyCourseId(courseId);
    try {
      await EduService.updateWatchProgress(
        courseId,
        lesson.id,
        100,
        lesson.durationMinutes * 60,
        true,
      );
      await onRefresh();
    } finally {
      setBusyCourseId(null);
    }
  };

  const selectedLesson = selectedLessonMeta?.lesson || null;
  const canAccessLesson = Boolean(selectedCourse?.enrolled || (!selectedLesson?.premium && !selectedLesson?.locked));
  const embedUrl = selectedLesson?.type === 'youtube' ? getYouTubeEmbedUrl(selectedLesson.videoUrl) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Course catalog" caption="Category → Course → Subject → Lessons" />
        <div className="mt-6 space-y-4">
          {overview.courses.map((course) => (
            <button
              key={course._id}
              onClick={() => setSelectedCourseId(course._id)}
              className={cn(
                'w-full rounded-[26px] border p-4 text-left transition',
                selectedCourse?._id === course._id
                  ? 'border-[var(--accent-rust)] bg-[var(--accent-cream)]'
                  : 'border-[var(--line)] bg-white hover:border-[var(--accent-rust)]/35',
              )}
            >
              <div className="flex gap-4">
                <img src={course.thumbnailUrl} alt={course.title} className="h-24 w-24 rounded-[18px] object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-soft)]">{course.category}</p>
                    <span className={cn(
                      'rounded-full px-3 py-1 text-xs font-semibold',
                      course.enrolled ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--accent-cream)] text-[var(--accent-rust)]',
                    )}>
                      {course.enrolled ? 'Unlocked' : 'Premium'}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--ink)]">{course.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{course.description}</p>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-[var(--ink-soft)]">{course.lessonCount} lessons • {course.progressPercent || 0}% done</span>
                    <span className="font-semibold text-[var(--ink)]">{currency.format(course.price)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        {selectedCourse ? (
          <>
            <div className="flex flex-col gap-6 lg:flex-row">
              <img src={selectedCourse.thumbnailUrl} alt={selectedCourse.title} className="h-52 w-full rounded-[28px] object-cover lg:w-72" />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">{selectedCourse.exam}</p>
                <h2 className="mt-3 text-3xl font-semibold text-[var(--ink)]">{selectedCourse.title}</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">{selectedCourse.description}</p>
                <div className="mt-5 flex flex-wrap gap-3 text-sm">
                  <span className="rounded-full bg-[var(--accent-cream)] px-4 py-2 text-[var(--ink)]">{selectedCourse.subject}</span>
                  <span className="rounded-full bg-[var(--accent-cream)] px-4 py-2 text-[var(--ink)]">{selectedCourse.level}</span>
                  <span className="rounded-full bg-[var(--accent-cream)] px-4 py-2 text-[var(--ink)]">{selectedCourse.validityDays} day access</span>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {selectedCourse.enrolled ? (
                    <span className="rounded-full bg-[var(--success-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
                      Access active
                    </span>
                  ) : (
                    <button
                      onClick={() => handleUnlock(selectedCourse)}
                      disabled={busyCourseId === selectedCourse._id}
                      className="flex items-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--accent-rust-strong)] disabled:opacity-60"
                    >
                      {busyCourseId === selectedCourse._id ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                      Simulate payment + unlock
                    </button>
                  )}
                  {selectedCourse.officialChannelUrl && (
                    <a
                      href={selectedCourse.officialChannelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent-rust)]"
                    >
                      Official channel
                    </a>
                  )}
                  <p className="text-sm text-[var(--ink-soft)]">Includes YouTube lessons, premium videos, PDF notes, resume playback, and locked access until purchase.</p>
                </div>
              </div>
            </div>

            {selectedLesson && (
              <div className="mt-8 rounded-[28px] bg-[var(--card-dark)] p-5 text-white sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">{selectedLessonMeta?.moduleTitle}</p>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedLesson.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/70">
                      {selectedLesson.durationMinutes} min • {selectedLesson.type} • {canAccessLesson ? 'Resume-ready playback' : 'Purchase required to unlock this premium lesson'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/80">
                      <span className="mr-2">Speed</span>
                      <select
                        value={playbackSpeed}
                        onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                        className="bg-transparent outline-none"
                      >
                        {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                          <option key={speed} value={speed} className="text-[var(--ink)]">
                            {speed}x
                          </option>
                        ))}
                      </select>
                    </label>
                    {selectedLesson.notesUrl && canAccessLesson && (
                      <a
                        href={selectedLesson.notesUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/80"
                      >
                        Open notes PDF
                      </a>
                    )}
                    <button
                      onClick={() => void markLessonComplete(selectedCourse._id, selectedLesson)}
                      disabled={!canAccessLesson || busyCourseId === selectedCourse._id}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] disabled:opacity-55"
                    >
                      Mark complete
                    </button>
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-black/25">
                  {canAccessLesson && embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title={selectedLesson.title}
                      className="aspect-video w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : canAccessLesson ? (
                    <div className="flex aspect-video flex-col justify-between p-6">
                      <div>
                        <p className="text-sm font-semibold text-white">Platform-hosted playback</p>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68">
                          Premium streams are wired for resume playback and speed control. This demo uses protected placeholder media URLs, so the card stands in for the secured player state.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-white/72">
                        <span className="rounded-full border border-white/12 px-3 py-2">Resume supported</span>
                        <span className="rounded-full border border-white/12 px-3 py-2">Playback speed: {playbackSpeed}x</span>
                        <span className="rounded-full border border-white/12 px-3 py-2">{selectedCourse.progressPercent || 0}% course progress</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-video flex-col items-center justify-center gap-4 px-6 text-center">
                      <Lock className="h-10 w-10 text-[var(--accent-rust)]" />
                      <div>
                        <p className="text-lg font-semibold">Premium lesson locked</p>
                        <p className="mt-2 text-sm leading-7 text-white/68">
                          Enroll in this course to unlock protected video playback, notes, and tracked progress for this lesson.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedCourse.continueLesson && (
                  <div className="mt-5 rounded-[22px] bg-white/8 p-4 text-sm text-white/80">
                    Continue watching is available on <span className="font-semibold text-white">{selectedCourse.continueLesson.title}</span> with backend-synced history and progress percentage.
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 space-y-5">
              {selectedCourse.modules.map((module) => (
                <div key={module.id} className="rounded-[26px] border border-[var(--line)] p-5">
                  <p className="text-sm font-semibold text-[var(--ink)]">{module.title}</p>
                  <div className="mt-4 space-y-3">
                    {module.lessons.map((lesson) => (
                      <div key={lesson.id} className="flex flex-col gap-3 rounded-[22px] bg-[var(--accent-cream)] p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {lesson.type === 'youtube' ? (
                              <PlayCircle className="h-4 w-4 text-[var(--accent-rust)]" />
                            ) : lesson.premium ? (
                              <Lock className="h-4 w-4 text-[var(--accent-rust)]" />
                            ) : (
                              <BookOpen className="h-4 w-4 text-[var(--accent-rust)]" />
                            )}
                            <p className="font-medium text-[var(--ink)]">{lesson.title}</p>
                            {lesson.locked && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--accent-rust)]">Locked</span>}
                          </div>
                          <p className="mt-1 text-sm text-[var(--ink-soft)]">
                            {lesson.durationMinutes} min • {lesson.type} • {lesson.notesUrl ? 'PDF notes attached' : 'Video only'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setSelectedLessonId(lesson.id)}
                            className={cn(
                              'rounded-full border px-4 py-2 text-sm font-medium transition',
                              selectedLesson?.id === lesson.id
                                ? 'border-[var(--accent-rust)] bg-white text-[var(--accent-rust)]'
                                : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent-rust)]',
                            )}
                          >
                            {lesson.locked ? 'Preview' : 'Watch'}
                          </button>
                          <button
                            onClick={() => void markLessonComplete(selectedCourse._id, lesson)}
                            disabled={Boolean(lesson.locked) || busyCourseId === selectedCourse._id}
                            className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent-rust)] disabled:opacity-60"
                          >
                            {selectedCourse.enrolled ? 'Track progress' : 'Unlock to track'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-[24px] border border-dashed border-[var(--line)] p-8 text-[var(--ink-soft)]">
            Select a course to view modules, lessons, and access rules.
          </div>
        )}
      </section>
    </div>
  );
};

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
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(test.durationMinutes * 60);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useMemo(() => new Date().toISOString(), [test._id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft((current) => current - 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && !submitting) {
      void submit();
    }
  }, [timeLeft, submitting]);

  const submit = async () => {
    if (!user || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await EduService.submitMockTest(test._id, answers, startedAt);
      onSubmitted(result);
    } finally {
      setSubmitting(false);
    }
  };

  const currentQuestion = test.questions[currentIndex];

  return (
    <div className="fixed inset-0 z-40 bg-[var(--card-dark)]/82 px-3 py-3 backdrop-blur sm:px-6 sm:py-6">
      <div className="mx-auto flex h-full max-w-7xl flex-col rounded-[30px] border border-white/12 bg-white">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--ink-soft)]">{test.type}</p>
            <h3 className="mt-1 text-xl font-semibold text-[var(--ink)]">{test.title}</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-[var(--accent-cream)] px-4 py-2 text-sm font-semibold text-[var(--accent-rust)]">
              {formatTimeLeft(timeLeft)}
            </div>
            <button onClick={onClose} className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink-soft)]">
              Exit
            </button>
          </div>
        </div>

        <div className="grid flex-1 gap-6 overflow-hidden px-5 py-5 xl:grid-cols-[1.1fr_0.45fr]">
          <div className="overflow-y-auto rounded-[28px] bg-[var(--accent-cream)] p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[var(--ink-soft)]">
                Question {currentIndex + 1} / {test.questions.length}
              </p>
              <p className="text-sm text-[var(--ink-soft)]">
                +{currentQuestion.marks} / -{test.negativeMarking}
              </p>
            </div>
            <h4 className="mt-5 text-2xl font-semibold leading-9 text-[var(--ink)]">{currentQuestion.questionText}</h4>
            <div className="mt-6 space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={`${currentQuestion.id}-${option}`}
                  onClick={() => setAnswers((current) => ({ ...current, [currentQuestion.id]: index }))}
                  className={cn(
                    'w-full rounded-[22px] border px-4 py-4 text-left transition',
                    answers[currentQuestion.id] === index
                      ? 'border-[var(--accent-rust)] bg-white shadow-sm'
                      : 'border-transparent bg-white/70 hover:border-[var(--accent-rust)]/40',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold',
                      answers[currentQuestion.id] === index ? 'bg-[var(--accent-rust)] text-white' : 'bg-[var(--accent-cream)] text-[var(--ink-soft)]',
                    )}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-sm font-medium text-[var(--ink)]">{option}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={() => setCurrentIndex((current) => Math.max(current - 1, 0))}
                disabled={currentIndex === 0}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink-soft)] disabled:opacity-45"
              >
                Previous
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setAnswers((current) => {
                    const nextAnswers = { ...current };
                    delete nextAnswers[currentQuestion.id];
                    return nextAnswers;
                  })}
                  className="rounded-full border border-[var(--line)] px-4 py-2 text-sm text-[var(--ink-soft)]"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    if (currentIndex === test.questions.length - 1) {
                      void submit();
                    } else {
                      setCurrentIndex((current) => current + 1);
                    }
                  }}
                  className="rounded-full bg-[var(--accent-rust)] px-5 py-2 text-sm font-semibold text-white"
                >
                  {currentIndex === test.questions.length - 1 ? 'Submit' : 'Save & next'}
                </button>
              </div>
            </div>
          </div>

          <aside className="overflow-y-auto rounded-[28px] border border-[var(--line)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">Question palette</p>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {test.questions.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold',
                    currentIndex === index ? 'bg-[var(--accent-rust)] text-white' : answers[question.id] !== undefined ? 'bg-[var(--success-soft)] text-[var(--success)]' : 'bg-[var(--accent-cream)] text-[var(--ink-soft)]',
                  )}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => void submit()}
              disabled={submitting}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--ink)] px-5 py-3 font-semibold text-white"
            >
              {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <ClipboardCheck className="h-5 w-5" />}
              Auto-submit enabled
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};

const TestsTab = ({ overview, onRefresh }: { overview: PlatformOverview; onRefresh: () => Promise<void> }) => {
  const [activeTest, setActiveTest] = useState<MockTest | null>(null);
  const [lastResult, setLastResult] = useState<TestAttemptResult | null>(null);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Mock test engine"
        caption="Timer, negative marking, auto-submit, scorecard"
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
              Start exam simulation
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
              <p className="text-lg font-semibold text-[var(--ink)]">Solutions with explanations</p>
              <div className="mt-4 space-y-3">
                {lastResult.solutions.map((solution, index) => (
                  <div key={solution.questionId} className="rounded-[20px] bg-[var(--accent-cream)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Question {index + 1} • {solution.topic}</p>
                    <p className="mt-2 font-semibold text-[var(--ink)]">{solution.questionText}</p>
                    <p className="mt-3 text-sm text-[var(--ink-soft)]">
                      Your answer: <span className="font-semibold text-[var(--ink)]">{solution.selectedOption === null ? 'Skipped' : String.fromCharCode(65 + solution.selectedOption)}</span>
                      {' '}• Correct: <span className="font-semibold text-[var(--success)]">{String.fromCharCode(65 + solution.correctOption)}</span>
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--ink-soft)]">{solution.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {activeTest && (
          <TestPlayer
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

  const quiz = overview.dailyQuiz?.quiz;

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
                  <div className="mt-4 rounded-[18px] bg-[var(--accent-cream)] p-4 text-sm text-[var(--ink-soft)]">
                    <p>
                      Your answer:{' '}
                      <span className="font-semibold text-[var(--ink)]">
                        {result.review.find((entry) => entry.questionId === question.id)?.selectedAnswer || 'Skipped'}
                      </span>
                    </p>
                    <p className="mt-1">
                      Correct answer:{' '}
                      <span className="font-semibold text-[var(--success)]">
                        {result.review.find((entry) => entry.questionId === question.id)?.correctAnswer}
                      </span>
                    </p>
                    <p className="mt-2 leading-6">
                      {result.review.find((entry) => entry.questionId === question.id)?.explanation}
                    </p>
                  </div>
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
            <MetricCard title="Current streak" value={`${overview.dailyQuiz?.streak || 0} days`} hint="Attempt before midnight to extend it" icon={Flame} />
            <MetricCard title="Leaderboard" value={`${overview.dailyQuiz?.leaderboard.length || 0} visible`} hint="Daily and weekly style positioning" icon={Trophy} />
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

const LiveTab = ({ overview }: { overview: PlatformOverview }) => {
  const { user } = useAuth();
  const [selectedLiveClassId, setSelectedLiveClassId] = useState<string | null>(overview.liveClasses[0]?._id || null);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>([]);
  const [chatMessage, setChatMessage] = useState('');
  const [chatKind, setChatKind] = useState<'chat' | 'doubt'>('chat');
  const [chatBusy, setChatBusy] = useState(false);
  const selectedLiveClass = useMemo(
    () => overview.liveClasses.find((item) => item._id === selectedLiveClassId) || overview.liveClasses[0] || null,
    [overview.liveClasses, selectedLiveClassId],
  );

  useEffect(() => {
    if (!selectedLiveClass?._id) {
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
  }, [selectedLiveClass?._id]);

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

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
        <SectionHeader title="Live classes & replay" caption="WebRTC / Zoom / Agora ready" />
        <div className="mt-6 space-y-4">
          {overview.liveClasses.map((liveClass) => (
            <button
              key={liveClass._id}
              onClick={() => setSelectedLiveClassId(liveClass._id)}
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
                  liveClass.mode === 'live' ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-white text-[var(--accent-rust)]',
                )}>
                  {liveClass.mode}
                </span>
                <span className="text-sm text-[var(--ink-soft)]">{liveClass.provider}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[var(--ink)]">{liveClass.title}</h3>
              <p className="mt-2 text-sm text-[var(--ink-soft)]">{liveClass.instructor}</p>
              <p className="mt-3 text-sm text-[var(--ink-soft)]">{formatDateTime(liveClass.startTime)} • {liveClass.attendees} learners</p>
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
                      ? 'Join the live room for real-time explanation, doubt solving, and chat.'
                      : 'Replay is stored so learners can revisit the session later with the same topic context.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {selectedLiveClass.roomUrl && selectedLiveClass.mode === 'live' && (
                    <a href={selectedLiveClass.roomUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white">
                      Join live room
                    </a>
                  )}
                  {selectedLiveClass.recordingUrl && (
                    <a href={selectedLiveClass.recordingUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-[var(--line)] px-5 py-3 font-semibold text-[var(--ink)]">
                      Open replay
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <MetricCard title="Format" value={selectedLiveClass.mode} hint="Live plus replay-ready delivery" icon={Radio} />
                <MetricCard title="Chat" value={selectedLiveClass.chatEnabled ? 'On' : 'Off'} hint="Real-time class discussion" icon={MessageSquare} />
                <MetricCard title="Recordings" value={selectedLiveClass.replayAvailable ? 'Stored' : 'None'} hint="Replay available after class ends" icon={Video} />
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {selectedLiveClass.topicTags.map((tag) => (
                  <span key={tag} className="rounded-full bg-[var(--accent-cream)] px-3 py-2 text-xs text-[var(--ink)]">{tag}</span>
                ))}
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

  const activatePlan = async (plan: (typeof overview.subscriptions)[number]) => {
    if (!user || plan.active) {
      return;
    }

    setBusyPlanId(plan._id);
    try {
      await EduService.unlockSubscription(plan);
      await onRefresh();
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
              <p className="text-sm text-[var(--ink-soft)]">Instant access is granted after the simulated payment + subscription activation flow.</p>
            </div>
            <div className="mt-6 rounded-[24px] bg-[var(--accent-cream)] p-4 text-sm text-[var(--ink-soft)]">
              Payment retries, failure handling, and instant access handoff are modeled in the backend payment, webhook, and subscription activation flow.
            </div>
          </div>
        ))}
      </div>
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
  const [testTitle, setTestTitle] = useState('New Topic Test');
  const [mockTestForm, setMockTestForm] = useState({
    title: 'Network Theory Booster Mock',
    category: 'SSC JE',
    type: 'sectional',
    durationMinutes: 30,
    negativeMarking: 0.25,
    topic: 'Network Theory',
  });
  const [quizForm, setQuizForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    prompt: 'Thevenin theorem converts a network into:',
    options: 'Voltage source + series resistance,Current source only,Ideal transformer only,Open circuit',
    answer: 'Voltage source + series resistance',
    explanation: 'Thevenin reduces a linear bilateral network to an equivalent voltage source and series resistance.',
    topic: 'Network Theory',
  });
  const [adminMessage, setAdminMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const seed = async () => {
    setBusy(true);
    try {
      await EduService.seedSampleData();
      setAdminMessage('Sample platform data is ready.');
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

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

  const uploadQuestions = async () => {
    setBusy(true);
    try {
      await EduService.uploadQuestions({
        title: testTitle,
        category: 'SSC JE',
        type: 'topic-wise',
        questions: [
          {
            id: 'bulk_q1',
            questionText: 'The SI unit of capacitance is:',
            options: ['Volt', 'Farad', 'Weber', 'Tesla'],
            correctOption: 1,
            explanation: 'Capacitance is measured in farads.',
            marks: 1,
            topic: 'Basic Electrical Engineering',
          },
        ],
      });
      setAdminMessage('Bulk question upload route executed successfully.');
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const createMockTest = async () => {
    setBusy(true);
    try {
      await EduService.createMockTest({
        title: mockTestForm.title,
        description: `Admin-created ${mockTestForm.type} test for ${mockTestForm.topic}`,
        category: mockTestForm.category,
        type: mockTestForm.type,
        durationMinutes: mockTestForm.durationMinutes,
        negativeMarking: mockTestForm.negativeMarking,
        sectionBreakup: [{ name: mockTestForm.topic, questions: 2 }],
        questions: [
          {
            id: `admin_mock_${Date.now()}_1`,
            questionText: `${mockTestForm.topic}: identify the correct revision statement.`,
            options: ['Statement A', 'Statement B', 'Statement C', 'Statement D'],
            correctOption: 1,
            explanation: 'Demo explanation for the first admin-created question.',
            marks: 1,
            topic: mockTestForm.topic,
          },
          {
            id: `admin_mock_${Date.now()}_2`,
            questionText: `Timed practice question for ${mockTestForm.topic}.`,
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctOption: 2,
            explanation: 'Demo explanation for the second admin-created question.',
            marks: 1,
            topic: mockTestForm.topic,
          },
        ],
      });
      setAdminMessage('Mock test created through the secured admin flow.');
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const createQuiz = async () => {
    setBusy(true);
    try {
      await EduService.createQuiz({
        date: quizForm.date,
        questions: [
          {
            id: `quiz_${Date.now()}`,
            prompt: quizForm.prompt,
            options: quizForm.options.split(',').map((item) => item.trim()).filter(Boolean),
            answer: quizForm.answer,
            explanation: quizForm.explanation,
            topic: quizForm.topic,
          },
        ],
      });
      setAdminMessage('Daily quiz created through the secured admin flow.');
      await onRefresh();
    } finally {
      setBusy(false);
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
          <SectionHeader title="Operations" caption="Seed and test admin APIs" />
          <div className="mt-6 space-y-4">
            <button onClick={() => void seed()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-4 font-semibold text-white">
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              Seed sample data
            </button>
            <button onClick={() => void uploadQuestions()} disabled={busy} className="w-full rounded-2xl border border-[var(--line)] px-5 py-4 font-semibold text-[var(--ink)]">
              Upload sample question CSV payload
            </button>
            <div className="rounded-[24px] bg-[var(--accent-cream)] p-4 text-sm text-[var(--ink-soft)]">
              Demo admin credentials: {overview.adminOverview?.sampleCredentials.adminEmail} / {overview.adminOverview?.sampleCredentials.adminPassword}
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
            <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => void createCourse()} disabled={busy} className="rounded-2xl bg-[var(--ink)] px-5 py-4 font-semibold text-white">
                Create course
              </button>
              <input value={testTitle} onChange={(event) => setTestTitle(event.target.value)} placeholder="Bulk upload test title" className="flex-1 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.07)]">
          <SectionHeader title="Create mock test" caption="Sectional, topic-wise, or full-length" />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <input value={mockTestForm.title} onChange={(event) => setMockTestForm((current) => ({ ...current, title: event.target.value }))} placeholder="Mock test title" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={mockTestForm.topic} onChange={(event) => setMockTestForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Topic / section" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={mockTestForm.category} onChange={(event) => setMockTestForm((current) => ({ ...current, category: event.target.value }))} placeholder="Category" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={mockTestForm.type} onChange={(event) => setMockTestForm((current) => ({ ...current, type: event.target.value }))} placeholder="Type" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input type="number" value={mockTestForm.durationMinutes} onChange={(event) => setMockTestForm((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} placeholder="Duration" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input type="number" step="0.01" value={mockTestForm.negativeMarking} onChange={(event) => setMockTestForm((current) => ({ ...current, negativeMarking: Number(event.target.value) }))} placeholder="Negative marking" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
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
            <input value={quizForm.prompt} onChange={(event) => setQuizForm((current) => ({ ...current, prompt: event.target.value }))} placeholder="Quiz question" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <input value={quizForm.options} onChange={(event) => setQuizForm((current) => ({ ...current, options: event.target.value }))} placeholder="Comma-separated options" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            <div className="grid gap-4 md:grid-cols-2">
              <input value={quizForm.answer} onChange={(event) => setQuizForm((current) => ({ ...current, answer: event.target.value }))} placeholder="Correct answer" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
              <input value={quizForm.topic} onChange={(event) => setQuizForm((current) => ({ ...current, topic: event.target.value }))} placeholder="Topic" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
            </div>
            <textarea value={quizForm.explanation} onChange={(event) => setQuizForm((current) => ({ ...current, explanation: event.target.value }))} placeholder="Explanation" className="h-28 rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-4 outline-none" />
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

  const refreshOverview = async (background = true) => {
    if (!background) {
      setLoadingOverview(true);
    }
    try {
      await EduService.seedPlatform();
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

  return <Shell overview={overview} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={logout} onRefresh={() => refreshOverview(true)} />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
