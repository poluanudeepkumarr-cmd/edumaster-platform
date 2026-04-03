import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { BookOpen, ChevronLeft, ChevronRight, LoaderCircle, Lock, Maximize2, MessageSquare, Minimize2, PlayCircle, Radio, Video, Wallet } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { ProtectedLivePlayback } from './ProtectedLivePlayback';
import { EduService } from '../EduService';
import { cn } from '../lib/utils';
import { CourseCard, CourseLesson, LiveClass, LiveClassAccess, PlatformOverview, ProtectedLessonPlayback } from '../types';

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

let youtubeIframeApiPromise: Promise<void> | null = null;

const loadYouTubeIframeApi = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if ((window as any).YT?.Player) {
    return Promise.resolve();
  }

  if (youtubeIframeApiPromise) {
    return youtubeIframeApiPromise;
  }

  youtubeIframeApiPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-edumaster-youtube-api="true"]');
    if (existing) {
      const previous = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve();
      };
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.dataset.edumasterYoutubeApi = 'true';

    const previous = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };

    document.body.appendChild(script);
  });

  return youtubeIframeApiPromise;
};

const getYouTubeVideoIdFromEmbedUrl = (embedUrl?: string | null) => {
  if (!embedUrl) {
    return null;
  }

  try {
    const url = new URL(embedUrl);
    const candidate = url.pathname.split('/').filter(Boolean).pop();
    return candidate || null;
  } catch {
    return null;
  }
};

const buildSequentialAccessMap = (
  course: CourseCard | null,
  lessonProgressMap: Map<string, ResumeRecord>,
  hasCourseAccess: boolean,
) => {
  const accessMap = new Map<string, { unlocked: boolean; reason: string | null }>();
  const lessonEntries = getModuleLessonEntries(course);

  lessonEntries.forEach((entry, index) => {
    if (!hasCourseAccess) {
      accessMap.set(entry.lesson.id, {
        unlocked: false,
        reason: 'Enroll in this course to access the lesson player.',
      });
      return;
    }

    if (index === 0) {
      accessMap.set(entry.lesson.id, { unlocked: true, reason: null });
      return;
    }

    const currentProgress = lessonProgressMap.get(entry.lesson.id);
    if (currentProgress?.completed) {
      accessMap.set(entry.lesson.id, { unlocked: true, reason: null });
      return;
    }

    const previousLessonId = lessonEntries[index - 1]?.lesson.id;
    const previousProgress = previousLessonId ? lessonProgressMap.get(previousLessonId) : null;
    const previousUnlocked = Boolean(previousProgress?.completed || Number(previousProgress?.progressPercent || 0) >= 90);
    accessMap.set(entry.lesson.id, {
      unlocked: previousUnlocked,
      reason: previousUnlocked ? null : 'Finish the previous topic to unlock this lesson.',
    });
  });

  return accessMap;
};

