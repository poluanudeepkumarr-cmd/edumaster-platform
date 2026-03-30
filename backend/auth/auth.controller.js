// Auth Controller
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { appConfig } = require('../lib/config.js');
const { usersRepository, sanitizeUser, sessionRepository } = require('../lib/repositories.js');

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }

    const existing = await usersRepository.findByEmail(email);
    if (existing) return res.status(400).json({ message: 'Email already exists' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await usersRepository.create({ name, email, password: hashed, role });
    res.status(201).json({ user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, device } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await usersRepository.findByEmail(email);
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });
    // Enforce a single active session by rotating the session id on every new login.
    const userId = user._id.toString();
    if (user.session) {
      await sessionRepository.recordLogout({
        userId,
        sessionId: user.session,
        device: user.device || device || null,
        reason: 'replaced',
      });
    }

    const sessionId = Math.random().toString(36).substring(2);
    const updatedUser = await usersRepository.update(userId, {
      session: sessionId,
      device: device || null,
    });
    await sessionRepository.recordLogin({
      userId,
      sessionId,
      device: device || null,
    });

    const token = jwt.sign(
      { id: user._id, role: user.role, session: sessionId },
      appConfig.jwtSecret,
      { expiresIn: '7d' },
    );

    res.json({ token, user: sanitizeUser(updatedUser || user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSession = async (req, res) => {
  try {
    const user = await usersRepository.findSafeById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const logout = async (req, res) => {
  try {
    const currentUser = await usersRepository.findById(req.user.id);
    await usersRepository.update(req.user.id, {
      session: null,
      device: null,
    });
    await sessionRepository.recordLogout({
      userId: req.user.id,
      sessionId: req.user.session,
      device: currentUser?.device || null,
      reason: 'logout',
    });

    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, getSession, logout };
