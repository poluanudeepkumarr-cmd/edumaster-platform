const path = require('path');

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const appConfig = {
  nodeEnv: process.env.NODE_ENV || 'development',
  serviceName: process.env.SERVICE_NAME || 'edumaster-platform',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  host: process.env.HOST || '0.0.0.0',
  port: toNumber(process.env.PORT, 5000),
  logLevel: process.env.LOG_LEVEL || 'info',
  trustProxy: toBool(process.env.TRUST_PROXY, true),
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '1mb',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  frontendDistDir: path.join(process.cwd(), 'dist'),
  rateLimitWindowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  rateLimitMax: toNumber(process.env.RATE_LIMIT_MAX, 300),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret',
  mongoUri: process.env.MONGODB_URI || '',
  postgresUrl: process.env.POSTGRES_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  storageBucket: process.env.S3_BUCKET || '',
  storageRegion: process.env.S3_REGION || '',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  environmentLabel: process.env.ENVIRONMENT_LABEL || 'local',
};

const getConfigSummary = () => ({
  nodeEnv: appConfig.nodeEnv,
  serviceName: appConfig.serviceName,
  environmentLabel: appConfig.environmentLabel,
  appUrl: appConfig.appUrl,
  hasMongo: Boolean(appConfig.mongoUri),
  hasPostgres: Boolean(appConfig.postgresUrl),
  hasRedis: Boolean(appConfig.redisUrl),
  hasStripe: Boolean(appConfig.stripeSecretKey && appConfig.stripePublishableKey),
  hasS3: Boolean(appConfig.storageBucket && appConfig.storageRegion),
});

module.exports = {
  appConfig,
  getConfigSummary,
};
