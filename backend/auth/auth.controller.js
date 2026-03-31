// Auth Controller
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { appConfig } = require('../lib/config.js');
const { usersRepository, sanitizeUser, sessionRepository } = require('../lib/repositories.js');
const { ApiError, asyncHandler, ok, created, requireString, optionalString } = require('../lib/http.js');

const validatePassword = (password) => {
  const normalized = requireString(password, 'password', { minLength: 8, maxLength: 128 });
  if (!/[A-Za-z]/.test(normalized) || !/\d/.test(normalized)) {
    throw new ApiError(400, 'password must include at least one letter and one number', { code: 'VALIDATION_ERROR' });
  }

  return normalized;
};

const register = asyncHandler(async (req, res) => {
  const name = requireString(req.body?.name, 'name', { maxLength: 80 });
  const email = requireString(req.body?.email, 'email', { maxLength: 160 }).toLowerCase();
  const password = validatePassword(req.body?.password);
  const role = req.body?.role === 'admin' ? 'admin' : 'student';

  const existing = await usersRepository.findByEmail(email);
  if (existing) {
    throw new ApiError(409, 'Email already exists', { code: 'EMAIL_EXISTS' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await usersRepository.create({ name, email, password: hashed, role });
  return created(res, { user: sanitizeUser(user) });
});

const login = asyncHandler(async (req, res) => {
  const email = requireString(req.body?.email, 'email', { maxLength: 160 }).toLowerCase();
  const password = requireString(req.body?.password, 'password', { minLength: 1, maxLength: 128 });
  const device = optionalString(req.body?.device, 'web-dashboard', { maxLength: 120 });

  const user = await usersRepository.findByEmail(email);
  if (!user) {
    throw new ApiError(401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new ApiError(401, 'Invalid credentials', { code: 'INVALID_CREDENTIALS' });
  }

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

  return ok(res, { token, user: sanitizeUser(updatedUser || user) });
});

const getSession = asyncHandler(async (req, res) => {
  const user = await usersRepository.findSafeById(req.user.id);
  if (!user) {
    throw new ApiError(404, 'User not found', { code: 'USER_NOT_FOUND' });
  }

  return ok(res, { user });
});

const logout = asyncHandler(async (req, res) => {
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

  return ok(res, { message: 'Logged out successfully' });
});

module.exports = { register, login, getSession, logout };
