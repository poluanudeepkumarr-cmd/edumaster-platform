import {
  AiResponse,
  AuthResponse,
  AuthUser,
  CourseCard,
  DailyQuizResult,
  GeneratedAssessmentDraft,
  LiveChatMessage,
  LiveBroadcastAdminState,
  LiveBroadcastViewerState,
  LiveClass,
  LiveClassAccess,
  MockTest,
  PlatformOverview,
  ProtectedLessonPlayback,
  RegisterPayload,
  SubscriptionPlan,
  TestAttemptResult,
} from './types';

const API_BASE = '/backend/api';
const TOKEN_KEY = 'edumaster.jwt';
const AUTH_EVENT_KEY = 'edumaster.auth.event';

let authToken: string | null = null;

const readStoredToken = () => {
  if (typeof window === 'undefined') {
    return authToken;
  }

  const sessionToken = window.sessionStorage.getItem(TOKEN_KEY);
  if (sessionToken) {
    authToken = sessionToken;
    return sessionToken;
  }

  const legacyToken = window.localStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    window.sessionStorage.setItem(TOKEN_KEY, legacyToken);
    window.localStorage.removeItem(TOKEN_KEY);
    authToken = legacyToken;
    return legacyToken;
  }

  return authToken;
};

const saveToken = (token: string | null) => {
  authToken = token;

  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    window.sessionStorage.setItem(TOKEN_KEY, token);
    window.localStorage.removeItem(TOKEN_KEY);
  } else {
    window.sessionStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(TOKEN_KEY);
  }
};

const emitAuthEvent = (event: { type: 'login' | 'logout'; userId?: string | null; sessionId?: string | null }) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({
      ...event,
      issuedAt: new Date().toISOString(),
    }));
    window.localStorage.removeItem(AUTH_EVENT_KEY);
  } catch {
    // Ignore storage event failures and rely on session polling fallback.
  }
};

const buildHeaders = (hasBody: boolean) => {
  const token = readStoredToken();

  return {
    ...(hasBody ? { 'content-type': 'application/json' } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
};

const buildAuthHeaders = () => {
  const token = readStoredToken();
  return token ? { authorization: `Bearer ${token}` } : {};
};

const parsePayload = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const extractErrorMessage = (payload: any, path: string) =>
  payload?.error
  || payload?.message
  || payload?.details?.message
  || `Request failed for ${path}`;

const handleUnauthorized = (payload?: any) => {
  saveToken(null);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('edumaster:auth-expired', {
      detail: {
        code: payload?.code || 'AUTH_EXPIRED',
        message: payload?.message || 'Session expired. Please sign in again.',
      },
    }));
  }
};

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
  });

  const payload = await parsePayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized(payload);
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error(extractErrorMessage(payload, path));
  }

  return payload as T;
};

const rootRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...buildHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
  });

  const payload = await parsePayload(response);

  if (!response.ok) {
    if (response.status === 401) {
      handleUnauthorized(payload);
      throw new Error('Session expired. Please sign in again.');
    }
    throw new Error(extractErrorMessage(payload, path));
  }

  return payload as T;
};