const ProtectedYouTubePlayer = ({
  embedUrl,
  lessonId,
  title,
  playbackSpeed,
  resumeSeconds,
  onProgress,
}: {
  embedUrl: string;
  lessonId: string;
  title: string;
  playbackSpeed: number;
  resumeSeconds: number;
  onProgress: (progressSeconds: number, durationSeconds: number, completed: boolean) => void;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    const videoId = getYouTubeVideoIdFromEmbedUrl(embedUrl);
    if (!containerRef.current || !videoId) {
      return;
    }

    let cancelled = false;

    const clearProgressInterval = () => {
      if (progressIntervalRef.current !== null) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };

    const startProgressInterval = () => {
      clearProgressInterval();
      progressIntervalRef.current = window.setInterval(() => {
        const player = playerRef.current;
        if (!player?.getCurrentTime || !player?.getDuration) {
          return;
        }

        const progressSeconds = Number(player.getCurrentTime() || 0);
        const durationSeconds = Number(player.getDuration() || 0);
        onProgressRef.current(progressSeconds, durationSeconds, false);
      }, 10000);
    };

    void loadYouTubeIframeApi().then(() => {
      if (cancelled || !containerRef.current) {
        return;
      }

      playerRef.current = new (window as any).YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          controls: 1,
          cc_load_policy: 1,
          start: Math.max(Math.floor(resumeSeconds || 0), 0),
        },
        events: {
          onReady: (event: any) => {
            try {
              if (resumeSeconds > 0) {
                event.target.seekTo(resumeSeconds, true);
              }
              event.target.setPlaybackRate(playbackSpeed);
            } catch {
              // Ignore player readiness race conditions.
            }
          },
          onStateChange: (event: any) => {
            const player = event.target;
            const playerState = (window as any).YT?.PlayerState;

            if (event.data === playerState?.PLAYING) {
              startProgressInterval();
              return;
            }

            if (event.data === playerState?.PAUSED) {
              clearProgressInterval();
              onProgressRef.current(Number(player.getCurrentTime?.() || 0), Number(player.getDuration?.() || 0), false);
              return;
            }

            if (event.data === playerState?.ENDED) {
              clearProgressInterval();
              onProgressRef.current(Number(player.getDuration?.() || 0), Number(player.getDuration?.() || 0), true);
              return;
            }

            if (event.data === playerState?.BUFFERING) {
              return;
            }

            clearProgressInterval();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      clearProgressInterval();

      const player = playerRef.current;
      if (player?.getCurrentTime && player?.getDuration) {
        onProgressRef.current(Number(player.getCurrentTime() || 0), Number(player.getDuration() || 0), false);
      }

      try {
        player?.destroy?.();
      } catch {
        // Ignore destroy errors during fast navigation.
      }
      playerRef.current = null;
    };
  }, [embedUrl, lessonId, resumeSeconds]);

  useEffect(() => {
    try {
      playerRef.current?.setPlaybackRate?.(playbackSpeed);
    } catch {
      // Ignore unsupported playback rate updates.
    }
  }, [playbackSpeed]);

  return (
    <div className="relative aspect-video w-full bg-black">
      <div ref={containerRef} className="h-full w-full" aria-label={title} />
    </div>
  );
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

const getLiveRecordingGroups = (course: CourseCard | null, liveClasses: LiveClass[]) => {
  if (!course) {
    return [];
  }

  const grouped = new Map<string, {
    key: string;
    moduleId: string | null;
    moduleTitle: string;
    chapterId: string | null;
    chapterTitle: string | null;
    recordings: LiveClass[];
  }>();

  liveClasses
    .filter((liveClass) => {
      const status = String(liveClass.status || '').toLowerCase();
      return liveClass.courseId === course._id
        && ['ended', 'replay'].includes(status || 'ended');
    })
    .forEach((liveClass) => {
      const key = `${liveClass.moduleId || 'course'}::${liveClass.chapterId || 'root'}`;
      const group = grouped.get(key) || {
        key,
        moduleId: liveClass.moduleId || null,
        moduleTitle: liveClass.moduleTitle || course.subject || 'Course recordings',
        chapterId: liveClass.chapterId || null,
        chapterTitle: liveClass.chapterTitle || null,
        recordings: [],
      };
      group.recordings.push(liveClass);
      grouped.set(key, group);
    });

  return Array.from(grouped.values()).sort((left, right) => left.moduleTitle.localeCompare(right.moduleTitle));
};

const formatSessionDateTime = (value?: string | null) => {
  if (!value) {
    return 'Schedule pending';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
};

const getLiveClassState = (liveClass: LiveClass) => String(liveClass.status || liveClass.mode || '').toLowerCase();

const getLiveClassLabel = (liveClass: LiveClass) => {
  const state = getLiveClassState(liveClass);

  if (state === 'live') {
    return 'Live now';
  }

  if (state === 'scheduled') {
    return 'Upcoming';
  }

  if (liveClass.replayReady) {
    return 'Recording ready';
  }

  return 'Recording';
};

const getLiveClassChipClasses = (liveClass: LiveClass) => {
  const state = getLiveClassState(liveClass);

  if (state === 'live') {
    return 'bg-[#fde8e8] text-[#d94141]';
  }

  if (state === 'scheduled') {
    return 'bg-[#f4f7fb] text-[#607089]';
  }

  return 'bg-[#eef7ff] text-[#2484d8]';
};

const getLiveClassContextLabel = (liveClass: LiveClass, fallback: string) =>
  [liveClass.moduleTitle, liveClass.chapterTitle].filter(Boolean).join(' • ')
  || liveClass.topicTags?.[0]
  || fallback;

const getStandaloneModuleLessonEntries = (module: CourseCard['modules'][number] | null) =>
  module
    ? [
      ...(module.lessons || []).map((lesson) => ({
        lesson,
        chapterTitle: null as string | null,
      })),
      ...((module.chapters || []).flatMap((chapter) =>
        (chapter.lessons || []).map((lesson) => ({
          lesson,
          chapterTitle: chapter.title,
        })))),
    ]
    : [];

const getModuleProgressSnapshot = (
  module: CourseCard['modules'][number] | null,
  lessonProgressMap: Map<string, ResumeRecord>,
) => {
  const entries = getStandaloneModuleLessonEntries(module);
  const totalLessons = entries.length;
  const completedLessons = entries.filter((entry) => lessonProgressMap.get(entry.lesson.id)?.completed).length;
  const progressPercent = totalLessons === 0
    ? 0
    : Math.round(entries.reduce((sum, entry) => sum + Number(lessonProgressMap.get(entry.lesson.id)?.progressPercent || 0), 0) / totalLessons);

  return {
    totalLessons,
    completedLessons,
    progressPercent,
  };
};

const findLessonLocation = (course: CourseCard | null, lessonId: string | null) => {
  if (!course || !lessonId) {
    return null;
  }

  for (const module of course.modules || []) {
    const directLesson = (module.lessons || []).find((lesson) => lesson.id === lessonId);
    if (directLesson) {
      return {
        module,
        chapter: null,
        lesson: directLesson,
      };
    }

    for (const chapter of module.chapters || []) {
      const chapterLesson = (chapter.lessons || []).find((lesson) => lesson.id === lessonId);
      if (chapterLesson) {
        return {
          module,
          chapter,
          lesson: chapterLesson,
        };
      }
    }
  }

  return null;
};

const CourseLessonItem = ({
  lesson,
  selected,
  isSaved,
  isCompleted,
  isLastWatched,
  lessonProgressPercent,
  lessonAccessReason,
  lessonSequentiallyUnlocked,
  onSelect,
  onSave,
}: {
  lesson: CourseLesson;
  selected: boolean;
  isSaved: boolean;
  isCompleted: boolean;
  isLastWatched: boolean;
  lessonProgressPercent: number;
  lessonAccessReason: string | null;
  lessonSequentiallyUnlocked: boolean;
  onSelect: () => void;
  onSave: () => void;
}) => {
  const actionLabel = lesson.locked
    ? 'Locked'
    : ['youtube', 'private-video'].includes(lesson.type) && !lessonSequentiallyUnlocked
      ? 'Unlock next'
      : isCompleted
        ? 'Rewatch'
        : 'Open';

  const lessonKindLabel = ['youtube', 'private-video', 'video'].includes(lesson.type) ? 'Video' : 'Practice';
  const isSelectable = !lesson.locked || lessonSequentiallyUnlocked;

  return (
    <div className={cn(
      'rounded-[20px] border px-4 py-4 transition',
      selected
        ? 'border-[#8ec5ff] bg-[#edf5ff] shadow-[0_10px_28px_rgba(58,112,173,0.12)]'
        : 'border-[#e4ebf3] bg-white hover:border-[#bfd0e2]',
    )}>
      <div className="flex items-start gap-3">
        <button
          onClick={onSelect}
          className={cn(
            'flex min-w-0 flex-1 items-start gap-3 text-left',
            !isSelectable && 'opacity-90',
          )}
        >
          <div className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] text-xs font-semibold text-white',
            lessonKindLabel === 'Video'
              ? 'bg-[linear-gradient(135deg,#ff8b8b,#e85d75)]'
              : 'bg-[linear-gradient(135deg,#7cb9ff,#5b7cff)]',
          )}>
            {lessonKindLabel}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {['youtube', 'private-video'].includes(lesson.type) ? <PlayCircle className="h-4 w-4 text-[#4b76b3]" /> : lesson.premium ? <Lock className="h-4 w-4 text-[#4b76b3]" /> : <BookOpen className="h-4 w-4 text-[#4b76b3]" />}
              <p className="line-clamp-2 text-[1rem] font-semibold leading-6 text-[#172033]">{lesson.title}</p>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#6e7e95]">
              <span>{lesson.durationMinutes} mins</span>
              <span className="text-[#bcc8d5]">•</span>
              <span>{actionLabel}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#dfe9f3]">
                <div
                  className={cn('h-full rounded-full', isCompleted ? 'bg-[var(--success)]' : 'bg-[#2d8cff]')}
                  style={{ width: `${Math.min(Math.max(lessonProgressPercent, 0), 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6e7e95]">{lessonProgressPercent}%</span>
            </div>
          </div>
        </button>
        <button
          onClick={onSave}
          className="shrink-0 rounded-full border border-[#d1dce8] bg-white px-3 py-2 text-xs font-semibold text-[#172033] transition hover:border-[#4b76b3]"
        >
          {isSaved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {isCompleted && <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0f8a43]">Completed</span>}
        {!isCompleted && isLastWatched && <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#172033]">Resume</span>}
        {!lessonSequentiallyUnlocked && lessonAccessReason && !lesson.locked && (
          <span className="rounded-full bg-[#fff0ea] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-rust)]">
            Locked next
          </span>
        )}
      </div>

      {!lessonSequentiallyUnlocked && lessonAccessReason && !lesson.locked && (
        <p className="mt-3 text-xs leading-5 text-[var(--accent-rust)]">{lessonAccessReason}</p>
      )}
    </div>
  );
};

const PlayerRailLessonItem = ({
  lesson,
  chapterTitle,
  selected,
  completed,
  order,
  onSelect,
}: {
  lesson: CourseLesson;
  chapterTitle?: string | null;
  selected: boolean;
  completed: boolean;
  order: number;
  onSelect: () => void;
}) => (
  <button
    onClick={onSelect}
    className={cn(
      'w-full border-b border-[#eef2f7] px-4 py-4 text-left transition',
      selected ? 'bg-[#edf5ff]' : 'bg-white hover:bg-[#f8fbff]',
    )}
  >
    <div className="flex items-start gap-3">
      <div className={cn(
        'mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        completed ? 'bg-[#22c55e] text-white' : selected ? 'bg-[#22c7f2] text-white' : 'bg-[#f3f6fb] text-[#607089]',
      )}>
        {order}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-base font-semibold leading-6 text-[#172033]">{lesson.title}</p>
        <p className="mt-1 text-sm text-[#7b8ba2]">{lesson.durationMinutes} mins</p>
        {chapterTitle && <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-[#9aa9bb]">{chapterTitle}</p>}
      </div>
    </div>
  </button>
);

export const CoursesTab = ({
  overview,
  onRefresh,
  initialCourseId,
  initialLessonId,
  onResumeNavigationHandled,
  savedTopicIds,
  onToggleSavedTopic,
}: {
  overview: PlatformOverview;
  onRefresh: () => Promise<void>;
  initialCourseId?: string | null;
  initialLessonId?: string | null;
  onResumeNavigationHandled?: () => void;
  savedTopicIds: string[];
  onToggleSavedTopic: (courseId: string, lessonId: string) => void;
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
  const [courseWorkspaceTab, setCourseWorkspaceTab] = useState<'dashboard' | 'subjects' | 'player'>(initialLessonId ? 'player' : 'dashboard');
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const [lessonDoubt, setLessonDoubt] = useState('');
  const [lessonDoubtAnswer, setLessonDoubtAnswer] = useState<string | null>(null);
  const [askingLessonDoubt, setAskingLessonDoubt] = useState(false);
  const [protectedLessonPlayback, setProtectedLessonPlayback] = useState<ProtectedLessonPlayback | null>(null);
  const [loadingProtectedLesson, setLoadingProtectedLesson] = useState(false);
  const [protectedLessonError, setProtectedLessonError] = useState<string | null>(null);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [selectedRecordingAccess, setSelectedRecordingAccess] = useState<LiveClassAccess | null>(null);
  const [loadingRecordingAccess, setLoadingRecordingAccess] = useState(false);
  const [recordingAccessError, setRecordingAccessError] = useState<string | null>(null);
  const [securityBlocked, setSecurityBlocked] = useState(false);
  const [studySidebarTab, setStudySidebarTab] = useState<'notes' | 'assistant' | 'replays'>('notes');
  const [showReplayPlayer, setShowReplayPlayer] = useState(false);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerViewportRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
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
  const selectedModule = useMemo(
    () => selectedCourse?.modules.find((module) => module.id === selectedModuleId) || selectedCourse?.modules[0] || null,
    [selectedCourse, selectedModuleId],
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
  const selectedCourseRecordingGroups = useMemo(
    () => getLiveRecordingGroups(selectedCourse, overview.liveClasses || []),
    [selectedCourse, overview.liveClasses],
  );
  const selectedCourseRecordings = useMemo(
    () => selectedCourseRecordingGroups.flatMap((group) => group.recordings),
    [selectedCourseRecordingGroups],
  );
  const selectedCourseLiveSessions = useMemo(
    () => (overview.liveClasses || []).filter((liveClass) =>
      liveClass.courseId === selectedCourse?._id && getLiveClassState(liveClass) === 'live'),
    [overview.liveClasses, selectedCourse?._id],
  );
  const selectedCourseUpcomingSessions = useMemo(
    () => (overview.liveClasses || []).filter((liveClass) =>
      liveClass.courseId === selectedCourse?._id && getLiveClassState(liveClass) === 'scheduled'),
    [overview.liveClasses, selectedCourse?._id],
  );
  const selectedCourseSessions = useMemo(
    () => [...selectedCourseLiveSessions, ...selectedCourseUpcomingSessions, ...selectedCourseRecordings],
    [selectedCourseLiveSessions, selectedCourseUpcomingSessions, selectedCourseRecordings],
  );
  const selectedCourseSession = useMemo(
    () => selectedCourseSessions.find((item) => item._id === selectedRecordingId) || selectedCourseSessions[0] || null,
    [selectedCourseSessions, selectedRecordingId],
  );
  const selectedModuleEntries = useMemo(
    () => getStandaloneModuleLessonEntries(selectedModule),
    [selectedModule],
  );

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
      setCourseWorkspaceTab('player');
      setStudySidebarTab('notes');
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

  useEffect(() => {
    if (!selectedCourse) {
      setSelectedModuleId(null);
      return;
    }

    const lessonLocation = findLessonLocation(selectedCourse, selectedLessonId);
    setSelectedModuleId((currentModuleId) => {
      if (currentModuleId && selectedCourse.modules.some((module) => module.id === currentModuleId)) {
        return currentModuleId;
      }

      return lessonLocation?.module.id || selectedCourse.modules[0]?.id || null;
    });
  }, [selectedCourse, selectedLessonId]);

  useEffect(() => {
    if (selectedCourseSessions.length === 0) {
      setSelectedRecordingId(null);
      setSelectedRecordingAccess(null);
      setRecordingAccessError(null);
      setLoadingRecordingAccess(false);
      return;
    }

    if (!selectedRecordingId || !selectedCourseSessions.some((item) => item._id === selectedRecordingId)) {
      setSelectedRecordingId(selectedCourseSessions[0]._id);
    }
  }, [selectedCourseSessions, selectedRecordingId]);

  useEffect(() => {
    setShowReplayPlayer(false);
  }, [selectedRecordingId, studySidebarTab, selectedCourse?._id, selectedLessonId]);

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
  const lessonEntries = useMemo(
    () => getModuleLessonEntries(selectedCourse),
    [selectedCourse],
  );
  const selectedLessonIndex = useMemo(
    () => lessonEntries.findIndex((entry) => entry.lesson.id === selectedLesson?.id),
    [lessonEntries, selectedLesson?.id],
  );
  const previousLessonEntry = selectedLessonIndex > 0 ? lessonEntries[selectedLessonIndex - 1] : null;
  const nextLessonEntry = selectedLessonIndex >= 0 && selectedLessonIndex < lessonEntries.length - 1
    ? lessonEntries[selectedLessonIndex + 1]
    : null;
  const hasCourseAccess = Boolean(user && (user.role === 'admin' || selectedCourse?.enrolled));
  const hostedVideoUrl = selectedLesson?.type === 'video' ? selectedLesson.videoUrl || null : null;
  const privateVideoStreamUrl = selectedLesson?.type === 'private-video' ? protectedLessonPlayback?.streamUrl || null : null;
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
  const sequentialAccessMap = useMemo(
    () => buildSequentialAccessMap(selectedCourse, lessonProgressMap, hasCourseAccess),
    [selectedCourse, lessonProgressMap, hasCourseAccess],
  );
  const selectedLessonAccess = selectedLesson ? sequentialAccessMap.get(selectedLesson.id) : null;
  const canAccessLesson = Boolean(
    selectedLesson
      && hasCourseAccess
      && !selectedLesson.locked
      && (!['youtube', 'private-video'].includes(selectedLesson.type) || selectedLessonAccess?.unlocked),
  );
  const selectedCourseSnapshot = useMemo(
    () => selectedCourse ? getCourseProgressSnapshot(selectedCourse, lessonProgressOverrides) : { totalLessons: 0, completedLessons: 0, progressPercent: 0 },
    [selectedCourse, lessonProgressOverrides],
  );
  const selectedModuleSnapshot = useMemo(
    () => getModuleProgressSnapshot(selectedModule, lessonProgressMap),
    [selectedModule, lessonProgressMap],
  );
  const savedTopicSet = useMemo(() => new Set(savedTopicIds), [savedTopicIds]);
  const selectedLessonSaved = Boolean(selectedCourse && selectedLesson && savedTopicSet.has(`${selectedCourse._id}:${selectedLesson.id}`));
  const selectedCourseSavedCount = useMemo(
    () => selectedCourse ? savedTopicIds.filter((entry) => entry.startsWith(`${selectedCourse._id}:`)).length : 0,
    [savedTopicIds, selectedCourse],
  );
  const selectedCourseSessionState = selectedCourseSession ? getLiveClassState(selectedCourseSession) : null;
  const immersiveCourseView = Boolean(selectedCourse && courseWorkspaceTab === 'player');
  const firstAccessibleLessonEntry = useMemo(
    () => lessonEntries.find((entry) => {
      if (!hasCourseAccess || entry.lesson.locked) {
        return false;
      }

      if (!['youtube', 'private-video'].includes(entry.lesson.type)) {
        return true;
      }

      return Boolean(sequentialAccessMap.get(entry.lesson.id)?.unlocked);
    }) || null,
    [lessonEntries, hasCourseAccess, sequentialAccessMap],
  );
  const suggestedLessonEntries = useMemo(() => {
    const incompleteEntries = lessonEntries.filter((entry) => !lessonProgressMap.get(entry.lesson.id)?.completed);
    return (incompleteEntries.length ? incompleteEntries : lessonEntries).slice(0, 4);
  }, [lessonEntries, lessonProgressMap]);
  const continueLessonEntry = useMemo(() => {
    if (!selectedCourse) {
      return null;
    }

    return lessonEntries.find((entry) => entry.lesson.id === selectedCourse.continueLesson?.id)
      || suggestedLessonEntries[0]
      || lessonEntries[0]
      || null;
  }, [lessonEntries, selectedCourse, suggestedLessonEntries]);

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
    if (!selectedLesson || !['youtube', 'private-video'].includes(selectedLesson.type) || !selectedCourse?._id) {
      setProtectedLessonPlayback(null);
      setProtectedLessonError(null);
      setLoadingProtectedLesson(false);
      return;
    }

    if (!canAccessLesson) {
      setProtectedLessonPlayback(null);
      setProtectedLessonError(selectedLessonAccess?.reason || 'Course access is required to watch this lesson.');
      setLoadingProtectedLesson(false);
      return;
    }

    let cancelled = false;
    setLoadingProtectedLesson(true);
    setProtectedLessonError(null);
    setProtectedLessonPlayback(null);

    void EduService.getProtectedLessonPlayback(selectedCourse._id, selectedLesson.id)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setProtectedLessonPlayback(payload);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setProtectedLessonError(error instanceof Error ? error.message : 'Unable to prepare protected playback.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProtectedLesson(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCourse?._id, selectedLesson?.id, selectedLesson?.type, selectedLessonAccess?.reason, canAccessLesson]);

  useEffect(() => {
    if (studySidebarTab !== 'replays' || !selectedRecordingId || !user) {
      setSelectedRecordingAccess(null);
      setRecordingAccessError(null);
      setLoadingRecordingAccess(false);
      return;
    }

    let cancelled = false;
    setLoadingRecordingAccess(true);
    setRecordingAccessError(null);
    setSelectedRecordingAccess(null);

    void EduService.getLiveClassAccess(selectedRecordingId)
      .then((payload) => {
        if (!cancelled) {
          setSelectedRecordingAccess(payload);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRecordingAccessError(error instanceof Error ? error.message : 'Unable to prepare recording playback.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingRecordingAccess(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRecordingId, studySidebarTab, user]);

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
  }, [playbackSpeed, hostedVideoUrl, privateVideoStreamUrl]);

  useEffect(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const currentVideo = videoRef.current;
    if (!currentVideo || !privateVideoStreamUrl || protectedLessonPlayback?.streamFormat !== 'hls') {
      return;
    }

    if (currentVideo.canPlayType('application/vnd.apple.mpegurl')) {
      currentVideo.src = privateVideoStreamUrl;
      return;
    }

    if (!Hls.isSupported()) {
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      maxBufferLength: 30,
      backBufferLength: 30,
    });
    hlsRef.current = hls;
    hls.loadSource(privateVideoStreamUrl);
    hls.attachMedia(currentVideo);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [privateVideoStreamUrl, protectedLessonPlayback?.streamFormat, selectedLesson?.id]);

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

  useEffect(() => {
    if (!selectedLesson || !canAccessLesson) {
      setSecurityBlocked(false);
      return;
    }

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const blockedShortcut = event.key === 'F12'
        || (event.ctrlKey && event.shiftKey && ['I', 'J', 'C'].includes(event.key.toUpperCase()));

      if (blockedShortcut) {
        event.preventDefault();
        setSecurityBlocked(true);
      }
    };

    const inspectDevTools = () => {
      const widthGap = Math.abs(window.outerWidth - window.innerWidth);
      const heightGap = Math.abs(window.outerHeight - window.innerHeight);
      setSecurityBlocked(widthGap > 160 || heightGap > 160);
    };

    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    inspectDevTools();
    const intervalId = window.setInterval(inspectDevTools, 1500);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.clearInterval(intervalId);
    };
  }, [selectedLesson?.id, canAccessLesson]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsPlayerFullscreen(document.fullscreenElement === playerViewportRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleSelectCourse = (courseId: string) => {
    void flushTrackedPlayback();
    setSelectedCourseId(courseId);
    setCourseWorkspaceTab('dashboard');
    setStudySidebarTab('notes');
    setShowReplayPlayer(false);
  };

  const handleSelectLesson = (lessonId: string) => {
    void flushTrackedPlayback();
    setSelectedLessonId(lessonId);
    setCourseWorkspaceTab('player');
    setStudySidebarTab('notes');
    setShowReplayPlayer(false);
    const lessonLocation = findLessonLocation(selectedCourse, lessonId);
    if (lessonLocation) {
      setSelectedModuleId(lessonLocation.module.id);
    }
  };

  const togglePlayerFullscreen = async () => {
    const playerViewport = playerViewportRef.current;
    if (!playerViewport) {
      return;
    }

    if (document.fullscreenElement === playerViewport) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }

    await playerViewport.requestFullscreen?.().catch(() => undefined);
  };

  const markLessonComplete = async () => {
    if (!selectedCourse || !selectedLesson) {
      return;
    }

    await persistLessonProgress(
      selectedCourse._id,
      true,
      selectedLesson,
      Math.max(
        Math.round((selectedLesson.durationMinutes || 0) * 60),
        protectedLessonPlayback?.resumeSeconds || 0,
        selectedLessonProgress?.progressSeconds || 0,
      ),
      true,
      true,
      Math.round((selectedLesson.durationMinutes || 0) * 60),
    );
    await onRefresh();
  };

  const askLessonDoubt = async () => {
    if (!selectedCourse || !selectedLesson || !lessonDoubt.trim()) {
      return;
    }

    setAskingLessonDoubt(true);
    try {
      const response = await EduService.askAi(
        `Student doubt for ${selectedCourse.title} > ${selectedLesson.title}: ${lessonDoubt.trim()}`,
      );
      setLessonDoubtAnswer(response.answer);
    } finally {
      setAskingLessonDoubt(false);
    }
  };

  useEffect(() => {
    setLessonDoubt('');
    setLessonDoubtAnswer(null);
  }, [selectedCourse?._id, selectedLesson?.id]);

  return (
    <div className="space-y-5">
      <section className={cn(
        'overflow-hidden rounded-[34px] border border-[var(--line)] bg-white shadow-[0_22px_70px_rgba(15,23,42,0.07)]',
        immersiveCourseView
          ? 'p-4'
          : 'bg-[radial-gradient(circle_at_top_right,rgba(201,106,43,0.18),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(22,32,51,0.08),transparent_22%),linear-gradient(180deg,#fffaf2_0%,#fffdf8_100%)] p-6',
      )}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <SectionHeader
            title={immersiveCourseView ? 'Course Switcher' : courseView === 'my' ? 'Study room' : 'Course catalog'}
            caption={immersiveCourseView ? 'Change course without losing your place' : 'Choose course → open topic → study without confusion'}
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCourseView('my')}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                courseView === 'my' ? 'bg-[var(--card-dark)] text-white' : 'bg-[var(--accent-cream)] text-[var(--ink-soft)]',
              )}
            >
              My courses
            </button>
            <button
              onClick={() => setCourseView('catalog')}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-semibold transition',
                courseView === 'catalog' ? 'bg-[var(--card-dark)] text-white' : 'bg-[var(--accent-cream)] text-[var(--ink-soft)]',
              )}
            >
              Explore catalog
            </button>
          </div>
        </div>

        <div className={cn('grid gap-3', immersiveCourseView ? 'mt-4 lg:grid-cols-[minmax(0,1.5fr)_200px_200px]' : 'mt-5 lg:grid-cols-[minmax(0,1.5fr)_220px_220px]')}>
          <input
            value={courseQuery}
            onChange={(event) => setCourseQuery(event.target.value)}
            placeholder="Search courses, exams, subjects, or instructors"
            className="rounded-[22px] border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none transition focus:border-[var(--accent-rust)]"
          />
          <select
            value={accessFilter}
            onChange={(event) => setAccessFilter(event.target.value as typeof accessFilter)}
            className="rounded-[22px] border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
          >
            <option value="all">All access types</option>
            <option value="unlocked">Unlocked</option>
            <option value="premium">Premium</option>
            <option value="free">Free</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-[22px] border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)] outline-none"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category === 'all' ? 'All categories' : category}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-[var(--ink-soft)]">
          <span className="rounded-full bg-white px-4 py-2">{filteredCourses.length} course{filteredCourses.length === 1 ? '' : 's'} visible</span>
          <span className="rounded-full bg-white px-4 py-2">{filteredCourses.filter((course) => course.enrolled).length} unlocked</span>
          <span className="rounded-full bg-white px-4 py-2">{filteredCourses.reduce((sum, course) => sum + (course.lessonCount || 0), 0)} total topics</span>
        </div>

        {filteredCourses.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-[var(--line)] bg-white/70 p-6 text-center text-[var(--ink-soft)]">
            {courseView === 'my'
              ? 'You have not unlocked any courses yet. Switch to Explore catalog to browse available courses.'
              : 'No courses match your current search and filters. Try a different keyword or category.'}
          </div>
        ) : (
          immersiveCourseView ? (
            <div className="mt-4 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-3">
                {filteredCourses.map((course) => (
                  <button
                    key={course._id}
                    onClick={() => handleSelectCourse(course._id)}
                    className={cn(
                      'flex w-[280px] shrink-0 items-center gap-3 rounded-[24px] border px-4 py-4 text-left transition sm:w-[320px]',
                      selectedCourse?._id === course._id
                        ? 'border-[var(--accent-rust)] bg-[var(--accent-cream)] text-[var(--ink)]'
                        : 'border-[var(--line)] bg-white text-[var(--ink-soft)] hover:border-[var(--accent-rust)]/40',
                    )}
                  >
                    <img src={course.thumbnailUrl} alt={course.title} className="h-12 w-12 shrink-0 rounded-[16px] object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-5">{course.title}</p>
                      <p className="mt-1 truncate text-xs">{course.subject}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto pb-2">
              <div className="flex min-w-max gap-4">
                {filteredCourses.map((course) => (
                  <button
                    key={course._id}
                    onClick={() => handleSelectCourse(course._id)}
                    className={cn(
                      'w-[300px] rounded-[26px] border p-4 text-left transition',
                      selectedCourse?._id === course._id
                        ? 'border-[var(--accent-rust)] bg-[var(--accent-cream)] shadow-[0_16px_30px_rgba(201,106,43,0.12)]'
                        : 'border-[var(--line)] bg-white hover:border-[var(--accent-rust)]/35',
                    )}
                  >
                    <div className="flex gap-4">
                      <img src={course.thumbnailUrl} alt={course.title} className="h-20 w-20 shrink-0 rounded-[20px] object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ink-soft)]">{course.category}</p>
                          <span className={cn(
                            'rounded-full px-3 py-1 text-xs font-semibold',
                            course.enrolled
                              ? 'bg-[var(--success-soft)] text-[var(--success)]'
                              : course.price === 0
                                ? 'bg-[#f3f0ff] text-[#5c45a5]'
                                : 'bg-[#fff3eb] text-[var(--accent-rust)]',
                          )}>
                            {course.enrolled ? 'Unlocked' : course.price === 0 ? 'Free' : 'Premium'}
                          </span>
                        </div>
                        <h3 className="mt-2 line-clamp-2 text-lg font-semibold text-[var(--ink)]">{course.title}</h3>
                        <p className="mt-2 text-sm text-[var(--ink-soft)]">{course.subject}</p>
                        <p className="mt-3 text-xs font-medium text-[var(--ink-soft)]/80">{course.lessonCount || 0} topics • {course.instructor}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        )}
      </section>

      {selectedCourse ? (
        <section className="overflow-hidden rounded-[34px] border border-[var(--line)] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.07)]">
          <div className={cn(
            'text-white',
            immersiveCourseView
              ? 'bg-[linear-gradient(135deg,#1f2937_0%,#162033_100%)] px-5 py-5'
              : 'bg-[radial-gradient(circle_at_top_right,rgba(201,106,43,0.34),transparent_24%),linear-gradient(135deg,#1f2937_0%,#162033_100%)] px-6 py-7',
          )}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/75">Course Hub</p>
                <h2 className={cn('font-semibold', immersiveCourseView ? 'mt-2 text-2xl' : 'mt-3 text-3xl')}>{selectedCourse.title}</h2>
                <p className="mt-2 text-sm text-white/80">{selectedCourse.subject} • {selectedCourse.instructor} • {selectedCourse.validityDays} day access</p>
                <div className={cn('h-2 w-full max-w-[420px] overflow-hidden rounded-full bg-white/15', immersiveCourseView ? 'mt-4' : 'mt-5')}>
                  <div className="h-full rounded-full bg-[#72ff9b]" style={{ width: `${selectedCourseSnapshot.progressPercent}%` }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-white/85">
                  <span>Your progress {selectedCourseSnapshot.progressPercent}%</span>
                  <span>•</span>
                  <span>{selectedCourseSnapshot.completedLessons}/{selectedCourseSnapshot.totalLessons} topics completed</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {selectedCourse.enrolled ? (
                  <span className="rounded-full bg-white/12 px-4 py-3 text-sm font-semibold text-white">Access active</span>
                ) : (
                  <button
                    onClick={() => handleUnlock(selectedCourse)}
                    disabled={busyCourseId === selectedCourse._id}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 font-semibold text-[#2638d8] transition hover:bg-white/90 disabled:opacity-60"
                  >
                    {busyCourseId === selectedCourse._id ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                    {selectedCourse.price === 0 ? 'Start free course' : `Unlock ${currency.format(selectedCourse.price)}`}
                  </button>
                )}
                {selectedCourse.officialChannelUrl && (
                  <a
                    href={selectedCourse.officialChannelUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/25 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Official channel
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="border-b border-[var(--line)] bg-white px-6">
            <div className="flex flex-wrap gap-8">
              {[
                { key: 'dashboard', label: 'Dashboard' },
                { key: 'subjects', label: 'Subject View' },
                { key: 'player', label: 'Lesson Player' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setCourseWorkspaceTab(tab.key as typeof courseWorkspaceTab)}
                  className={cn(
                    'border-b-2 px-2 py-4 text-sm font-semibold transition',
                    courseWorkspaceTab === tab.key
                      ? 'border-[var(--accent-rust)] text-[var(--accent-rust)]'
                      : 'border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {courseWorkspaceTab === 'dashboard' ? (
            <div className="grid gap-6 bg-[var(--accent-cream)]/35 p-6 xl:grid-cols-[minmax(0,1.3fr)_320px]">
              <div className="space-y-6">
                <section className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Suggested Activity</p>
                      <h3 className="mt-3 text-2xl font-semibold text-[var(--ink)]">{continueLessonEntry?.lesson.title || 'Start your first topic'}</h3>
                      <p className="mt-2 text-sm text-[var(--ink-soft)]">
                        {continueLessonEntry
                          ? [continueLessonEntry.moduleTitle, continueLessonEntry.chapterTitle, `${continueLessonEntry.lesson.durationMinutes} mins`].filter(Boolean).join(' • ')
                          : 'Open a topic to start learning.'}
                      </p>
                    </div>
                    <button
                      onClick={() => continueLessonEntry && handleSelectLesson(continueLessonEntry.lesson.id)}
                      disabled={!continueLessonEntry}
                      className="rounded-[16px] bg-[var(--accent-rust)] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(201,106,43,0.22)] disabled:opacity-50"
                    >
                      {selectedCourse.continueLesson ? 'Continue learning' : 'Start lesson'}
                    </button>
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Your Subjects</p>
                      <h3 className="mt-2 text-3xl font-semibold text-[var(--ink)]">Course modules</h3>
                    </div>
                    <button
                      onClick={() => setCourseWorkspaceTab('subjects')}
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-rust)]"
                    >
                      View all
                    </button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {selectedCourse.modules.map((module) => {
                      const snapshot = getModuleProgressSnapshot(module, lessonProgressMap);
                      const nextEntry = getStandaloneModuleLessonEntries(module).find((entry) => !lessonProgressMap.get(entry.lesson.id)?.completed)
                        || getStandaloneModuleLessonEntries(module)[0];

                      return (
                        <div key={module.id} className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.04)]">
                          <div className="flex items-start gap-4">
                            <img src={selectedCourse.thumbnailUrl} alt={selectedCourse.title} className="h-20 w-32 rounded-[18px] object-cover" />
                            <div className="min-w-0 flex-1">
                              <p className="inline-flex rounded-full bg-[#eef6ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2484d8]">Subject module</p>
                              <h4 className="mt-3 line-clamp-2 text-2xl font-semibold leading-tight text-[var(--ink)]">{module.title}</h4>
                              <div className="mt-3 flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                                <span>{snapshot.progressPercent}%</span>
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--line)]">
                                  <div className="h-full rounded-full bg-[var(--accent-rust)]" style={{ width: `${snapshot.progressPercent}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 rounded-[20px] bg-[var(--accent-cream)] p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Suggested activity</p>
                            <p className="mt-3 text-lg font-semibold text-[var(--ink)]">{nextEntry?.lesson.title || 'No lesson available'}</p>
                            <p className="mt-1 text-sm text-[var(--ink-soft)]">{nextEntry ? `${nextEntry.lesson.durationMinutes} mins lesson` : 'Add lessons in admin to begin.'}</p>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-3">
                            <button
                              onClick={() => {
                                setSelectedModuleId(module.id);
                                setCourseWorkspaceTab('subjects');
                              }}
                              className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)]"
                            >
                              Open subject
                            </button>
                            {nextEntry && (
                              <button
                                onClick={() => handleSelectLesson(nextEntry.lesson.id)}
                                className="rounded-full bg-[var(--accent-rust)] px-4 py-2 text-sm font-semibold text-white"
                              >
                                Continue learning
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <aside className="space-y-4">
                <div className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Quick actions</p>
                  <div className="mt-4 space-y-3">
                    <button
                      onClick={() => setCourseWorkspaceTab('player')}
                      className="flex w-full items-center justify-between rounded-[18px] bg-[var(--accent-cream)] px-4 py-4 text-left"
                    >
                      <span>
                        <span className="block text-base font-semibold text-[var(--ink)]">Lesson player</span>
                        <span className="mt-1 block text-sm text-[var(--ink-soft)]">Resume the protected player experience</span>
                      </span>
                      <ChevronRight className="h-5 w-5 text-[var(--accent-rust)]" />
                    </button>
                    <button
                      onClick={() => {
                        setStudySidebarTab('assistant');
                        setCourseWorkspaceTab('player');
                      }}
                      className="flex w-full items-center justify-between rounded-[18px] bg-[var(--accent-cream)] px-4 py-4 text-left"
                    >
                      <span>
                        <span className="block text-base font-semibold text-[var(--ink)]">Doubts</span>
                        <span className="mt-1 block text-sm text-[var(--ink-soft)]">Ask the AI helper for topic clarity</span>
                      </span>
                      <MessageSquare className="h-5 w-5 text-[var(--accent-rust)]" />
                    </button>
                    <button
                      onClick={() => {
                        setStudySidebarTab('replays');
                        setCourseWorkspaceTab('player');
                      }}
                      className="flex w-full items-center justify-between rounded-[18px] bg-[var(--accent-cream)] px-4 py-4 text-left"
                    >
                      <span>
                        <span className="block text-base font-semibold text-[var(--ink)]">Sessions</span>
                        <span className="mt-1 block text-sm text-[var(--ink-soft)]">
                          {selectedCourseLiveSessions.length > 0
                            ? `${selectedCourseLiveSessions.length} live now`
                            : `${selectedCourseSessions.length} session${selectedCourseSessions.length === 1 ? '' : 's'} available`}
                        </span>
                      </span>
                      {selectedCourseLiveSessions.length > 0 ? (
                        <Radio className="h-5 w-5 text-[var(--accent-rust)]" />
                      ) : (
                        <Video className="h-5 w-5 text-[var(--accent-rust)]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.04)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Course stats</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-[18px] bg-[var(--accent-cream)] p-4">
                      <p className="text-sm text-[var(--ink-soft)]">Saved topics</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">{selectedCourseSavedCount}</p>
                    </div>
                    <div className="rounded-[18px] bg-[var(--accent-cream)] p-4">
                      <p className="text-sm text-[var(--ink-soft)]">Modules</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">{selectedCourse.modules.length}</p>
                    </div>
                    <div className="rounded-[18px] bg-[var(--accent-cream)] p-4">
                      <p className="text-sm text-[var(--ink-soft)]">Sessions</p>
                      <p className="mt-2 text-2xl font-semibold text-[var(--ink)]">{selectedCourseSessions.length}</p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          ) : courseWorkspaceTab === 'subjects' ? (
            <div className="grid gap-6 bg-[var(--accent-cream)]/35 p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
              <aside className="rounded-[26px] border border-[var(--line)] bg-white shadow-[0_18px_35px_rgba(15,23,42,0.04)]">
                <div className="border-b border-[var(--line)] px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Subjects</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--ink)]">Course curriculum</p>
                </div>
                <div className="space-y-1 p-3">
                  {selectedCourse.modules.map((module) => {
                    const snapshot = getModuleProgressSnapshot(module, lessonProgressMap);
                    return (
                      <button
                        key={module.id}
                        onClick={() => setSelectedModuleId(module.id)}
                        className={cn(
                          'w-full rounded-[18px] px-4 py-4 text-left transition',
                          selectedModule?.id === module.id ? 'bg-[var(--card-dark)] text-white' : 'bg-white hover:bg-[var(--accent-cream)]',
                        )}
                      >
                        <p className="text-base font-semibold">{module.title}</p>
                        <p className={cn('mt-1 text-sm', selectedModule?.id === module.id ? 'text-white/85' : 'text-[var(--ink-soft)]')}>
                          {snapshot.completedLessons}/{snapshot.totalLessons} lessons • {snapshot.progressPercent}% progress
                        </p>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <div className="space-y-5">
                <div className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Subject view</p>
                      <h3 className="mt-2 text-3xl font-semibold text-[var(--ink)]">{selectedModule?.title || 'Select a subject'}</h3>
                      <p className="mt-2 text-sm text-[var(--ink-soft)]">{selectedModuleSnapshot.completedLessons}/{selectedModuleSnapshot.totalLessons} lessons completed in this subject</p>
                    </div>
                    {selectedModuleEntries[0] && (
                      <button
                        onClick={() => handleSelectLesson(selectedModuleEntries[0].lesson.id)}
                        className="rounded-[16px] bg-[var(--accent-rust)] px-6 py-3 text-sm font-semibold text-white"
                      >
                        Open subject lessons
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_18px_35px_rgba(15,23,42,0.04)]">
                  {selectedModule ? (
                    <div className="space-y-4">
                      {(selectedModule.lessons || []).map((lesson) => {
                        const lessonProgress = lessonProgressMap.get(lesson.id);
                        const lessonAccess = sequentialAccessMap.get(lesson.id);
                        return (
                          <CourseLessonItem
                            key={lesson.id}
                            lesson={lesson}
                            selected={selectedLesson?.id === lesson.id}
                            isSaved={savedTopicSet.has(`${selectedCourse._id}:${lesson.id}`)}
                            isCompleted={Boolean(lessonProgress?.completed)}
                            isLastWatched={lastWatchedLessonId === lesson.id}
                            lessonProgressPercent={lessonProgress?.progressPercent || 0}
                            lessonAccessReason={lessonAccess?.reason || null}
                            lessonSequentiallyUnlocked={Boolean(lessonAccess?.unlocked)}
                            onSelect={() => handleSelectLesson(lesson.id)}
                            onSave={() => onToggleSavedTopic(selectedCourse._id, lesson.id)}
                          />
                        );
                      })}

                      {(selectedModule.chapters || []).map((chapter) => (
                        <div key={chapter.id} className="rounded-[22px] border border-[var(--line)] bg-[var(--accent-cream)] p-4">
                          <div className="mb-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">Chapter</p>
                            <p className="mt-1 text-lg font-semibold text-[var(--ink)]">{chapter.title}</p>
                          </div>
                          <div className="space-y-3">
                            {(chapter.lessons || []).map((lesson) => {
                              const lessonProgress = lessonProgressMap.get(lesson.id);
                              const lessonAccess = sequentialAccessMap.get(lesson.id);
                              return (
                                <CourseLessonItem
                                  key={lesson.id}
                                  lesson={lesson}
                                  selected={selectedLesson?.id === lesson.id}
                                  isSaved={savedTopicSet.has(`${selectedCourse._id}:${lesson.id}`)}
                                  isCompleted={Boolean(lessonProgress?.completed)}
                                  isLastWatched={lastWatchedLessonId === lesson.id}
                                  lessonProgressPercent={lessonProgress?.progressPercent || 0}
                                  lessonAccessReason={lessonAccess?.reason || null}
                                  lessonSequentiallyUnlocked={Boolean(lessonAccess?.unlocked)}
                                  onSelect={() => handleSelectLesson(lesson.id)}
                                  onSave={() => onToggleSavedTopic(selectedCourse._id, lesson.id)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--ink-soft)]">Select a subject to browse modules and lessons.</div>
                  )}
                </div>
              </div>
            </div>
          ) : selectedLesson ? (
            <div className="grid gap-0 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)_280px]">
              <aside className="border-b border-[#e7edf5] bg-white xl:border-b-0 xl:border-r">
                <div className="border-b border-[#edf2f7] px-4 py-4">
                  <button
                    onClick={() => setCourseWorkspaceTab('subjects')}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#22a8d4]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Show all course modules
                  </button>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a9ab0]">Current module</p>
                  <h3 className="mt-2 text-xl font-semibold text-[#172033]">{selectedModule?.title || selectedCourse.title}</h3>
                </div>
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto">
                  {selectedModuleEntries.map((entry, index) => (
                    <PlayerRailLessonItem
                      key={entry.lesson.id}
                      lesson={entry.lesson}
                      chapterTitle={entry.chapterTitle}
                      selected={selectedLesson.id === entry.lesson.id}
                      completed={Boolean(lessonProgressMap.get(entry.lesson.id)?.completed)}
                      order={index + 1}
                      onSelect={() => handleSelectLesson(entry.lesson.id)}
                    />
                  ))}
                </div>
              </aside>

              <main className="min-w-0 bg-[#fbfcff] p-4 md:p-5">
                <div className="rounded-[24px] border border-[#e1eaf3] bg-white">
                  <div className="flex flex-col gap-4 border-b border-[#edf2f7] px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <button
                        onClick={() => setCourseWorkspaceTab('subjects')}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-[#22a8d4]"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back to subject view
                      </button>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8a9ab0]">
                        {[selectedCourse.title, selectedLessonMeta?.moduleTitle, selectedLessonMeta?.chapterTitle].filter(Boolean).join(' • ')}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-[#f4f7fb] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#607089]">
                          {selectedLesson.durationMinutes} min
                        </span>
                        <span className="rounded-full bg-[#f4f7fb] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#607089]">
                          {selectedLesson.type}
                        </span>
                        <span className="rounded-full bg-[#f4f7fb] px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#607089]">
                          {selectedLessonProgress?.completed ? 'Completed' : `${selectedLessonProgress?.progressPercent || 0}% watched`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="rounded-full border border-[#dbe4ef] bg-[#f8fbff] px-4 py-2 text-sm text-[#172033]">
                        <span className="mr-2">Speed</span>
                        <select value={playbackSpeed} onChange={(event) => setPlaybackSpeed(Number(event.target.value))} className="bg-transparent outline-none">
                          {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                            <option key={speed} value={speed}>{speed}x</option>
                          ))}
                        </select>
                      </label>
                      <button
                        onClick={() => void togglePlayerFullscreen()}
                        className="inline-flex items-center gap-2 rounded-full border border-[#dbe4ef] bg-white px-4 py-2 text-sm font-semibold text-[#172033]"
                      >
                        {isPlayerFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        {isPlayerFullscreen ? 'Exit full screen' : 'Expand player'}
                      </button>
                    </div>
                  </div>

                  <div className="p-5">
                    <div
                      ref={playerViewportRef}
                      className={cn(
                        'overflow-hidden rounded-[20px] bg-black',
                        isPlayerFullscreen && 'flex h-screen items-center justify-center rounded-none border-0 bg-black',
                      )}
                    >
                      <div className={cn('w-full', isPlayerFullscreen && 'mx-auto max-w-[min(100vw,1600px)]')}>
                        {securityBlocked ? (
                          <div className="flex aspect-video flex-col items-center justify-center gap-4 px-6 text-center text-white">
                            <Lock className="h-10 w-10 text-[var(--accent-rust)]" />
                            <div>
                              <p className="text-lg font-semibold">Protected player paused</p>
                              <p className="mt-2 text-sm leading-7 text-white/68">Developer tools and inspection shortcuts are blocked during lesson playback. Close them to continue learning.</p>
                            </div>
                          </div>
                        ) : canAccessLesson && ['youtube', 'private-video'].includes(selectedLesson.type) && loadingProtectedLesson ? (
                          <div className="flex aspect-video items-center justify-center gap-3 text-white">
                            <LoaderCircle className="h-6 w-6 animate-spin text-white/75" />
                            <span className="text-sm text-white/75">Preparing protected lesson player...</span>
                          </div>
                        ) : canAccessLesson && selectedLesson.type === 'youtube' && protectedLessonPlayback?.embedUrl ? (
                          <ProtectedYouTubePlayer
                            embedUrl={protectedLessonPlayback.embedUrl}
                            lessonId={selectedLesson.id}
                            title={selectedLesson.title}
                            playbackSpeed={playbackSpeed}
                            resumeSeconds={protectedLessonPlayback.resumeSeconds}
                            onProgress={(progressSeconds, durationSeconds, completed) => {
                              playbackSnapshotRef.current = {
                                lesson: selectedLesson,
                                courseId: selectedCourse._id,
                                canAccess: canAccessLesson,
                                progressSeconds,
                                mediaDurationSeconds: durationSeconds,
                                completed,
                              };
                              void persistLessonProgress(selectedCourse._id, canAccessLesson, selectedLesson, progressSeconds, completed, completed, durationSeconds);
                            }}
                          />
                        ) : canAccessLesson && selectedLesson.type === 'private-video' && privateVideoStreamUrl ? (
                          <video
                            key={`${selectedLesson.id}:${privateVideoStreamUrl}`}
                            ref={videoRef}
                            src={protectedLessonPlayback?.streamFormat === 'source' ? privateVideoStreamUrl : undefined}
                            onLoadedMetadata={(event) => {
                              const resumeSeconds = protectedLessonPlayback?.resumeSeconds || selectedLessonProgress?.progressSeconds || 0;
                              if (resumeSeconds > 0) {
                                seekHostedVideoToResume(event.currentTarget, selectedLesson.id, resumeSeconds, appliedResumeRef);
                              }
                            }}
                            onCanPlay={(event) => {
                              const resumeSeconds = protectedLessonPlayback?.resumeSeconds || selectedLessonProgress?.progressSeconds || 0;
                              if (resumeSeconds > 0) {
                                seekHostedVideoToResume(event.currentTarget, selectedLesson.id, resumeSeconds, appliedResumeRef);
                              }
                            }}
                            onTimeUpdate={(event) => {
                              playbackSnapshotRef.current = {
                                lesson: selectedLesson,
                                courseId: selectedCourse._id,
                                canAccess: canAccessLesson,
                                progressSeconds: event.currentTarget.currentTime,
                                mediaDurationSeconds: event.currentTarget.duration || 0,
                                completed: false,
                              };
                              void persistLessonProgress(selectedCourse._id, canAccessLesson, selectedLesson, event.currentTarget.currentTime, false, false, event.currentTarget.duration);
                            }}
                            onPause={(event) => {
                              playbackSnapshotRef.current = {
                                lesson: selectedLesson,
                                courseId: selectedCourse._id,
                                canAccess: canAccessLesson,
                                progressSeconds: event.currentTarget.currentTime,
                                mediaDurationSeconds: event.currentTarget.duration || 0,
                                completed: false,
                              };
                              void persistLessonProgress(selectedCourse._id, canAccessLesson, selectedLesson, event.currentTarget.currentTime, false, true, event.currentTarget.duration);
                            }}
                            onEnded={(event) => {
                              playbackSnapshotRef.current = {
                                lesson: selectedLesson,
                                courseId: selectedCourse._id,
                                canAccess: canAccessLesson,
                                progressSeconds: event.currentTarget.currentTime,
                                mediaDurationSeconds: event.currentTarget.duration || 0,
                                completed: true,
                              };
                              void persistLessonProgress(selectedCourse._id, canAccessLesson, selectedLesson, event.currentTarget.currentTime, true, true, event.currentTarget.duration);
                            }}
                            controls
                            controlsList="nodownload noplaybackrate"
                            disablePictureInPicture
                            playsInline
                            preload="metadata"
                            className="aspect-video w-full bg-black"
                          />
                        ) : canAccessLesson && hostedVideoUrl ? (
                          <video
                            key={`${selectedLesson.id}:${hostedVideoUrl}`}
                            ref={videoRef}
                            src={hostedVideoUrl}
                            onLoadedMetadata={(event) => {
                              const resumeSeconds = selectedLessonProgress?.progressSeconds || 0;
                              if (resumeSeconds > 0) {
                                seekHostedVideoToResume(event.currentTarget, selectedLesson.id, resumeSeconds, appliedResumeRef);
                              }
                            }}
                            onCanPlay={(event) => {
                              const resumeSeconds = selectedLessonProgress?.progressSeconds || 0;
                              if (resumeSeconds > 0) {
                                seekHostedVideoToResume(event.currentTarget, selectedLesson.id, resumeSeconds, appliedResumeRef);
                              }
                            }}
                            onTimeUpdate={(event) => {
                              playbackSnapshotRef.current = {
                                lesson: selectedLesson,
                                courseId: selectedCourse._id,
                                canAccess: canAccessLesson,
                                progressSeconds: event.currentTarget.currentTime,
                                mediaDurationSeconds: event.currentTarget.duration || 0,
                                completed: false,
                              };
                              void persistLessonProgress(selectedCourse._id, canAccessLesson, selectedLesson, event.currentTarget.currentTime, false, false, event.currentTarget.duration);
                            }}
                            onPause={(event) => {
                              playbackSnapshotRef.current = {
                                lesson: selectedLesson,
                                courseId: selectedCourse._id,
                                canAccess: canAccessLesson,
                                progressSeconds: event.currentTarget.currentTime,
                                mediaDurationSeconds: event.currentTarget.duration || 0,
                                completed: false,
                              };
                              void persistLessonProgress(selectedCourse._id, canAccessLesson, selectedLesson, event.currentTarget.currentTime, false, true, event.currentTarget.duration);
                            }}
                            onEnded={(event) => {
                              playbackSnapshotRef.current = {
                                lesson: selectedLesson,
                                courseId: selectedCourse._id,
                                canAccess: canAccessLesson,
                                progressSeconds: event.currentTarget.currentTime,
                                mediaDurationSeconds: event.currentTarget.duration || 0,
                                completed: true,
                              };
                              void persistLessonProgress(selectedCourse._id, canAccessLesson, selectedLesson, event.currentTarget.currentTime, true, true, event.currentTarget.duration);
                            }}
                            controls
                            controlsList="nodownload"
                            playsInline
                            preload="metadata"
                            className="aspect-video w-full bg-black"
                          />
                        ) : canAccessLesson && ['youtube', 'private-video'].includes(selectedLesson.type) && protectedLessonError ? (
                          <div className="flex aspect-video flex-col items-center justify-center gap-4 px-6 text-center text-white">
                            <Lock className="h-10 w-10 text-[var(--accent-rust)]" />
                            <div>
                              <p className="text-lg font-semibold">Protected lesson unavailable</p>
                              <p className="mt-2 text-sm leading-7 text-white/68">{protectedLessonError}</p>
                            </div>
                          </div>
                        ) : canAccessLesson ? (
                          <div className="flex aspect-video flex-col items-center justify-center gap-4 px-6 text-center text-white">
                            <p className="text-lg font-semibold">Video will appear here</p>
                            <p className="max-w-2xl text-sm leading-7 text-white/68">This topic is available, but the secure player could not be rendered from the current lesson type.</p>
                          </div>
                        ) : (
                          <div className="flex aspect-video flex-col items-center justify-center gap-4 px-6 text-center text-white">
                            <Lock className="h-10 w-10 text-[var(--accent-rust)]" />
                            <div>
                              <p className="text-lg font-semibold">Lesson locked</p>
                              <p className="mt-2 text-sm leading-7 text-white/68">{selectedLessonAccess?.reason || 'Enroll in this course to unlock protected video playback, notes, and tracked progress for this topic.'}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {!canAccessLesson && (
                      <div className="mt-4 rounded-[20px] border border-[#ffe2d5] bg-[#fff8f3] p-4">
                        <p className="text-sm font-semibold text-[#a6521a]">This topic is not ready to play yet</p>
                        <p className="mt-2 text-sm leading-6 text-[#8a5a34]">
                          {selectedLessonAccess?.reason || 'Unlock the course to access protected playback, notes, and synced progress.'}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3">
                          {!selectedCourse.enrolled && (
                            <button
                              onClick={() => handleUnlock(selectedCourse)}
                              disabled={busyCourseId === selectedCourse._id}
                              className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-rust)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              {busyCourseId === selectedCourse._id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                              {selectedCourse.price === 0 ? 'Start free course' : `Unlock ${currency.format(selectedCourse.price)}`}
                            </button>
                          )}
                          {previousLessonEntry && (
                            <button
                              onClick={() => handleSelectLesson(previousLessonEntry.lesson.id)}
                              className="rounded-full border border-[#d7e5f1] bg-white px-4 py-2 text-sm font-semibold text-[#172033]"
                            >
                              Open previous topic
                            </button>
                          )}
                          {!previousLessonEntry && firstAccessibleLessonEntry && firstAccessibleLessonEntry.lesson.id !== selectedLesson.id && (
                            <button
                              onClick={() => handleSelectLesson(firstAccessibleLessonEntry.lesson.id)}
                              className="rounded-full border border-[#d7e5f1] bg-white px-4 py-2 text-sm font-semibold text-[#172033]"
                            >
                              Open first available topic
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#edf2f7] pt-4">
                      <div className="flex flex-wrap gap-2">
                        {selectedLesson.notesUrl && canAccessLesson && (
                          <a href={selectedLesson.notesUrl} target="_blank" rel="noreferrer" className="rounded-full bg-[#f4f7fb] px-4 py-2 text-sm font-semibold text-[#172033]">
                            Open notes PDF
                          </a>
                        )}
                        {canAccessLesson && !selectedLessonProgress?.completed && (
                          <button
                            onClick={() => void markLessonComplete()}
                            className="rounded-full bg-[#f4f7fb] px-4 py-2 text-sm font-semibold text-[#172033]"
                          >
                            Mark complete
                          </button>
                        )}
                        <button
                          onClick={() => onToggleSavedTopic(selectedCourse._id, selectedLesson.id)}
                          className="rounded-full bg-[#f4f7fb] px-4 py-2 text-sm font-semibold text-[#172033]"
                        >
                          {selectedLessonSaved ? 'Saved topic' : 'Save topic'}
                        </button>
                        <button
                          className="rounded-full bg-[#f4f7fb] px-4 py-2 text-sm font-semibold text-[#172033]"
                          type="button"
                        >
                          Report issue
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-[#607089]">
                        <span>{selectedLessonProgress?.completed ? 'Completed' : `${selectedLessonProgress?.progressPercent || 0}% watched`}</span>
                        <span>Resume {formatPlaybackTime(selectedLessonProgress?.progressSeconds || 0)}</span>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-col gap-5 border-t border-[#edf2f7] pt-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,#172033,#334867)] text-white shadow-[0_18px_32px_rgba(23,32,51,0.18)]">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/68">Topic</span>
                            <span className="mt-1 text-2xl font-semibold leading-none">{selectedLessonIndex + 1}</span>
                          </div>
                          <div>
                            <p className="text-2xl font-semibold text-[#172033]">{selectedLesson.title}</p>
                            <p className="mt-1 text-sm text-[#607089]">{selectedCourse.instructor}</p>
                            <p className="mt-1 text-sm text-[#90a0b4]">{selectedCourse.subject} • {selectedCourse.level}</p>
                          </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <button
                            onClick={() => previousLessonEntry && handleSelectLesson(previousLessonEntry.lesson.id)}
                            disabled={!previousLessonEntry}
                            className="inline-flex items-center justify-between rounded-[18px] border border-[#dbe4ef] bg-white px-4 py-3 text-left text-sm font-medium text-[#172033] disabled:opacity-45"
                          >
                            <span className="inline-flex items-center gap-2">
                              <ChevronLeft className="h-4 w-4" />
                              Previous topic
                            </span>
                          </button>
                          <button
                            onClick={() => nextLessonEntry && handleSelectLesson(nextLessonEntry.lesson.id)}
                            disabled={!nextLessonEntry}
                            className="inline-flex items-center justify-between rounded-[18px] border border-[#dbe4ef] bg-white px-4 py-3 text-left text-sm font-medium text-[#172033] disabled:opacity-45"
                          >
                            <span className="inline-flex items-center gap-2">
                              Next topic
                              <ChevronRight className="h-4 w-4" />
                            </span>
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-[18px] bg-[#f8fbff] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a9ab0]">Lesson path</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-[#172033]">
                            {[selectedLessonMeta?.moduleTitle, selectedLessonMeta?.chapterTitle, selectedLesson.title].filter(Boolean).join(' > ')}
                          </p>
                        </div>
                        <div className="rounded-[18px] bg-[#f8fbff] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a9ab0]">Access</p>
                          <p className="mt-2 text-sm font-semibold text-[#172033]">{selectedCourse.enrolled ? 'Unlocked course access' : selectedCourse.price === 0 ? 'Free course preview' : 'Premium course'}</p>
                        </div>
                        <div className="rounded-[18px] bg-[#f8fbff] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a9ab0]">Continue learning</p>
                          <p className="mt-2 text-sm font-semibold text-[#172033]">{selectedCourse.continueLesson?.title || selectedLesson.title}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </main>

              <aside className="border-t border-[#e7edf5] bg-white xl:col-span-2 2xl:col-span-1 2xl:border-l 2xl:border-t-0">
                <div className="grid grid-cols-3 border-b border-[#edf2f7]">
                  {[
                    { key: 'replays', label: 'Sessions', icon: Video },
                    { key: 'notes', label: 'Notes', icon: BookOpen },
                    { key: 'assistant', label: 'AI Help', icon: MessageSquare },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setStudySidebarTab(tab.key as typeof studySidebarTab)}
                        className={cn(
                          'flex items-center justify-center gap-2 px-3 py-4 text-sm font-semibold transition',
                          studySidebarTab === tab.key
                            ? 'border-b-2 border-[#22c7f2] text-[#22c7f2]'
                            : 'text-[#7b8ba2]',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-5">
                  {studySidebarTab === 'notes' && (
                    <div className="space-y-4">
                      <div className="rounded-[18px] bg-[#f8fbff] p-4">
                        <p className="text-sm font-semibold text-[#172033]">Current topic</p>
                        <p className="mt-2 text-xl font-semibold text-[#172033]">{selectedLesson.title}</p>
                        <p className="mt-3 text-sm leading-6 text-[#607089]">
                          {[selectedLessonMeta?.moduleTitle, selectedLessonMeta?.chapterTitle, selectedLesson.title].filter(Boolean).join(' > ')}
                        </p>
                      </div>

                      {selectedLesson.notesUrl && canAccessLesson ? (
                        <a
                          href={selectedLesson.notesUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center rounded-[16px] bg-[#172033] px-5 py-3 font-semibold text-white"
                        >
                          Open notes PDF
                        </a>
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[#dbe4ef] p-4 text-sm text-[#607089]">
                          {canAccessLesson
                            ? 'No notes PDF is attached for this topic yet.'
                            : 'Unlock this topic to access notes and other study resources.'}
                        </div>
                      )}

                      <div className="grid gap-3">
                        <div className="rounded-[18px] bg-[#f8fbff] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a9ab0]">Topic progress</p>
                          <p className="mt-2 text-2xl font-semibold text-[#172033]">{selectedLessonProgress?.completed ? 'Completed' : `${selectedLessonProgress?.progressPercent || 0}% watched`}</p>
                        </div>
                        <div className="rounded-[18px] bg-[#f8fbff] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a9ab0]">Resume point</p>
                          <p className="mt-2 text-2xl font-semibold text-[#172033]">{formatPlaybackTime(selectedLessonProgress?.progressSeconds || 0)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {studySidebarTab === 'assistant' && (
                    <div className="space-y-4">
                      <div className="rounded-[18px] bg-[#f8fbff] p-4">
                        <p className="text-sm font-semibold text-[#172033]">Ask a topic doubt</p>
                        <p className="mt-2 text-sm leading-6 text-[#607089]">Ask for concept clarity, shortcuts, or exam-oriented explanations for this topic.</p>
                      </div>
                      <textarea
                        value={lessonDoubt}
                        onChange={(event) => setLessonDoubt(event.target.value)}
                        placeholder={`Ask about ${selectedLesson.title}...`}
                        className="h-32 w-full rounded-[18px] border border-[#dbe4ef] bg-[#fbfdff] px-4 py-4 text-sm outline-none transition focus:border-[#8cb4dd]"
                      />
                      <button
                        onClick={() => void askLessonDoubt()}
                        disabled={askingLessonDoubt || !lessonDoubt.trim()}
                        className="w-full rounded-[16px] bg-[#172033] px-5 py-3 font-semibold text-white disabled:opacity-55"
                      >
                        {askingLessonDoubt ? 'Thinking...' : 'Ask AI doubt helper'}
                      </button>
                      {lessonDoubtAnswer && (
                        <div className="rounded-[18px] border border-[#e2ebf4] bg-white p-4 text-sm leading-7 text-[#607089]">
                          {lessonDoubtAnswer}
                        </div>
                      )}
                    </div>
                  )}

                  {studySidebarTab === 'replays' && (
                    <div className="space-y-4">
                      <div className="rounded-[18px] bg-[#f8fbff] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#172033]">Sessions</p>
                            <p className="mt-1 text-sm text-[#607089]">Live classes and recordings for this course.</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#172033]">
                            {selectedCourseSessions.length}
                          </span>
                        </div>
                      </div>

                      {selectedCourseSessions.length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-[#dbe4ef] p-4 text-sm text-[#607089]">
                          No live sessions or recordings are available for this course yet.
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {selectedCourseSessions.map((session) => (
                              <button
                                key={session._id}
                                onClick={() => setSelectedRecordingId(session._id)}
                                className={cn(
                                  'w-full rounded-[18px] border p-4 text-left transition',
                                  selectedRecordingId === session._id
                                    ? 'border-[#8ec5ff] bg-[#eef6ff]'
                                    : 'border-[#e2ebf4] bg-white hover:border-[#c8d8ea]',
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-base font-semibold leading-6 text-[#172033]">{session.title}</p>
                                    <p className="mt-1 text-sm text-[#607089]">{session.instructor} • {formatSessionDateTime(session.startTime)}</p>
                                    <p className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8a9ab0]">
                                      {getLiveClassContextLabel(session, selectedCourse?.subject || 'Course session')}
                                    </p>
                                  </div>
                                  <span className={cn(
                                    'shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
                                    getLiveClassChipClasses(session),
                                  )}>
                                    {getLiveClassLabel(session)}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>

                          {!user ? (
                            <div className="rounded-[18px] border border-dashed border-[#dbe4ef] p-4 text-sm text-[#607089]">
                              Log in to open protected sessions inside the course experience.
                            </div>
                          ) : loadingRecordingAccess ? (
                            <div className="flex items-center gap-3 rounded-[18px] border border-[#dbe4ef] p-4 text-sm text-[#607089]">
                              <LoaderCircle className="h-5 w-5 animate-spin" />
                              Preparing secure session access…
                            </div>
                          ) : recordingAccessError ? (
                            <div className="rounded-[18px] border border-dashed border-[#dbe4ef] p-4 text-sm text-[#607089]">
                              {recordingAccessError}
                            </div>
                          ) : selectedCourseSession ? (
                            <div className="space-y-4">
                              <div className="rounded-[18px] border border-[#e2ebf4] bg-white p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <span className={cn(
                                      'inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
                                      getLiveClassChipClasses(selectedCourseSession),
                                    )}>
                                      {getLiveClassLabel(selectedCourseSession)}
                                    </span>
                                    <p className="mt-3 text-lg font-semibold text-[#172033]">{selectedCourseSession.title}</p>
                                    <p className="mt-2 text-sm text-[#607089]">
                                      {selectedCourseSession.instructor} • {formatSessionDateTime(selectedCourseSession.startTime)}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-[#f8fbff] px-3 py-2 text-[11px] font-medium text-[#607089]">
                                    {getLiveClassContextLabel(selectedCourseSession, selectedCourse?.subject || 'Course session')}
                                  </span>
                                </div>

                                {selectedCourseSessionState === 'scheduled' ? (
                                  <div className="mt-4 rounded-[14px] bg-[#f8fbff] px-4 py-3 text-sm text-[#607089]">
                                    Starts {formatSessionDateTime(selectedCourseSession.startTime)}
                                  </div>
                                ) : !selectedCourseSession.replayReady && selectedCourseSessionState !== 'live' ? (
                                  <div className="mt-4 rounded-[14px] bg-[#f8fbff] px-4 py-3 text-sm text-[#607089]">
                                    Recording is being prepared.
                                  </div>
                                ) : !showReplayPlayer ? (
                                  <button
                                    onClick={() => setShowReplayPlayer(true)}
                                    disabled={!selectedRecordingAccess}
                                    className="mt-4 inline-flex rounded-full bg-[#172033] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                  >
                                    {selectedCourseSessionState === 'live' ? 'Join live class' : 'Watch recording'}
                                  </button>
                                ) : null}
                              </div>

                              {showReplayPlayer && selectedRecordingAccess && (
                                <div className="overflow-hidden rounded-[18px] border border-[#e2ebf4] bg-white">
                                  <ProtectedLivePlayback access={selectedRecordingAccess} />
                                </div>
                              )}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          ) : (
            <div className="p-8 text-[#607089]">
              Select a topic from the course to open the lesson player.
            </div>
          )}
        </section>
      ) : (
        <div className="rounded-[24px] border border-dashed border-[#dbe4ef] bg-white p-8 text-[#607089]">
          Select a course to view modules, topics, and the lesson player.
        </div>
      )}
    </div>
  );
};
