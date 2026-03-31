import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, LoaderCircle, Lock, PlayCircle, Wallet } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { EduService } from '../EduService';
import { cn } from '../lib/utils';
import { CourseCard, CourseLesson, PlatformOverview } from '../types';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

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

const SectionHeader = ({ title, caption }: { title: string; caption: string }) => (
  <div className="flex items-end justify-between gap-4">
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">{caption}</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">{title}</h2>
    </div>
  </div>
);

const buildResumeStorageKey = (userId: string, courseId: string) => `edumaster.resume.${userId}.${courseId}`;

type ResumeRecord = {
  lessonId: string;
  progressPercent: number;
  progressSeconds: number;
  completed: boolean;
  updatedAt: string;
};

type WindowWithProgressFlush = Window & {
  __edumasterFlushProgress?: () => Promise<void>;
};

type PlaybackSnapshot = {
  lesson: CourseLesson | null;
  courseId: string | null;
  canAccess: boolean;
  progressSeconds: number;
  mediaDurationSeconds: number;
  completed: boolean;
};

const readResumeCache = (userId: string, courseId: string) => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(buildResumeStorageKey(userId, courseId));
    return raw ? JSON.parse(raw) as Record<string, ResumeRecord> : {};
  } catch {
    return {};
  }
};

const writeResumeCache = (
  userId: string,
  courseId: string,
  value: Record<string, ResumeRecord>,
) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(buildResumeStorageKey(userId, courseId), JSON.stringify(value));
  } catch {
    // Ignore storage write failures and rely on backend progress.
  }
};

const seekHostedVideoToResume = (
  media: HTMLVideoElement,
  lessonId: string,
  resumeSeconds: number,
  appliedResumeRef: React.MutableRefObject<Record<string, number>>,
) => {
  const safeResumeSeconds = Math.max(Math.floor(resumeSeconds || 0), 0);
  if (!lessonId || safeResumeSeconds <= 0) {
    return;
  }

  const mediaDuration = Number.isFinite(media.duration) ? media.duration : 0;
  const maxSeekTarget = mediaDuration > 2 ? mediaDuration - 1 : mediaDuration;
  const targetSeconds = mediaDuration > 0
    ? Math.min(safeResumeSeconds, Math.max(maxSeekTarget, 0))
    : safeResumeSeconds;

  if (targetSeconds <= 0) {
    return;
  }

  const previouslyApplied = appliedResumeRef.current[lessonId] || 0;
  if (Math.abs(previouslyApplied - targetSeconds) < 1 && Math.abs(media.currentTime - targetSeconds) < 1) {
    return;
  }

  const applySeek = () => {
    try {
      if (Math.abs(media.currentTime - targetSeconds) > 1) {
        media.currentTime = targetSeconds;
      }
      appliedResumeRef.current[lessonId] = targetSeconds;
    } catch {
      // Ignore transient seek failures until metadata is ready enough.
    }
  };

  applySeek();
  window.requestAnimationFrame(applySeek);
  window.setTimeout(applySeek, 120);
  window.setTimeout(applySeek, 400);
};

