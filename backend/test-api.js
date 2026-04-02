const { startServer } = require('./server.cjs');

let baseUrl = process.env.API_BASE_URL || null;

const now = Date.now();
const today = new Date().toISOString().slice(0, 10);

const request = async (method, path, body, token) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new Error(`${method} ${path} failed with ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
};

const runStep = async (label, fn) => {
  const result = await fn();
  console.log(`PASS ${label}`);
  return result;
};

const testEndpoints = async () => {
  let serverHandle = null;

  if (!baseUrl) {
    const { server } = await startServer({ port: 0, host: '127.0.0.1' });
    serverHandle = server;
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}/api`;
  }

  const studentEmail = `student_${now}@example.com`;
  try {
    const health = await runStep('GET /health', () => request('GET', '/health'));
    await runStep('GET /ready', () => request('GET', '/ready'));
    await runStep('GET /live', () => request('GET', '/live'));

    const registeredStudent = await runStep('POST /auth/register student', () =>
      request('POST', '/auth/register', {
        email: studentEmail,
        password: 'test12345',
        name: 'Student Tester',
        role: 'student',
      }),
    );

    await runStep('POST /auth/register admin is rejected', async () => {
      try {
        await request('POST', '/auth/register', {
          email: `admin_${now}@example.com`,
          password: 'test12345',
          name: 'Admin Tester',
          role: 'admin',
        });
      } catch (error) {
        if (error?.status === 409) {
          throw error;
        }

        return error.payload;
      }

      throw new Error('Admin self-registration should not succeed');
    });

    const studentLogin = await runStep('POST /auth/login', () =>
      request('POST', '/auth/login', {
        email: studentEmail,
        password: 'test12345',
        device: 'terminal-smoke-test',
      }),
    );
    const publicOverview = await runStep('GET /platform/overview public', () => request('GET', '/platform/overview'));
    const adminLogin = await runStep('POST /auth/login admin', () =>
      request('POST', '/auth/login', {
        email: publicOverview.sampleCredentials.adminEmail,
        password: publicOverview.sampleCredentials.adminPassword,
        device: 'terminal-admin-smoke-test',
      }),
    );

    const studentToken = studentLogin.token;
    const adminToken = adminLogin.token;
    const studentUserId = registeredStudent.user._id;
    await runStep('GET /auth/session', () => request('GET', '/auth/session', null, studentToken));

    await runStep('GET /platform/overview student', () => request('GET', '/platform/overview', null, studentToken));
    const liveClasses = await runStep('GET /live-classes', () => request('GET', '/live-classes'));
    await runStep(`GET /live-classes/${liveClasses[0]._id}`, () => request('GET', `/live-classes/${liveClasses[0]._id}`));
    const liveClass = await runStep('POST /live-classes admin create', () =>
      request('POST', '/live-classes', {
        title: 'Smoke Test Live Class',
        instructor: 'Terminal Faculty',
        startTime: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        durationMinutes: 60,
        provider: 'EduMaster Live',
        mode: 'live',
        status: 'scheduled',
        livePlaybackType: 'hls',
        livePlaybackUrl: '',
        chatEnabled: true,
        doubtSolving: true,
        replayAvailable: true,
        maxAttendees: 1000,
        requiresEnrollment: false,
        topicTags: ['Smoke Test', 'Live'],
      }, adminToken),
    );
    await runStep(`GET /live-classes/${liveClass._id}/access`, () => request('GET', `/live-classes/${liveClass._id}/access`, null, studentToken));
    await runStep(`GET /live-classes/${liveClass._id}/chat`, () => request('GET', `/live-classes/${liveClass._id}/chat`, null, studentToken));
    await runStep(`POST /live-classes/${liveClass._id}/chat`, () =>
      request('POST', `/live-classes/${liveClass._id}/chat`, {
        message: 'Smoke test live class doubt',
        kind: 'doubt',
      }, studentToken),
    );

    const course = await runStep('POST /courses', () =>
      request('POST', '/courses', {
        title: 'SSC Maths Foundation',
        description: 'Dummy course for smoke testing',
        category: 'SSC JE',
        exam: 'SSC JE',
        subject: 'Mathematics',
        level: 'Practice Course',
        price: 499,
        validityDays: 90,
        instructor: 'Terminal Teacher',
        modules: [{
          id: 'module_arithmetic',
          title: 'Arithmetic Basics',
          lessons: [
            {
              id: 'lesson_arithmetic_1',
              title: 'Numbers and Operations',
              type: 'youtube',
              durationMinutes: 15,
              videoUrl: 'https://www.youtube.com/watch?v=test',
              notesUrl: 'https://example.com/arithmetic.pdf',
              premium: false,
            },
          ],
        }],
        createdBy: 'admin_tester',
      }, adminToken),
    );

    await runStep('GET /courses', () => request('GET', '/courses'));
    await runStep(`GET /courses/${course._id}`, () => request('GET', `/courses/${course._id}`));
    await runStep(`GET /courses/${course._id}/lessons`, () => request('GET', `/courses/${course._id}/lessons`));

    await runStep('POST /platform/enroll', () =>
      request('POST', '/platform/enroll', {
        courseId: course._id,
        source: 'smoke-test',
      }, studentToken),
    );

    const test = await runStep('POST /tests', () =>
      request('POST', '/tests', {
        title: 'Weekly Mock Test',
        description: 'Smoke test mock exam',
        category: 'SSC JE',
        type: 'topic-wise',
        durationMinutes: 45,
        totalMarks: 2,
        negativeMarking: 0.25,
        course: course._id,
        questions: [
          { id: 'math_q1', questionText: '2 + 2', options: ['3', '4'], correctOption: 1, answer: 1, explanation: '2 + 2 = 4', marks: 1, topic: 'Arithmetic' },
          { id: 'math_q2', questionText: '5 - 2', options: ['2', '3'], correctOption: 1, answer: 1, explanation: '5 - 2 = 3', marks: 1, topic: 'Arithmetic' },
        ],
      }, adminToken),
    );

    await runStep('GET /tests', () => request('GET', '/tests'));
    await runStep(`GET /tests/${test._id}`, () => request('GET', `/tests/${test._id}`));
    await runStep(`POST /tests/${test._id}/submit`, () =>
      request('POST', `/tests/${test._id}/submit`, {
        answers: {
          math_q1: 1,
          math_q2: 1,
        },
        startedAt: new Date().toISOString(),
      }, studentToken),
    );

    const quiz = await runStep('POST /quiz/create', () =>
      request('POST', '/quiz/create', {
        date: today,
        questions: [
          { prompt: 'Capital of France', options: ['Paris', 'Rome'], answer: 'Paris' },
          { prompt: '3 x 3', options: ['6', '9'], answer: '9' },
        ],
      }, adminToken),
    );

    await runStep('GET /quiz/daily', () => request('GET', '/quiz/daily'));
    await runStep('POST /quiz/submit', () =>
      request('POST', '/quiz/submit', {
        quizId: quiz._id,
        answers: ['Paris', '9'],
      }, studentToken),
    );
    await runStep(`GET /quiz/${quiz._id}/leaderboard`, () =>
      request('GET', `/quiz/${quiz._id}/leaderboard`),
    );

    await runStep('GET /users/profile', () => request('GET', '/users/profile', null, studentToken));
    await runStep('GET /users/progress', () => request('GET', '/users/progress', null, studentToken));
    await runStep('GET /users/analytics', () => request('GET', '/users/analytics', null, studentToken));

    await runStep('GET /analytics/user', () =>
      request('GET', '/analytics/user', null, studentToken),
    );
    await runStep('GET /analytics/leaderboard', () => request('GET', '/analytics/leaderboard'));

    await runStep('GET /admin/users', () => request('GET', '/admin/users', null, adminToken));
    await runStep('GET /admin/courses', () => request('GET', '/admin/courses', null, adminToken));
    await runStep('GET /admin/tests', () => request('GET', '/admin/tests', null, adminToken));
    await runStep('GET /admin/analytics', () => request('GET', '/admin/analytics', null, adminToken));
    await runStep('POST /admin/upload-questions', () =>
      request('POST', '/admin/upload-questions', {
        title: 'Uploaded Practice Set',
        course: course._id,
        questions: [{ prompt: '1 + 1', options: ['1', '2'], answer: '2' }],
      }, adminToken),
    );

    await runStep('GET /notifications', () =>
      request('GET', `/notifications?userId=${encodeURIComponent(studentUserId)}`),
    );
    const notification = await runStep('POST /notifications/send', () =>
      request('POST', '/notifications/send', {
        userId: studentUserId,
        title: 'Test Reminder',
        message: 'Your next mock test starts at 7 PM.',
        type: 'reminder',
      }),
    );

    await runStep('POST /engagement/referral', () =>
      request('POST', '/engagement/referral', {
        referrerUserId: studentUserId,
        referredEmail: `friend_${now}@example.com`,
      }),
    );
    await runStep('GET /engagement/gamification', () =>
      request('GET', `/engagement/gamification?userId=${encodeURIComponent(studentUserId)}`),
    );

    const checkout = await runStep('POST /payment/checkout', () =>
      request('POST', '/payment/checkout', {
        amount: 499,
        currency: 'INR',
        item: 'Premium Mock Test Series',
      }, studentToken),
    );
    await runStep('POST /payment/webhook failed', () =>
      request('POST', '/payment/webhook', {
        event: 'payment.failed',
        paymentId: checkout._id,
        status: 'failed',
        errorMessage: 'Issuer declined',
      }),
    );
    await runStep(`POST /payment/${checkout._id}/retry`, () =>
      request('POST', `/payment/${checkout._id}/retry`, null, studentToken),
    );
    await runStep('POST /payment/webhook', () =>
      request('POST', '/payment/webhook', {
        event: 'payment.completed',
        paymentId: checkout._id,
        status: 'paid',
      }),
    );
    await runStep('POST /platform/subscribe', () =>
      request('POST', '/platform/subscribe', {
        planId: 'plan_je_pro',
        source: 'smoke-test',
      }, studentToken),
    );

    await runStep('POST /platform/watch-progress', () =>
      request('POST', '/platform/watch-progress', {
        courseId: course._id,
        lessonId: 'lesson_arithmetic_1',
        progressPercent: 100,
        progressSeconds: 900,
        completed: true,
      }, studentToken),
    );

    await runStep('POST /platform/ai/ask', () =>
      request('POST', '/platform/ai/ask', {
        message: 'Create a 7-day plan for SSC JE revision',
      }, studentToken),
    );

    await runStep('POST /admin/seed-sample-data', () =>
      request('POST', '/admin/seed-sample-data', {}, adminToken),
    );

    await runStep('POST /auth/logout', () => request('POST', '/auth/logout', {}, studentToken));

    console.log(JSON.stringify({
      baseUrl,
      mode: health.mode,
      studentUserId,
      courseId: course._id,
      testId: test._id,
      quizId: quiz._id,
      notificationId: notification.notification._id,
      paymentId: checkout._id,
    }, null, 2));
  } finally {
    if (serverHandle) {
      await new Promise((resolve) => serverHandle.close(resolve));
    }
  }
};

testEndpoints().catch((error) => {
  console.error('Smoke test failed');
  console.error(error.message);
  if (error.payload) {
    console.error(JSON.stringify(error.payload, null, 2));
  }
  process.exit(1);
});
