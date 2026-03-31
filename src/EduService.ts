import {
  AiResponse,
  AuthResponse,
  AuthUser,
  CourseCard,
  DailyQuizResult,
  LiveChatMessage,
  LiveClass,
  MockTest,
  PlatformOverview,
  RegisterPayload,
  SubscriptionPlan,
  TestAttemptResult,
} from './types';

const API_BASE = '/backend/api';
const TOKEN_KEY = 'edumaster.jwt';

let authToken: string | null = null;

const readStoredToken = () => {
  if (typeof window === 'undefined') {
    return authToken;
  }

  return authToken || window.localStorage.getItem(TOKEN_KEY);
};

const saveToken = (token: string | null) => {
  authToken = token;

  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
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

  getLiveChat: async (liveClassId: string) => {
    return request<LiveChatMessage[]>(`/live-classes/${liveClassId}/chat`);
  },

  postLiveChat: async (liveClassId: string, message: string, kind: 'chat' | 'doubt') => {
    return request<LiveChatMessage>(`/live-classes/${liveClassId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, kind }),
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
    formData.append('courseId', courseId);
    formData.append('moduleId', moduleId);
    formData.append('lessonTitle', lessonTitle);
    formData.append('durationMinutes', String(durationMinutes || 0));
    formData.append('isPremium', String(isPremium || false));
    if (chapterId) {
      formData.append('chapterId', chapterId);
    }

    // Using fetch directly for FormData/multipart
    const response = await fetch(`/backend/api/courses/${courseId}/modules/${moduleId}/videos`, {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Upload failed');
    }

    return response.json();
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
