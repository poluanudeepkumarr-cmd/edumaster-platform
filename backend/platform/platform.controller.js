const { platformRepository } = require('../lib/repositories.js');

const getOverview = async (req, res) => {
  try {
    const requestedUserId = req.query.userId || null;
    const userId = req.user?.role === 'admin'
      ? requestedUserId || req.user?.id || null
      : req.user?.id || null;
    const overview = await platformRepository.getOverview(userId);
    return res.json(overview);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const seedPlatform = async (req, res) => {
  try {
    const seedStatus = await platformRepository.ensureSeeded();
    return res.json({ message: 'Platform data initialized', status: seedStatus || 'ok' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const enroll = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { courseId, source, accessType } = req.body || {};

    if (!userId || !courseId) {
      return res.status(400).json({ message: 'courseId is required' });
    }

    const enrollment = await platformRepository.enroll({
      userId,
      courseId,
      source,
      accessType,
    });

    return res.status(201).json(enrollment);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const subscribe = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { planId, source } = req.body || {};

    if (!userId || !planId) {
      return res.status(400).json({ message: 'planId is required' });
    }

    const subscription = await platformRepository.subscribe({
      userId,
      planId,
      source,
    });

    if (!subscription) {
      return res.status(404).json({ message: 'Subscription plan not found' });
    }

    return res.status(201).json(subscription);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const updateWatchProgress = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { courseId, lessonId, progressPercent, progressSeconds, completed } = req.body || {};

    if (!userId || !courseId || !lessonId) {
      return res.status(400).json({ message: 'courseId and lessonId are required' });
    }

    const watchRecord = await platformRepository.updateWatchProgress({
      userId,
      courseId,
      lessonId,
      progressPercent,
      progressSeconds,
      completed,
    });

    return res.json(watchRecord);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const askAi = async (req, res) => {
  try {
    const userId = req.user?.id || 'guest';
    const { message } = req.body || {};

    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }

    const aiResponse = await platformRepository.askAi({ userId, message });
    return res.json(aiResponse);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getOverview,
  seedPlatform,
  enroll,
  subscribe,
  updateWatchProgress,
  askAi,
};
