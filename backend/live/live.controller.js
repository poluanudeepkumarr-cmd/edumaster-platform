const { liveClassesRepository } = require('../lib/repositories.js');

const getLiveClasses = async (_req, res) => {
  try {
    const classes = await liveClassesRepository.list();
    return res.json(classes);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getLiveClass = async (req, res) => {
  try {
    const liveClass = await liveClassesRepository.findById(req.params.id);
    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    return res.json(liveClass);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const getLiveChat = async (req, res) => {
  try {
    const liveClass = await liveClassesRepository.findById(req.params.id);
    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    const messages = await liveClassesRepository.getChat(req.params.id);
    return res.json(messages);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const postLiveChat = async (req, res) => {
  try {
    const { message, kind } = req.body || {};
    if (!message) {
      return res.status(400).json({ message: 'message is required' });
    }

    const posted = await liveClassesRepository.postChat({
      liveClassId: req.params.id,
      userId: req.user?.id,
      message,
      kind,
    });

    if (posted === null) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    if (posted === false) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(201).json(posted);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getLiveClasses,
  getLiveClass,
  getLiveChat,
  postLiveChat,
};
