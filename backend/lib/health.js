const { appConfig, getConfigSummary } = require('./config.js');
const { checkPostgresHealth } = require('./postgres.js');
const { checkRedisHealth } = require('./redis.js');
const { getMongoUri, isMongoConnected, getDatabaseMode } = require('./database.js');

const startedAt = Date.now();

const getMongoHealth = () => ({
  enabled: Boolean(getMongoUri()),
  status: isMongoConnected() ? 'up' : getMongoUri() ? 'down' : 'disabled',
  detail: isMongoConnected()
    ? 'mongoose-connected'
    : getMongoUri()
      ? 'connection-unavailable'
      : 'MONGODB_URI not configured',
});

const getDependencyHealth = async () => {
  const [postgres, redis] = await Promise.all([
    checkPostgresHealth(),
    checkRedisHealth(),
  ]);

  return {
    mongodb: getMongoHealth(),
    postgres,
    redis,
    storage: {
      enabled: Boolean(appConfig.storageBucket && appConfig.storageRegion),
      status: appConfig.storageBucket && appConfig.storageRegion ? 'configured' : 'disabled',
      detail: appConfig.storageBucket
        ? `${appConfig.storageBucket} (${appConfig.storageRegion || 'region-missing'})`
        : 'S3 bucket not configured',
    },
    payments: {
      enabled: Boolean(appConfig.stripeSecretKey && appConfig.stripePublishableKey),
      status: appConfig.stripeSecretKey && appConfig.stripePublishableKey ? 'configured' : 'disabled',
      detail: appConfig.stripeSecretKey ? 'stripe-secret-present' : 'STRIPE_SECRET_KEY not configured',
    },
  };
};

const getHealthSnapshot = async () => {
  const dependencies = await getDependencyHealth();
  const dependencyStatuses = Object.values(dependencies).map((entry) => entry.status);
  const overallStatus = dependencyStatuses.includes('down')
    ? 'degraded'
    : dependencyStatuses.some((status) => status === 'up' || status === 'configured')
      ? 'ok'
      : 'bootstrapped';

  return {
    status: overallStatus,
    service: appConfig.serviceName,
    environment: appConfig.environmentLabel,
    mode: getDatabaseMode(),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    config: getConfigSummary(),
    dependencies,
    timestamp: new Date().toISOString(),
  };
};

module.exports = {
  getHealthSnapshot,
};
