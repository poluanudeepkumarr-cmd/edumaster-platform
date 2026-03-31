const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const { appConfig } = require('./lib/config.js');
const { getHealthSnapshot } = require('./lib/health.js');
const { securityHeaders, basicRateLimit } = require('./middleware/security.js');
const paymentRoutes = require('./payment/payment.routes.js');
const engagementRoutes = require('./engagement/engagement.routes.js');
const notificationsRoutes = require('./notifications/notifications.routes.js');
const adminRoutes = require('./admin/admin.routes.js');
const analyticsRoutes = require('./analytics/analytics.routes.js');
const userRoutes = require('./user/user.routes.js');
const courseRoutes = require('./course/course.routes.js');
const testRoutes = require('./test/test.routes.js');
const quizRoutes = require('./quiz/quiz.routes.js');
const authRoutes = require('./auth/auth.routes.js');
const platformRoutes = require('./platform/platform.routes.js');
const liveRoutes = require('./live/live.routes.js');
const { connectDatabase, getDatabaseMode } = require('./lib/database.js');

const app = express();
app.set('trust proxy', appConfig.trustProxy);
app.disable('x-powered-by');
app.use(cors({ origin: appConfig.corsOrigin === '*' ? true : appConfig.corsOrigin }));
app.use(express.json({ limit: appConfig.jsonBodyLimit }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(securityHeaders);
app.use(basicRateLimit);

app.get('/api/health', async (_req, res) => {
  const snapshot = await getHealthSnapshot();
  res.status(snapshot.status === 'degraded' ? 503 : 200).json(snapshot);
});

app.get('/api/ready', async (_req, res) => {
  const snapshot = await getHealthSnapshot();
  const ready = ['ok', 'bootstrapped'].includes(snapshot.status);
  res.status(ready ? 200 : 503).json({
    ready,
    status: snapshot.status,
    mode: snapshot.mode,
    dependencies: snapshot.dependencies,
  });
});

app.get('/api/live', (_req, res) => {
  res.json({
    alive: true,
    mode: getDatabaseMode(),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/live-classes', liveRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/platform', platformRoutes);

const PORT = appConfig.port;
const HOST = process.env.HOST || '127.0.0.1';

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const startServer = async (options = {}) => {
  const databaseState = await connectDatabase();
  if (!databaseState.connected) {
    console.warn(`Database unavailable, starting in memory mode: ${databaseState.reason}`);
  }

  const port = options.port ?? PORT;
  const host = options.host ?? HOST;

  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      const address = server.address();
      const resolvedPort = typeof address === 'object' && address ? address.port : port;
      console.log(`Server running on ${host}:${resolvedPort} (${databaseState.mode})`);
      resolve({ server, databaseState });
    });

    server.on('error', reject);
  });
};

if (require.main === module) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  app,
  startServer,
};
