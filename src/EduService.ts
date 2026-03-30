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

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...buildHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed for ${path}`);
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
    const checkout = await request<{ _id: string; paymentUrl: string }>(`/payment/checkout`, {
      method: 'POST',
      body: JSON.stringify({
        amount: course.price,
        currency: 'INR',
        item: course.title,
      }),
    });

    await request(`/payment/webhook`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'payment.completed',
        paymentId: checkout._id,
        status: 'paid',
      }),
    });

    return request(`/platform/enroll`, {
      method: 'POST',
      body: JSON.stringify({
        courseId: course._id,
        source: 'simulated-payment',
        accessType: 'course',
      }),
    });
  },

  unlockSubscription: async (plan: SubscriptionPlan) => {
    const checkout = await request<{ _id: string; paymentUrl: string }>(`/payment/checkout`, {
      method: 'POST',
      body: JSON.stringify({
        amount: plan.price,
        currency: 'INR',
        item: plan.title,
      }),
    });

    await request(`/payment/webhook`, {
      method: 'POST',
      body: JSON.stringify({
        event: 'payment.completed',
        paymentId: checkout._id,
        status: 'paid',
      }),
    });

    return request(`/platform/subscribe`, {
      method: 'POST',
      body: JSON.stringify({
        planId: plan._id,
        source: 'simulated-payment',
      }),
    });
  },

  updateWatchProgress: async (
    courseId: string,
    lessonId: string,
    progressPercent: number,
    progressSeconds: number,
    completed: boolean,
  ) => {
    return request(`/platform/watch-progress`, {
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
};
