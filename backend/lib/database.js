const mongoose = require('mongoose');
const { appConfig } = require('./config.js');
const { initializePostgres, isPostgresReady } = require('./postgres.js');

const isValidMongoUri = (value) => typeof value === 'string' && /^mongodb(\+srv)?:\/\//.test(value.trim());

const getMongoUri = () => {
  const rawUri = appConfig.mongoUri;
  return isValidMongoUri(rawUri) ? rawUri.trim() : null;
};

const connectDatabase = async () => {
  const postgresState = await initializePostgres();
  if (postgresState.connected) {
    return postgresState;
  }

  const mongoUri = getMongoUri();

  if (!mongoUri) {
    return {
      connected: false,
      mode: 'memory',
      reason: postgresState.enabled
        ? `Postgres unavailable: ${postgresState.reason}`
        : 'No valid MONGODB_URI configured',
    };
  }

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5_000,
      autoIndex: appConfig.nodeEnv !== 'production',
    });
    return {
      connected: true,
      mode: 'mongodb',
    };
  } catch (error) {
    return {
      connected: false,
      mode: 'memory',
      reason: error.message,
    };
  }
};

const isMongoConnected = () => mongoose.connection.readyState === 1;
const isDatabaseConnected = () => isPostgresReady() || isMongoConnected();
const getDatabaseMode = () => (isPostgresReady() ? 'postgres' : (isMongoConnected() ? 'mongodb' : 'memory'));

module.exports = {
  connectDatabase,
  getMongoUri,
  isMongoConnected,
  isDatabaseConnected,
  getDatabaseMode,
};
