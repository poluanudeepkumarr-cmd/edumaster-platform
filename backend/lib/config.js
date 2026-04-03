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
  adminName: process.env.ADMIN_NAME || 'Demo Admin',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@edumaster.local',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123',
  mongoUri: process.env.MONGODB_URI || '',
  postgresUrl: process.env.POSTGRES_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  storageBucket: process.env.S3_BUCKET || '',
  storageRegion: process.env.S3_REGION || '',
  s3Endpoint: process.env.S3_ENDPOINT || '',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  s3ForcePathStyle: toBool(process.env.S3_FORCE_PATH_STYLE, false),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  aiProvider: process.env.AI_PROVIDER || 'auto',
  aiModel: process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini',
  aiApiKey: process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '',
  aiBaseUrl: process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite',
  googleOauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  googleOauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  youtubeUploadRefreshToken: process.env.YOUTUBE_UPLOAD_REFRESH_TOKEN || '',
  privateVideoTokenSecret: process.env.PRIVATE_VIDEO_TOKEN_SECRET || process.env.JWT_SECRET || 'dev-only-secret',
  privateVideoTokenTtlSeconds: toNumber(process.env.PRIVATE_VIDEO_TOKEN_TTL_SECONDS, 900),
  privateVideoDeliveryUrlTtlSeconds: toNumber(process.env.PRIVATE_VIDEO_DELIVERY_URL_TTL_SECONDS, 900),
  privateVideoDrmEnabled: toBool(process.env.PRIVATE_VIDEO_DRM_ENABLED, false),
  privateVideoStorageProvider: process.env.PRIVATE_VIDEO_STORAGE_PROVIDER || 'local',
  enableVideoTranscoding: toBool(process.env.ENABLE_VIDEO_TRANSCODING, true),
  sourcePlaybackFallbackEnabled: toBool(process.env.SOURCE_PLAYBACK_FALLBACK_ENABLED, true),
  videoDeliveryProfile: process.env.VIDEO_DELIVERY_PROFILE || 'cost-saver-hls',
  videoTargetRenditions: (process.env.VIDEO_TARGET_RENDITIONS || '480p,720p')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean),
  videoHlsSegmentDurationSeconds: toNumber(process.env.VIDEO_HLS_SEGMENT_DURATION_SECONDS, 6),
  videoKeepSourceAfterProcessing: toBool(process.env.VIDEO_KEEP_SOURCE_AFTER_PROCESSING, false),
  maxVideoUploadMb: toNumber(process.env.MAX_VIDEO_UPLOAD_MB, 2048),
  environmentLabel: process.env.ENVIRONMENT_LABEL || 'local',
  exposeSampleCredentials: toBool(process.env.EXPOSE_SAMPLE_CREDENTIALS, process.env.NODE_ENV !== 'production'),
  jitsiMeetDomain: process.env.JITSI_MEET_DOMAIN || 'meet.jit.si',
  livekitUrl: process.env.LIVEKIT_URL || '',
  livekitApiKey: process.env.LIVEKIT_API_KEY || '',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
  livekitRoomPrefix: process.env.LIVEKIT_ROOM_PREFIX || 'edumaster-live',
  livekitTokenTtlSeconds: toNumber(process.env.LIVEKIT_TOKEN_TTL_SECONDS, 600),
};

const isDefaultJwtSecret = appConfig.jwtSecret === 'dev-only-secret';

if (appConfig.nodeEnv === 'production' && isDefaultJwtSecret) {
  throw new Error('JWT_SECRET must be set in production.');
}

if (appConfig.nodeEnv !== 'production' && isDefaultJwtSecret) {
  console.warn('[config] Using fallback JWT secret for non-production environment.');
}

const getConfigSummary = () => ({
  nodeEnv: appConfig.nodeEnv,
  serviceName: appConfig.serviceName,
  environmentLabel: appConfig.environmentLabel,
  appUrl: appConfig.appUrl,
  hasMongo: Boolean(appConfig.mongoUri),
  hasPostgres: Boolean(appConfig.postgresUrl),
  hasRedis: Boolean(appConfig.redisUrl),
  hasStripe: Boolean(appConfig.stripeSecretKey && appConfig.stripePublishableKey),
  hasAiProvider: Boolean(appConfig.aiApiKey),
  aiProvider: appConfig.aiProvider,
  aiModel: appConfig.aiModel,
  hasGemini: Boolean(appConfig.geminiApiKey),
  geminiModel: appConfig.geminiModel,
  hasS3: Boolean(appConfig.storageBucket && appConfig.storageRegion),
  hasLiveKit: Boolean(appConfig.livekitUrl && appConfig.livekitApiKey && appConfig.livekitApiSecret),
  s3EndpointConfigured: Boolean(appConfig.s3Endpoint),
  hasYouTubeUpload: Boolean(
    appConfig.googleOauthClientId
    && appConfig.googleOauthClientSecret
    && appConfig.youtubeUploadRefreshToken,
  ),
  hasPrivateVideoSigning: Boolean(appConfig.privateVideoTokenSecret),
  privateVideoStorageProvider: appConfig.privateVideoStorageProvider,
  enableVideoTranscoding: appConfig.enableVideoTranscoding,
  videoDeliveryProfile: appConfig.videoDeliveryProfile,
  maxVideoUploadMb: appConfig.maxVideoUploadMb,
});

module.exports = {
  appConfig,
  getConfigSummary,
};