export const EduService = {
  getToken: () => readStoredToken(),
  setToken: (token: string | null) => saveToken(token),
  clearToken: () => saveToken(null),

  register: async (payload: RegisterPayload): Promise<AuthResponse> => {
    await request<{ user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        role: 'student',
      }),
    });

    return EduService.login(payload.email, payload.password);
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
        device: 'web-dashboard',
      }),
    });

    saveToken(response.token);
    emitAuthEvent({
      type: 'login',
      userId: response.user._id,
      sessionId: response.user.session || null,
    });
    return response;
  },

  restoreSession: async (): Promise<AuthUser | null> => {
    if (!readStoredToken()) {
      return null;
    }

    try {
      const response = await request<{ user: AuthUser }>('/auth/session');
      return response.user;
    } catch {
      saveToken(null);
      return null;
    }
  },

  logout: async () => {
    try {
      if (readStoredToken()) {
        await request<{ message: string }>('/auth/logout', { method: 'POST' });
      }
    } finally {
      emitAuthEvent({ type: 'logout' });
      saveToken(null);
    }
  },

  seedPlatform: async () => {
    return request<{ message: string }>('/platform/seed', { method: 'POST' });
  },

  getPlatformOverview: async () => {
    return request<PlatformOverview>('/platform/overview');
  },

  submitDailyQuiz: async (quizId: string, answers: string[]) => {
    return request<DailyQuizResult>(`/quiz/submit`, {
      method: 'POST',
      body: JSON.stringify({ quizId, answers }),
    });
  },

  submitMockTest: async (testId: string, answers: Record<string, number>, startedAt: string) => {
    return request<TestAttemptResult>(`/tests/${testId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers, startedAt }),
    });
  },

  unlockCourse: async (course: CourseCard) => {
    return rootRequest<{ url: string; sessionId: string; paymentId: string }>(`/api/stripe/course-checkout`, {
      method: 'POST',
      body: JSON.stringify({
        courseId: course._id,
        courseTitle: course.title,
        price: course.price,
        origin: window.location.origin,
      }),
    });
  },

  confirmCoursePayment: async (sessionId: string, courseId: string) => {
    return rootRequest(`/api/stripe/confirm-course-payment`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, courseId }),
    });
  },

  enrollInCourse: async (courseId: string, source = 'direct-access') => {
    return request(`/platform/enroll`, {
      method: 'POST',
      body: JSON.stringify({
        courseId,
        source,
        accessType: 'course',
      }),
    });
  },

  unlockSubscription: async (plan: SubscriptionPlan) => {
    return rootRequest<{ url: string; sessionId: string; paymentId: string }>(`/api/stripe/subscription-checkout`, {
      method: 'POST',
      body: JSON.stringify({
        planId: plan._id,
        planTitle: plan.title,
        price: plan.price,
        billingCycle: plan.billingCycle,
        origin: window.location.origin,
      }),
    });
  },

  confirmSubscriptionPayment: async (sessionId: string, planId: string) => {
    return rootRequest(`/api/stripe/confirm-subscription-payment`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, planId }),
    });
  },

  updateWatchProgress: async (
    courseId: string,
    lessonId: string,
    progressPercent: number,
    progressSeconds: number,
    completed: boolean,
    requestOptions: RequestInit = {},
  ) => {
    return request(`/platform/watch-progress`, {
      ...requestOptions,
      method: 'POST',
      body: JSON.stringify({
        courseId,
        lessonId,
        progressPercent,
        progressSeconds,
        completed,
      }),
    });
  },

  askAi: async (message: string) => {
    return request<AiResponse>(`/platform/ai/ask`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  generateAssessmentDraft: async (payload: {
    provider?: string;
    contentType: 'mock-test' | 'daily-quiz';
    exam?: string;
    subject?: string;
    topic?: string;
    title?: string;
    type?: string;
    difficulty?: string;
    questionCount?: number;
    durationMinutes?: number;
    negativeMarking?: number;
    quizDate?: string;
    instructions?: string;
  }) => {
    return request<GeneratedAssessmentDraft>(`/platform/ai/generate-assessment`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  seedSampleData: async () => {
    return request(`/admin/seed-sample-data`, { method: 'POST' });
  },

  createCourse: async (course: Partial<CourseCard>) => {
    return request<CourseCard>(`/courses`, {
      method: 'POST',
      body: JSON.stringify(course),
    });
  },

  updateCourse: async (courseId: string, course: Partial<CourseCard>) => {
    return request<CourseCard>(`/courses/${courseId}`, {
      method: 'PUT',
      body: JSON.stringify(course),
    });
  },

  deleteCourse: async (courseId: string) => {
    return request<{ message: string; courseId: string }>(`/courses/${courseId}`, {
      method: 'DELETE',
    });
  },

  addModuleToCourse: async (
    courseId: string,
    payload: { title: string; description?: string; order?: number },
  ) => {
    return request<{ message: string; module: unknown; course: CourseCard }>(`/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCourseModule: async (
    courseId: string,
    moduleId: string,
    payload: { title?: string; description?: string; order?: number },
  ) => {
    return request<{ message: string; module: unknown; course: CourseCard }>(`/courses/${courseId}/modules/${moduleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteCourseModule: async (courseId: string, moduleId: string) => {
    return request<{ message: string; moduleId: string; course: CourseCard }>(`/courses/${courseId}/modules/${moduleId}`, {
      method: 'DELETE',
    });
  },

  addChapterToModule: async (
    courseId: string,
    moduleId: string,
    payload: { title: string; description?: string; order?: number },
  ) => {
    return request<{ message: string; chapter: unknown; course: CourseCard }>(`/courses/${courseId}/modules/${moduleId}/chapters`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateChapterInModule: async (
    courseId: string,
    moduleId: string,
    chapterId: string,
    payload: { title?: string; description?: string; order?: number },
  ) => {
    return request<{ message: string; chapter: unknown; course: CourseCard }>(`/courses/${courseId}/modules/${moduleId}/chapters/${chapterId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteChapterFromModule: async (courseId: string, moduleId: string, chapterId: string) => {
    return request<{ message: string; chapterId: string; course: CourseCard }>(`/courses/${courseId}/modules/${moduleId}/chapters/${chapterId}`, {
      method: 'DELETE',
    });
  },

  createMockTest: async (test: Partial<MockTest>) => {
    return request<MockTest>(`/tests`, {
      method: 'POST',
      body: JSON.stringify(test),
    });
  },

  createQuiz: async (payload: {
    date: string;
    questions: {
      id?: string;
      prompt: string;
      options: string[];
      answer: string;
      explanation: string;
      topic: string;
    }[];
  }) => {
    return request(`/quiz/create`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  uploadQuestions: async (payload: {
    title: string;
    category: string;
    type: string;
    course?: string;
    questions: MockTest['questions'];
  }) => {
    return request(`/admin/upload-questions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  retryPayment: async (paymentId: string) => {
    return request<{ _id: string; paymentUrl: string; status: string; attemptCount: number }>(`/payment/${paymentId}/retry`, {
      method: 'POST',
    });
  },

  getLiveClasses: async () => {
    return request<LiveClass[]>(`/live-classes`);
  },

  getAdminLiveClasses: async () => {
    return request<LiveClass[]>(`/live-classes/admin/list`);
  },

  createLiveClass: async (payload: Partial<LiveClass>) => {
    return request<LiveClass>('/live-classes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateLiveClass: async (liveClassId: string, payload: Partial<LiveClass>) => {
    return request<LiveClass>(`/live-classes/${liveClassId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  startLiveClass: async (liveClassId: string) => {
    return request<LiveClass>(`/live-classes/${liveClassId}/start`, {
      method: 'POST',
    });
  },

  endLiveClass: async (liveClassId: string, payload: Partial<LiveClass> = {}) => {
    return request<LiveClass>(`/live-classes/${liveClassId}/end`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteLiveClass: async (liveClassId: string) => {
    return request<{ deleted: boolean; liveClassId: string }>(`/live-classes/${liveClassId}`, {
      method: 'DELETE',
    });
  },

  getLiveClassAccess: async (liveClassId: string) => {
    return request<LiveClassAccess>(`/live-classes/${liveClassId}/access`);
  },

  getLiveChat: async (liveClassId: string) => {
    return request<LiveChatMessage[]>(`/live-classes/${liveClassId}/chat`);
  },

  getLiveKitJoinToken: async (liveClassId: string, role: 'host' | 'viewer') => {
    return request<{ liveClassId: string; roomName: string; url: string; token: string; canPublish: boolean }>(
      `/live-classes/${liveClassId}/livekit/token?role=${role}`,
    );
  },

  postLiveChat: async (liveClassId: string, message: string, kind: 'chat' | 'doubt') => {
    return request<LiveChatMessage>(`/live-classes/${liveClassId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, kind }),
    });
  },

  startLiveBroadcastSession: async (liveClassId: string) => {
    return request<{ liveClassId: string; status: string; createdAt: string }>(`/live-classes/${liveClassId}/broadcast/session`, {
      method: 'POST',
    });
  },

  stopLiveBroadcastSession: async (liveClassId: string) => {
    return request<{ liveClassId: string; stopped: boolean }>(`/live-classes/${liveClassId}/broadcast/session`, {
      method: 'DELETE',
    });
  },

  getLiveBroadcastAdminState: async (liveClassId: string) => {
    return request<LiveBroadcastAdminState>(`/live-classes/${liveClassId}/broadcast/admin/state`);
  },

  joinLiveBroadcastAsViewer: async (liveClassId: string) => {
    return request<{ viewerId: string; liveClassId: string }>(`/live-classes/${liveClassId}/broadcast/viewers`, {
      method: 'POST',
    });
  },

  getLiveBroadcastViewerState: async (liveClassId: string, viewerId: string) => {
    return request<LiveBroadcastViewerState>(`/live-classes/${liveClassId}/broadcast/viewers/${viewerId}`);
  },

  postLiveBroadcastOffer: async (liveClassId: string, viewerId: string, offer: RTCSessionDescriptionInit) => {
    return request<{ viewerId: string; offerId: string }>(`/live-classes/${liveClassId}/broadcast/viewers/${viewerId}/offer`, {
      method: 'POST',
      body: JSON.stringify(offer),
    });
  },

  postLiveBroadcastAnswer: async (liveClassId: string, viewerId: string, answer: RTCSessionDescriptionInit) => {
    return request<{ viewerId: string; answerId: string }>(`/live-classes/${liveClassId}/broadcast/viewers/${viewerId}/answer`, {
      method: 'POST',
      body: JSON.stringify(answer),
    });
  },

  postLiveBroadcastCandidate: async (
    liveClassId: string,
    viewerId: string,
    role: 'admin' | 'viewer',
    candidate: RTCIceCandidateInit,
  ) => {
    return request<{ viewerId: string; candidateId: string }>(`/live-classes/${liveClassId}/broadcast/viewers/${viewerId}/candidates`, {
      method: 'POST',
      body: JSON.stringify({
        role,
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
        usernameFragment: candidate.usernameFragment,
      }),
    });
  },

  // Video upload methods for admin
  uploadVideoToModule: async (
    courseId: string,
    moduleId: string,
    file: File,
    lessonTitle: string,
    durationMinutes?: number,
    isPremium?: boolean,
    chapterId?: string,
  ) => {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('lessonTitle', lessonTitle);
    formData.append('durationMinutes', String(durationMinutes || 0));
    formData.append('isPremium', String(Boolean(isPremium)));
    formData.append('lessonType', 'video');

    if (chapterId) {
      formData.append('chapterId', chapterId);
    }

    const response = await fetch(`/backend/api/courses/${courseId}/modules/${moduleId}/videos`, {
      method: 'POST',
      headers: {
        ...buildAuthHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
  },

  getProtectedLessonPlayback: async (courseId: string, lessonId: string) => {
    return request<ProtectedLessonPlayback>(`/courses/${courseId}/lessons/${lessonId}/player`, {
      method: 'GET',
    });
  },

  listVideosInModule: async (courseId: string, moduleId: string) => {
    return request(`/courses/${courseId}/modules/${moduleId}/videos`, {
      method: 'GET',
    });
  },

  deleteVideoFromModule: async (courseId: string, moduleId: string, videoId: string) => {
    return request(`/courses/${courseId}/modules/${moduleId}/videos/${videoId}`, {
      method: 'DELETE',
    });
  },

  getVideoMetadata: async (courseId: string, moduleId: string, videoId: string) => {
    return request(`/courses/${courseId}/modules/${moduleId}/videos/${videoId}`, {
      method: 'GET',
    });
  },
};