const getModuleLessonEntries = (course: CourseCard | null) =>
  (course?.modules || []).flatMap((module) => ([
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

const getCourseProgressSnapshot = (
  course: CourseCard,
  overrides: Record<string, ResumeRecord> = {},
) => {
  const lessonEntries = getModuleLessonEntries(course);
  const totalLessons = lessonEntries.length;
  const mergedProgress = new Map<string, ResumeRecord>();

  (course.lessonProgress || []).forEach((entry) => {
    mergedProgress.set(entry.lessonId, entry);
  });

  Object.values(overrides).forEach((entry) => {
    mergedProgress.set(entry.lessonId, entry);
  });

  const completedLessons = lessonEntries.filter((entry) => mergedProgress.get(entry.lesson.id)?.completed).length;
  const progressPercent = totalLessons === 0
    ? 0
    : Math.round(
      lessonEntries.reduce((sum, entry) => sum + Number(mergedProgress.get(entry.lesson.id)?.progressPercent || 0), 0) / totalLessons,
    );

  return {
    totalLessons,
    completedLessons,
    progressPercent,
  };
};

export const CoursesTab = ({
  overview,
  onRefresh,
  initialCourseId,
  initialLessonId,
  onResumeNavigationHandled,
}: {
  overview: PlatformOverview;
  onRefresh: () => Promise<void>;
  initialCourseId?: string | null;
  initialLessonId?: string | null;
  onResumeNavigationHandled?: () => void;
}) => {
  const { user } = useAuth();
  const enrolledCourseCount = useMemo(
    () => overview.courses.filter((course) => course.enrolled).length,
    [overview.courses],
  );
  const [lessonProgressOverrides, setLessonProgressOverrides] = useState<Record<string, {
    lessonId: string;
    progressPercent: number;
    progressSeconds: number;
    completed: boolean;
    updatedAt: string;
  }>>({});
  const [courseView, setCourseView] = useState<'my' | 'catalog'>(enrolledCourseCount > 0 ? 'my' : 'catalog');
  const [courseQuery, setCourseQuery] = useState('');
  const [accessFilter, setAccessFilter] = useState<'all' | 'unlocked' | 'premium' | 'free'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId || overview.courses[0]?._id || null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(initialLessonId || null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastProgressSyncRef = useRef<Record<string, number>>({});
  const appliedResumeRef = useRef<Record<string, number>>({});
  const activeCourseIdRef = useRef<string | null>(selectedCourseId);
  const playbackSnapshotRef = useRef<PlaybackSnapshot>({
    lesson: null,
    courseId: null,
    canAccess: false,
    progressSeconds: 0,
    mediaDurationSeconds: 0,
    completed: false,
  });
  const latestPersistRef = useRef<{
    persist: ((
      courseId: string,
      canAccess: boolean,
      lesson: CourseLesson,
      progressSeconds: number,
      completed: boolean,
      force?: boolean,
      mediaDurationSeconds?: number,
    ) => Promise<void>) | null;
  }>({ persist: null });
  const latestSelectionRef = useRef<{
    lesson: CourseLesson | null;
    courseId: string | null;
    canAccess: boolean;
  }>({ lesson: null, courseId: null, canAccess: false });
  const deferredCourseQuery = useDeferredValue(courseQuery);
  const categories = useMemo(
    () => ['all', ...Array.from(new Set(overview.courses.map((course) => course.category).filter(Boolean)))],
    [overview.courses],
  );
  const filteredCourses = useMemo(() => {
    const normalizedQuery = deferredCourseQuery.trim().toLowerCase();

    return overview.courses.filter((course) => {
      const matchesView = courseView === 'catalog' || Boolean(course.enrolled);
      const matchesQuery = !normalizedQuery || [
        course.title,
        course.subject,
        course.category,
        course.exam,
        course.instructor,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));

      const matchesAccess = accessFilter === 'all'
        || (accessFilter === 'unlocked' && Boolean(course.enrolled))
        || (accessFilter === 'premium' && !course.enrolled && course.price > 0)
        || (accessFilter === 'free' && course.price === 0);

      const matchesCategory = categoryFilter === 'all' || course.category === categoryFilter;

      return matchesView && matchesQuery && matchesAccess && matchesCategory;
    });
  }, [overview.courses, courseView, deferredCourseQuery, accessFilter, categoryFilter]);
  const selectedCourse = useMemo(
    () => filteredCourses.find((course) => course._id === selectedCourseId) || filteredCourses[0] || null,
    [filteredCourses, selectedCourseId],
  );
  const selectedLessonMeta = useMemo(() => {
    if (!selectedCourse) {
      return null;
    }

    const lessons = getModuleLessonEntries(selectedCourse);

    return lessons.find((entry) => entry.lesson.id === selectedLessonId)
      || lessons.find((entry) => entry.lesson.id === selectedCourse.continueLesson?.id)
      || lessons[0]
      || null;
  }, [selectedCourse, selectedLessonId]);

  useEffect(() => {
    if (!selectedCourseId && filteredCourses[0]) {
      setSelectedCourseId(filteredCourses[0]._id);
    }
  }, [filteredCourses, selectedCourseId]);

  useEffect(() => {
    const visibleIds = new Set(filteredCourses.map((course) => course._id));
    if (selectedCourseId && visibleIds.has(selectedCourseId)) {
      return;
    }

    setSelectedCourseId(filteredCourses[0]?._id || null);
  }, [filteredCourses, selectedCourseId]);

  useEffect(() => {
    if (initialCourseId) {
      setSelectedCourseId(initialCourseId);
    }
    if (initialLessonId) {
      setSelectedLessonId(initialLessonId);
    }
    if (initialCourseId || initialLessonId) {
      onResumeNavigationHandled?.();
    }
  }, [initialCourseId, initialLessonId, onResumeNavigationHandled]);

  useEffect(() => {
    if (!selectedCourse) {
      return;
    }

    const lessonIds = getModuleLessonEntries(selectedCourse).map((entry) => entry.lesson.id);
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
      if (course.price === 0) {
        await EduService.enrollInCourse(course._id, 'free-course');
        await onRefresh();
        return;
      }

      const checkout = await EduService.unlockCourse(course);
      const popup = window.open(checkout.url, 'edumaster-stripe-checkout', 'popup=yes,width=520,height=760');

      if (!popup) {
        throw new Error('Stripe popup was blocked. Please allow popups and try again.');
      }

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeoutId = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          window.removeEventListener('message', handleMessage);
          reject(new Error('Payment confirmation timed out. If payment succeeded, refresh and try again.'));
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
          if (data.type !== 'STRIPE_PAYMENT_SUCCESS' || data.courseId !== course._id || !data.sessionId) {
            return;
          }

          try {
            await EduService.confirmCoursePayment(data.sessionId, course._id);
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
              reject(error instanceof Error ? error : new Error('Payment confirmation failed.'));
            }
          }
        };

        window.addEventListener('message', handleMessage);
      });

      await onRefresh();
    } finally {
      setBusyCourseId(null);
    }
  };

  const selectedLesson = selectedLessonMeta?.lesson || null;
  const canAccessLesson = Boolean(selectedCourse?.enrolled || (!selectedLesson?.premium && !selectedLesson?.locked));
  const embedUrl = selectedLesson?.type === 'youtube' ? getYouTubeEmbedUrl(selectedLesson.videoUrl) : null;
  const hostedVideoUrl = selectedLesson?.type === 'video' ? selectedLesson.videoUrl || null : null;
  const effectiveLessonProgress = useMemo(() => {
    const merged = new Map<string, ResumeRecord>();

    (selectedCourse?.lessonProgress || []).forEach((entry) => {
      merged.set(entry.lessonId, entry);
    });

    Object.values(lessonProgressOverrides).forEach((entry) => {
      merged.set(entry.lessonId, entry);
    });

    return Array.from(merged.values());
  }, [lessonProgressOverrides, selectedCourse?.lessonProgress]);
  const lessonProgressMap = useMemo(
    () => new Map(effectiveLessonProgress.map((entry) => [entry.lessonId, entry])),
    [effectiveLessonProgress],
  );
  const lastWatchedLessonId = useMemo(() => {
    const history = [...effectiveLessonProgress].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
    return history[0]?.lessonId || null;
  }, [effectiveLessonProgress]);
  const selectedLessonProgress = selectedLesson ? lessonProgressMap.get(selectedLesson.id) : null;
  const selectedCourseSnapshot = useMemo(
    () => selectedCourse ? getCourseProgressSnapshot(selectedCourse, lessonProgressOverrides) : { totalLessons: 0, completedLessons: 0, progressPercent: 0 },
    [selectedCourse, lessonProgressOverrides],
  );

  useEffect(() => {
    activeCourseIdRef.current = selectedCourse?._id || null;
  }, [selectedCourse?._id]);

  useEffect(() => {
    playbackSnapshotRef.current = {
      lesson: selectedLesson,
      courseId: selectedCourse?._id || null,
      canAccess: canAccessLesson,
      progressSeconds: selectedLessonProgress?.progressSeconds || 0,
      mediaDurationSeconds: videoRef.current?.duration || 0,
      completed: Boolean(selectedLessonProgress?.completed),
    };
  }, [selectedLesson, selectedCourse?._id, canAccessLesson, selectedLessonProgress?.progressSeconds, selectedLessonProgress?.completed]);

  useEffect(() => {
    latestSelectionRef.current = {
      lesson: selectedLesson,
      courseId: selectedCourse?._id || null,
      canAccess: canAccessLesson,
    };
  }, [selectedLesson, selectedCourse?._id, canAccessLesson]);

  useEffect(() => {
    setLessonProgressOverrides({});
    lastProgressSyncRef.current = {};
  }, [selectedCourse?._id]);

  useEffect(() => {
    if (!user?._id || !selectedCourse?._id) {
      return;
    }

    const cached = readResumeCache(user._id, selectedCourse._id);
    setLessonProgressOverrides(cached);
    lastProgressSyncRef.current = Object.values(cached).reduce<Record<string, number>>((accumulator, entry) => {
      accumulator[entry.lessonId] = entry.progressSeconds || 0;
      return accumulator;
    }, {});
  }, [user?._id, selectedCourse?._id]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, hostedVideoUrl]);

  const persistLessonProgress = async (
    courseId: string,
    canAccess: boolean,
    lesson: CourseLesson,
    progressSeconds: number,
    completed: boolean,
    force = false,
    mediaDurationSeconds?: number,
  ) => {
    if (!user || !courseId || !canAccess) {
      return;
    }

    const safeSeconds = Math.max(Math.floor(progressSeconds || 0), 0);
    const normalizedMediaDuration = Number.isFinite(mediaDurationSeconds || NaN)
      ? Math.max(Math.floor(mediaDurationSeconds || 0), 0)
      : 0;
    const configuredDurationSeconds = Math.max(Math.round((lesson.durationMinutes || 0) * 60), 0);
    const durationSeconds = Math.max(normalizedMediaDuration, configuredDurationSeconds, safeSeconds, 1);
    const derivedCompleted = completed || (normalizedMediaDuration > 0 && safeSeconds >= Math.max(normalizedMediaDuration - 2, 1));
    const progressPercent = derivedCompleted ? 100 : Math.min(99, Math.max(0, Math.round((safeSeconds / durationSeconds) * 100)));
    const progressKey = `${courseId}:${lesson.id}`;
    const alreadyCompleted = courseId === activeCourseIdRef.current
      ? Boolean(lessonProgressMap.get(lesson.id)?.completed)
      : false;
    const nextRecord = {
      lessonId: lesson.id,
      progressPercent,
      progressSeconds: safeSeconds,
      completed: derivedCompleted,
      updatedAt: new Date().toISOString(),
    };

    if (user?._id) {
      const cached = readResumeCache(user._id, courseId);
      const nextState = {
        ...cached,
        [lesson.id]: nextRecord,
      };
      writeResumeCache(user._id, courseId, nextState);

      if (activeCourseIdRef.current === courseId) {
        setLessonProgressOverrides(nextState);
      }
    }

    const previousSynced = lastProgressSyncRef.current[progressKey] || 0;
    if (!force && Math.abs(safeSeconds - previousSynced) < 15 && !derivedCompleted) {
      return;
    }

    lastProgressSyncRef.current[progressKey] = safeSeconds;
    try {
      await EduService.updateWatchProgress(
        courseId,
        lesson.id,
        progressPercent,
        safeSeconds,
        derivedCompleted,
        force ? { keepalive: true } : {},
      );
      if (derivedCompleted && !alreadyCompleted) {
        void onRefresh();
      }
    } catch (error) {
      console.error('Failed to sync lesson progress:', error);
    }
  };

  const flushTrackedPlayback = async () => {
    const snapshot = playbackSnapshotRef.current;
    if (!snapshot.lesson || !snapshot.courseId || !snapshot.canAccess) {
      return;
    }

    if (snapshot.progressSeconds <= 0 && !snapshot.completed) {
      return;
    }

    await persistLessonProgress(
      snapshot.courseId,
      snapshot.canAccess,
      snapshot.lesson,
      snapshot.progressSeconds,
      snapshot.completed,
      true,
      snapshot.mediaDurationSeconds,
    );
  };

  useEffect(() => {
    latestPersistRef.current.persist = persistLessonProgress;
  }, [persistLessonProgress]);

  useEffect(() => {
    const syncCurrentPlayback = async () => {
      const currentVideo = videoRef.current;
      const latestSelection = latestSelectionRef.current;
      const isCurrentVideoForSelectedLesson = Boolean(
        currentVideo
        && hostedVideoUrl
        && currentVideo.currentSrc
        && (currentVideo.currentSrc === hostedVideoUrl || currentVideo.currentSrc.includes(hostedVideoUrl)),
      );

      if (!isCurrentVideoForSelectedLesson || !latestSelection.lesson || !latestSelection.courseId || !latestSelection.canAccess) {
        await flushTrackedPlayback();
        return;
      }

      playbackSnapshotRef.current = {
        lesson: latestSelection.lesson,
        courseId: latestSelection.courseId,
        canAccess: latestSelection.canAccess,
        progressSeconds: currentVideo.currentTime,
        mediaDurationSeconds: currentVideo.duration || 0,
        completed: currentVideo.ended || currentVideo.currentTime >= Math.max(currentVideo.duration - 2, 0),
      };

      await persistLessonProgress(
        latestSelection.courseId,
        latestSelection.canAccess,
        latestSelection.lesson,
        currentVideo.currentTime,
        currentVideo.ended || currentVideo.currentTime >= Math.max(currentVideo.duration - 2, 0),
        true,
        currentVideo.duration,
      );
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        void syncCurrentPlayback();
      }
    };

    const handlePageHide = () => {
      void syncCurrentPlayback();
    };

    window.addEventListener('beforeunload', syncCurrentPlayback);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      window.removeEventListener('beforeunload', syncCurrentPlayback);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      void syncCurrentPlayback();
    };
  }, [selectedCourse?._id, selectedLesson?.id, canAccessLesson]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const globalWindow = window as WindowWithProgressFlush;
    globalWindow.__edumasterFlushProgress = async () => {
      await flushTrackedPlayback();
    };

    return () => {
      if (globalWindow.__edumasterFlushProgress) {
        delete globalWindow.__edumasterFlushProgress;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      void flushTrackedPlayback();
    };
  }, [selectedLesson?.id, selectedCourse?._id]);

  useEffect(() => {
    if (!hostedVideoUrl || !selectedLesson?.id || !selectedLessonProgress?.progressSeconds || !videoRef.current) {
      return;
    }

    seekHostedVideoToResume(
      videoRef.current,
      selectedLesson.id,
      selectedLessonProgress.progressSeconds,
      appliedResumeRef,
    );
  }, [hostedVideoUrl, selectedLesson?.id, selectedLessonProgress?.progressSeconds]);

  const handleSelectCourse = (courseId: string) => {
    void flushTrackedPlayback();
    setSelectedCourseId(courseId);
  };

  const handleSelectLesson = (lessonId: string) => {
    void flushTrackedPlayback();
    setSelectedLessonId(lessonId);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.92fr)_minmax(0,1.08fr)]">
      <section className="min-w-0 rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        <SectionHeader
          title={courseView === 'my' ? 'My courses' : 'Course catalog'}
          caption="Category → Course → Subject → Chapter → Topic"
        />
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setCourseView('my')}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              courseView === 'my' ? 'bg-[var(--ink)] text-white' : 'bg-[var(--accent-cream)] text-[var(--ink-soft)]',
            )}
          >
            My courses
          </button>
          <button
            onClick={() => setCourseView('catalog')}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              courseView === 'catalog' ? 'bg-[var(--ink)] text-white' : 'bg-[var(--accent-cream)] text-[var(--ink-soft)]',
            )}
          >
            Explore catalog
          </button>
        </div>
        <div className="mt-6 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_220px]">
          <input value={courseQuery} onChange={(event) => setCourseQuery(event.target.value)} placeholder="Search courses, exams, subjects, or instructors" className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-3 outline-none" />
          <select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value as typeof accessFilter)} className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-3 outline-none">
            <option value="all">All access types</option>
            <option value="unlocked">Unlocked</option>
            <option value="premium">Premium</option>
            <option value="free">Free</option>
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-2xl border border-[var(--line)] bg-[var(--accent-cream)] px-4 py-3 outline-none">
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'all' ? 'All categories' : category}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--ink-soft)]">
          <span className="rounded-full bg-[var(--accent-cream)] px-4 py-2">{filteredCourses.length} course{filteredCourses.length === 1 ? '' : 's'} found</span>
          <span className="rounded-full bg-[var(--accent-cream)] px-4 py-2">{filteredCourses.filter((course) => course.enrolled).length} active</span>
          <span className="rounded-full bg-[var(--accent-cream)] px-4 py-2">{filteredCourses.reduce((sum, course) => sum + (course.lessonCount || 0), 0)} topics</span>
        </div>
        <div className="mt-6 space-y-4">
          {filteredCourses.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-[var(--line)] p-6 text-center text-[var(--ink-soft)]">
              {courseView === 'my'
                ? 'You have not unlocked any courses yet. Switch to Explore catalog to browse available courses.'
                : 'No courses match your current search and filters. Try a different keyword or category.'}
            </div>
          ) : filteredCourses.map((course) => (
            <button key={course._id} onClick={() => handleSelectCourse(course._id)} className={cn('w-full rounded-[26px] border p-4 text-left transition', selectedCourse?._id === course._id ? 'border-[var(--accent-rust)] bg-[var(--accent-cream)]' : 'border-[var(--line)] bg-white hover:border-[var(--accent-rust)]/35')}>
              <div className="flex gap-4">
                <img src={course.thumbnailUrl} alt={course.title} className="h-24 w-24 shrink-0 rounded-[18px] object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-soft)]">{course.category}</p>
                    <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', course.enrolled ? 'bg-[var(--success-soft)] text-[var(--success)]' : course.price === 0 ? 'bg-blue-50 text-blue-700' : 'bg-[var(--accent-cream)] text-[var(--accent-rust)]')}>
                      {course.enrolled ? 'Unlocked' : course.price === 0 ? 'Free' : 'Premium'}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-[var(--ink)]">{course.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--ink-soft)]">{course.description}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="text-[var(--ink-soft)]">
                      {(() => {
                        const snapshot = getCourseProgressSnapshot(
                          course,
                          selectedCourse?._id === course._id ? lessonProgressOverrides : {},
                        );
                        return `${snapshot.totalLessons || course.lessonCount} topics • ${snapshot.progressPercent}% done`;
                      })()}
                    </span>
                    <span className="font-semibold text-[var(--ink)]">{course.price === 0 ? 'Free' : currency.format(course.price)}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="min-w-0 rounded-[30px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
        {selectedCourse ? (
          <>
            <div className="overflow-hidden rounded-[30px] border border-[var(--line)] bg-[linear-gradient(135deg,rgba(255,251,245,0.96),rgba(255,255,255,0.98))]">
              <img src={selectedCourse.thumbnailUrl} alt={selectedCourse.title} className="h-64 w-full object-cover lg:h-72" />
              <div className="p-6 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--ink-soft)]">{selectedCourse.exam}</p>
                  <span className={cn('rounded-full px-4 py-2 text-sm font-semibold', selectedCourse.enrolled ? 'bg-[var(--success-soft)] text-[var(--success)]' : selectedCourse.price === 0 ? 'bg-blue-50 text-blue-700' : 'bg-[var(--accent-cream)] text-[var(--accent-rust)]')}>
                    {selectedCourse.enrolled ? 'Access active' : selectedCourse.price === 0 ? 'Free access' : 'Premium access'}
                  </span>
                </div>
                <div className="mt-5 grid gap-5 2xl:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] 2xl:items-start">
                  <div className="min-w-0">
                    <h2 className="max-w-3xl break-words text-[clamp(2rem,2.6vw,3.15rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-[var(--ink)]">{selectedCourse.title}</h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-soft)]">{selectedCourse.description}</p>
                    <div className="mt-5 flex flex-wrap gap-3 text-sm">
                      <span className="rounded-full bg-[var(--accent-cream)] px-4 py-2 text-[var(--ink)]">{selectedCourse.subject}</span>
                      <span className="rounded-full bg-[var(--accent-cream)] px-4 py-2 text-[var(--ink)]">{selectedCourse.level}</span>
                      <span className="rounded-full bg-[var(--accent-cream)] px-4 py-2 text-[var(--ink)]">{selectedCourse.validityDays} day access</span>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      {selectedCourse.enrolled ? (
                        <span className="rounded-full bg-[var(--success-soft)] px-4 py-3 text-sm font-semibold text-[var(--success)]">Access active</span>
                      ) : (
                        <button onClick={() => handleUnlock(selectedCourse)} disabled={busyCourseId === selectedCourse._id} className="flex items-center gap-2 rounded-2xl bg-[var(--accent-rust)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--accent-rust-strong)] disabled:opacity-60">
                          {busyCourseId === selectedCourse._id ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                          {selectedCourse.price === 0 ? 'Start free course' : 'Pay & unlock course'}
                        </button>
                      )}
                      {selectedCourse.officialChannelUrl && (
                        <a href={selectedCourse.officialChannelUrl} target="_blank" rel="noreferrer" className="rounded-full border border-[var(--line)] px-4 py-3 text-sm font-medium text-[var(--ink)] transition hover:border-[var(--accent-rust)]">
                          Official channel
                        </a>
                      )}
                    </div>
                    <p className="mt-4 text-sm text-[var(--ink-soft)]">Includes YouTube lessons, hosted videos, PDF notes, resume playback, and enrollment-gated premium access.</p>
                  </div>
                  <div className="grid gap-3 self-start sm:grid-cols-3 2xl:grid-cols-1">
                    <div className="rounded-[22px] bg-white/90 px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Course progress</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{selectedCourseSnapshot.progressPercent}%</p>
                  </div>
                  <div className="rounded-[22px] bg-white/90 px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Modules</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{selectedCourse.modules.length}</p>
                  </div>
                  <div className="rounded-[22px] bg-white/90 px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Completed topics</p>
                    <p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{selectedCourseSnapshot.completedLessons}</p>
                  </div>
                </div>
              </div>
              </div>
            </div>

            {selectedLesson && (
              <div className="mt-8 rounded-[28px] bg-[var(--card-dark)] p-5 text-white sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                      {selectedLessonMeta?.chapterTitle ? `${selectedLessonMeta.moduleTitle} • ${selectedLessonMeta.chapterTitle}` : selectedLessonMeta?.moduleTitle}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold">{selectedLesson.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-white/70">{selectedLesson.durationMinutes} min • {selectedLesson.type} • {canAccessLesson ? 'Resume-ready playback' : 'Purchase required to unlock this premium topic'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/80">
                      <span className="mr-2">Speed</span>
                      <select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))} className="bg-transparent outline-none">
                        {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                          <option key={speed} value={speed} className="text-[var(--ink)]">{speed}x</option>
                        ))}
                      </select>
                    </label>
                    {selectedLesson.notesUrl && canAccessLesson && (
                      <a href={selectedLesson.notesUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white/80">
                        Open notes PDF
                      </a>
                    )}
                    {selectedLessonProgress?.completed && (
                      <span className="rounded-full bg-[var(--success-soft)] px-4 py-2 text-sm font-semibold text-[var(--success)]">
                        Topic completed
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-black/25">
                  {canAccessLesson && embedUrl ? (
                    <iframe src={embedUrl} title={selectedLesson.title} className="aspect-video w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  ) : canAccessLesson && hostedVideoUrl ? (
                    <video
                      key={`${selectedLesson.id}:${hostedVideoUrl}`}
                      ref={videoRef}
                      src={hostedVideoUrl}
                      onLoadedMetadata={(event) => {
                        const resumeSeconds = selectedLessonProgress?.progressSeconds || 0;
                        if (resumeSeconds > 0) {
                          seekHostedVideoToResume(
                            event.currentTarget,
                            selectedLesson.id,
                            resumeSeconds,
                            appliedResumeRef,
                          );
                        }
                      }}
                      onCanPlay={(event) => {
                        const resumeSeconds = selectedLessonProgress?.progressSeconds || 0;
                        if (resumeSeconds > 0) {
                          seekHostedVideoToResume(
                            event.currentTarget,
                            selectedLesson.id,
                            resumeSeconds,
                            appliedResumeRef,
                          );
                        }
                      }}
                      onTimeUpdate={(event) => {
                        if (!selectedLesson) return;
                        playbackSnapshotRef.current = {
                          lesson: selectedLesson,
                          courseId: selectedCourse._id,
                          canAccess: canAccessLesson,
                          progressSeconds: event.currentTarget.currentTime,
                          mediaDurationSeconds: event.currentTarget.duration || 0,
                          completed: false,
                        };
                        void persistLessonProgress(
                          selectedCourse._id,
                          canAccessLesson,
                          selectedLesson,
                          event.currentTarget.currentTime,
                          false,
                          false,
                          event.currentTarget.duration,
                        );
                      }}
                      onPause={(event) => {
                        if (!selectedLesson) return;
                        playbackSnapshotRef.current = {
                          lesson: selectedLesson,
                          courseId: selectedCourse._id,
                          canAccess: canAccessLesson,
                          progressSeconds: event.currentTarget.currentTime,
                          mediaDurationSeconds: event.currentTarget.duration || 0,
                          completed: false,
                        };
                        void persistLessonProgress(
                          selectedCourse._id,
                          canAccessLesson,
                          selectedLesson,
                          event.currentTarget.currentTime,
                          false,
                          true,
                          event.currentTarget.duration,
                        );
                      }}
                      onEnded={(event) => {
                        if (!selectedLesson) return;
                        playbackSnapshotRef.current = {
                          lesson: selectedLesson,
                          courseId: selectedCourse._id,
                          canAccess: canAccessLesson,
                          progressSeconds: event.currentTarget.currentTime,
                          mediaDurationSeconds: event.currentTarget.duration || 0,
                          completed: true,
                        };
                        void persistLessonProgress(
                          selectedCourse._id,
                          canAccessLesson,
                          selectedLesson,
                          event.currentTarget.currentTime,
                          true,
                          true,
                          event.currentTarget.duration,
                        );
                      }}
                      controls
                      controlsList="nodownload"
                      playsInline
                      preload="metadata"
                      className="aspect-video w-full bg-black"
                    />
                  ) : canAccessLesson ? (
                    <div className="flex aspect-video flex-col justify-between p-6">
                      <div>
                        <p className="text-sm font-semibold text-white">Platform-hosted playback</p>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-white/68">Premium streams are wired for resume playback and speed control. This demo uses protected placeholder media URLs, so the card stands in for the secured player state.</p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-white/72">
                        <span className="rounded-full border border-white/12 px-3 py-2">Resume supported</span>
                        <span className="rounded-full border border-white/12 px-3 py-2">Playback speed: {playbackSpeed}x</span>
                        <span className="rounded-full border border-white/12 px-3 py-2">{selectedCourseSnapshot.progressPercent}% course progress</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-video flex-col items-center justify-center gap-4 px-6 text-center">
                      <Lock className="h-10 w-10 text-[var(--accent-rust)]" />
                      <div>
                        <p className="text-lg font-semibold">Premium lesson locked</p>
                        <p className="mt-2 text-sm leading-7 text-white/68">Enroll in this course to unlock protected video playback, notes, and tracked progress for this topic.</p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedCourse.continueLesson && (
                  <div className="mt-5 rounded-[22px] bg-white/8 p-4 text-sm text-white/80">
                    Continue watching is available on <span className="font-semibold text-white">{selectedCourse.continueLesson.title}</span> with backend-synced resume time and progress.
                  </div>
                )}
                {selectedLessonProgress && !selectedLessonProgress.completed && (
                  <div className="mt-4 rounded-[22px] border border-white/10 bg-white/6 p-4 text-sm text-white/82">
                    Resume saved at <span className="font-semibold text-white">{formatPlaybackTime(selectedLessonProgress.progressSeconds)}</span>. If you close the app or switch tabs, playback continues from this time when you come back.
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 space-y-5">
              {selectedCourse.modules.map((module) => (
                <div key={module.id} className="rounded-[26px] border border-[var(--line)] p-5">
                  {(() => {
                    const moduleLessons = [
                      ...(module.lessons || []),
                      ...((module.chapters || []).flatMap((chapter) => chapter.lessons || [])),
                    ];
                    const moduleProgressItems = moduleLessons.map((lesson) => lessonProgressMap.get(lesson.id)).filter(Boolean);
                    const completedLessons = moduleProgressItems.filter((item) => item?.completed).length;
                    const moduleProgressPercent = moduleLessons.length === 0 ? 0 : Math.round(moduleLessons.reduce((sum, lesson) => sum + Number(lessonProgressMap.get(lesson.id)?.progressPercent || 0), 0) / moduleLessons.length);

                    return (
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--ink)]">{module.title}</p>
                          <p className="mt-1 text-sm text-[var(--ink-soft)]">{completedLessons}/{moduleLessons.length} topics completed</p>
                        </div>
                        <div className="min-w-[220px]">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                            <span>Subject progress</span>
                            <span>{moduleProgressPercent}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--accent-cream)]">
                            <div className="h-full rounded-full bg-[var(--accent-rust)]" style={{ width: `${moduleProgressPercent}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="mt-4 space-y-3">
                    {(module.lessons || []).map((lesson) => {
                      const lessonProgress = lessonProgressMap.get(lesson.id);
                      const isCompleted = Boolean(lessonProgress?.completed);
                      const isLastWatched = lastWatchedLessonId === lesson.id;
                      const progressText = lessonProgress ? isCompleted ? 'Completed' : `${lessonProgress.progressPercent}% watched` : 'Not started';

                      return (
                        <div key={lesson.id} className="flex flex-col gap-3 rounded-[22px] bg-[var(--accent-cream)] p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {lesson.type === 'youtube' ? <PlayCircle className="h-4 w-4 text-[var(--accent-rust)]" /> : lesson.premium ? <Lock className="h-4 w-4 text-[var(--accent-rust)]" /> : <BookOpen className="h-4 w-4 text-[var(--accent-rust)]" />}
                              <p className="font-medium text-[var(--ink)]">{lesson.title}</p>
                              {lesson.locked && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--accent-rust)]">Locked</span>}
                              {isCompleted && <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-semibold text-[var(--success)]">Completed</span>}
                              {!isCompleted && isLastWatched && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--ink)]">Last watched</span>}
                            </div>
                            <p className="mt-1 text-sm text-[var(--ink-soft)]">{lesson.durationMinutes} min • {lesson.type} • {lesson.notesUrl ? 'PDF notes attached' : 'Video only'}</p>
                            <div className="mt-3 flex items-center gap-3">
                              <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-white/70">
                                <div className={cn('h-full rounded-full', isCompleted ? 'bg-[var(--success)]' : 'bg-[var(--accent-rust)]')} style={{ width: `${Math.min(Math.max(lessonProgress?.progressPercent || 0, 0), 100)}%` }} />
                              </div>
                              <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--ink-soft)]">{progressText}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => handleSelectLesson(lesson.id)} className={cn('rounded-full border px-4 py-2 text-sm font-medium transition', selectedLesson?.id === lesson.id ? 'border-[var(--accent-rust)] bg-white text-[var(--accent-rust)]' : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent-rust)]')}>
                              {lesson.locked ? 'Preview' : isCompleted ? 'Rewatch' : 'Watch'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {(module.chapters || []).map((chapter) => (
                      <div key={chapter.id} className="rounded-[22px] border border-[var(--line)]/70 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ink-soft)]">Chapter</p>
                            <p className="mt-1 text-base font-semibold text-[var(--ink)]">{chapter.title}</p>
                            {chapter.description && <p className="mt-1 text-sm text-[var(--ink-soft)]">{chapter.description}</p>}
                          </div>
                          <span className="rounded-full bg-[var(--accent-cream)] px-3 py-1 text-xs font-semibold text-[var(--ink-soft)]">
                            {(chapter.lessons || []).length} topics
                          </span>
                        </div>

                        <div className="mt-4 space-y-3">
                          {(chapter.lessons || []).map((lesson) => {
                            const lessonProgress = lessonProgressMap.get(lesson.id);
                            const isCompleted = Boolean(lessonProgress?.completed);
                            const isLastWatched = lastWatchedLessonId === lesson.id;
                            const progressText = lessonProgress ? isCompleted ? 'Completed' : `${lessonProgress.progressPercent}% watched` : 'Not started';

                            return (
                              <div key={lesson.id} className="flex flex-col gap-3 rounded-[20px] bg-[var(--accent-cream)] p-4 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {lesson.type === 'youtube' ? <PlayCircle className="h-4 w-4 text-[var(--accent-rust)]" /> : lesson.premium ? <Lock className="h-4 w-4 text-[var(--accent-rust)]" /> : <BookOpen className="h-4 w-4 text-[var(--accent-rust)]" />}
                                    <p className="font-medium text-[var(--ink)]">{lesson.title}</p>
                                    {lesson.locked && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--accent-rust)]">Locked</span>}
                                    {isCompleted && <span className="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-semibold text-[var(--success)]">Completed</span>}
                                    {!isCompleted && isLastWatched && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--ink)]">Last watched</span>}
                                  </div>
                                  <p className="mt-1 text-sm text-[var(--ink-soft)]">{lesson.durationMinutes} min • {lesson.type} • {lesson.notesUrl ? 'PDF notes attached' : 'Video only'}</p>
                                  <div className="mt-3 flex items-center gap-3">
                                    <div className="h-2 w-full max-w-[220px] overflow-hidden rounded-full bg-white/70">
                                      <div className={cn('h-full rounded-full', isCompleted ? 'bg-[var(--success)]' : 'bg-[var(--accent-rust)]')} style={{ width: `${Math.min(Math.max(lessonProgress?.progressPercent || 0, 0), 100)}%` }} />
                                    </div>
                                    <span className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--ink-soft)]">{progressText}</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <button onClick={() => handleSelectLesson(lesson.id)} className={cn('rounded-full border px-4 py-2 text-sm font-medium transition', selectedLesson?.id === lesson.id ? 'border-[var(--accent-rust)] bg-white text-[var(--accent-rust)]' : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-[var(--accent-rust)]')}>
                                    {lesson.locked ? 'Preview' : isCompleted ? 'Rewatch' : 'Watch'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
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
