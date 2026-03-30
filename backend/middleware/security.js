const { appConfig } = require('../lib/config.js');

const requestBuckets = new Map();

const securityHeaders = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
};

const cleanupBuckets = (now) => {
  requestBuckets.forEach((bucket, key) => {
    if (now - bucket.windowStart > appConfig.rateLimitWindowMs * 2) {
      requestBuckets.delete(key);
    }
  });
};

const basicRateLimit = (req, res, next) => {
  const now = Date.now();
  const key = `${req.ip || 'unknown'}:${req.path}`;
  const bucket = requestBuckets.get(key) || { count: 0, windowStart: now };

  if (now - bucket.windowStart > appConfig.rateLimitWindowMs) {
    bucket.count = 0;
    bucket.windowStart = now;
  }

  bucket.count += 1;
  requestBuckets.set(key, bucket);

  res.setHeader('X-RateLimit-Limit', String(appConfig.rateLimitMax));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(appConfig.rateLimitMax - bucket.count, 0)));

  if (bucket.count > appConfig.rateLimitMax) {
    return res.status(429).json({ message: 'Too many requests. Please retry shortly.' });
  }

  if (requestBuckets.size > 5000) {
    cleanupBuckets(now);
  }

  return next();
};

module.exports = {
  securityHeaders,
  basicRateLimit,
};
