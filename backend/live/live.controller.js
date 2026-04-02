const path = require('path');
const {
  liveClassesRepository,
  sessionRepository,
  coursesRepository,
  notificationsRepository,
  usersRepository,
} = require('../lib/repositories.js');
const { nextId, nowIso } = require('../lib/store.js');
const {
  ApiError,
  asyncHandler,
  ok,
  created,
  requireString,
  optionalString,
  requireNumber,
  optionalNumber,
  requireBoolean,
} = require('../lib/http.js');
const { issuePlaybackToken, verifyPlaybackToken } = require('../lib/private-video.js');
const {
  createLiveKitRoom,
  deleteLiveKitRoom,
  getLiveKitParticipantIdentity,
  issueLiveKitToken,
  getLiveKitRoomName,
  removeLiveKitParticipant,
} = require('../lib/livekit.js');
const { appConfig } = require('../lib/config.js');

const liveBroadcastSessions = new Map();

const assetMimeTypeByExtension = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return requireBoolean(value, 'boolean value');
};

const normalizeTopicTags = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const normalizeLiveClassPayload = (body = {}) => {
  const mode = optionalString(body.mode, 'live', { maxLength: 20 }) || 'live';
  const provider = optionalString(body.provider, 'EduMaster Live', { maxLength: 40 }) || 'EduMaster Live';
  const status = optionalString(body.status, mode === 'replay' ? 'ended' : 'scheduled', { maxLength: 20 })
    .toLowerCase();

  return {
    courseId: optionalString(body.courseId, '', { maxLength: 120 }) || null,
    moduleId: optionalString(body.moduleId, '', { maxLength: 120 }) || null,
    moduleTitle: optionalString(body.moduleTitle, '', { maxLength: 160 }) || null,
    chapterId: optionalString(body.chapterId, '', { maxLength: 120 }) || null,
    chapterTitle: optionalString(body.chapterTitle, '', { maxLength: 160 }) || null,
    title: requireString(body.title, 'title', { maxLength: 255 }),
    instructor: optionalString(body.instructor, 'EduMaster Faculty', { maxLength: 120 }) || 'EduMaster Faculty',
    startTime: requireString(body.startTime, 'start time'),
    durationMinutes: requireNumber(body.durationMinutes, 'durationMinutes', { min: 5, max: 720, integer: true }),
    provider,
    mode,
    status,
    livePlaybackUrl: optionalString(body.livePlaybackUrl, '', { maxLength: 2000 }) || null,
    livePlaybackType: optionalString(body.livePlaybackType, 'hls', { maxLength: 20 }) || 'hls',
    embedUrl: optionalString(body.embedUrl, '', { maxLength: 2000 }) || null,
    roomUrl: optionalString(body.roomUrl, '', { maxLength: 2000 }) || null,
    recordingUrl: optionalString(body.recordingUrl, '', { maxLength: 2000 }) || null,
    replayCourseId: optionalString(body.replayCourseId, '', { maxLength: 120 }) || null,
    replayLessonId: optionalString(body.replayLessonId, '', { maxLength: 120 }) || null,
    chatEnabled: toBoolean(body.chatEnabled, true),
    doubtSolving: toBoolean(body.doubtSolving, true),
    replayAvailable: toBoolean(body.replayAvailable, true),
    attendees: optionalNumber(body.attendees, 0, { min: 0, max: 100000, integer: true }),
    maxAttendees: optionalNumber(body.maxAttendees, 1000, { min: 1, max: 100000, integer: true }),
    requiresEnrollment: toBoolean(body.requiresEnrollment, true),
    topicTags: normalizeTopicTags(body.topicTags),
  };
};

const buildJitsiRoomDetails = (liveClassId) => {
  const roomSeed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const safeRoomName = `EduMaster-${String(liveClassId)}-${roomSeed}`.replace(/[^A-Za-z0-9-]/g, '');
  const roomUrl = `https://${appConfig.jitsiMeetDomain}/${safeRoomName}`;
  const embedUrl = `${roomUrl}#config.prejoinPageEnabled=false&config.requireDisplayName=false&config.disableDeepLinking=true&config.startWithAudioMuted=false&config.startWithVideoMuted=false&interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true`;
  return {
    roomUrl,
    embedUrl,
  };
};

const resolveCoursePathMetadata = async (payload) => {
  if (!payload.courseId) {
    return {
      ...payload,
      moduleId: null,
      moduleTitle: null,
      chapterId: null,
      chapterTitle: null,
    };
  }

  const course = await coursesRepository.findById(payload.courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found', { code: 'COURSE_NOT_FOUND' });
  }

  let moduleId = payload.moduleId || null;
  let moduleTitle = payload.moduleTitle || null;
  let chapterId = payload.chapterId || null;
  let chapterTitle = payload.chapterTitle || null;

  if (moduleId) {
    const module = (course.modules || []).find((entry) => entry.id === moduleId);
    if (!module) {
      throw new ApiError(404, 'Selected subject was not found in the course', { code: 'MODULE_NOT_FOUND' });
    }

    moduleTitle = module.title;

    if (chapterId) {
      const chapter = (module.chapters || []).find((entry) => entry.id === chapterId);
      if (!chapter) {
        throw new ApiError(404, 'Selected chapter was not found in the subject', { code: 'CHAPTER_NOT_FOUND' });
      }

      chapterTitle = chapter.title;
    } else {
      chapterTitle = null;
    }
  } else {
    moduleTitle = null;
    chapterId = null;
    chapterTitle = null;
  }

  return {
    ...payload,
    moduleId,
    moduleTitle,
    chapterId,
    chapterTitle,
  };
};

const getBroadcastSession = (liveClassId) => liveBroadcastSessions.get(String(liveClassId)) || null;

const serializeViewerStateForAdmin = (viewer) => ({
  viewerId: viewer.viewerId,
  userId: viewer.userId,
  createdAt: viewer.createdAt,
  offer: viewer.offer || null,
  answer: viewer.answer || null,
  adminCandidates: viewer.adminCandidates || [],
  viewerCandidates: viewer.viewerCandidates || [],
  lastSeenAt: viewer.lastSeenAt || null,
});

const serializeViewerStateForViewer = (viewer) => ({
  viewerId: viewer.viewerId,
  offer: viewer.offer || null,
  answer: viewer.answer || null,
  adminCandidates: viewer.adminCandidates || [],
  status: 'live',
  lastSeenAt: viewer.lastSeenAt || null,
});

const buildLiveAssetUrl = (payload, upstreamUrl, mimeType) => {
  const issued = issuePlaybackToken({
    userId: payload.userId,
    sessionId: payload.sessionId,
    liveClassId: payload.liveClassId,
    upstreamUrl,
    mimeType,
    assetKind: path.extname(new URL(upstreamUrl).pathname).toLowerCase() === '.m3u8' ? 'live-hls' : 'live-asset',
  });
  return `/backend/api/live-classes/stream/${issued.token}`;
};

const rewriteLiveManifest = (manifestText, payload) => manifestText
  .split('\n')
  .map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return line;
    }

    const resolvedUrl = new URL(trimmed, payload.upstreamUrl).toString();
    const extension = path.extname(new URL(resolvedUrl).pathname).toLowerCase();
    const mimeType = assetMimeTypeByExtension[extension] || 'application/octet-stream';
    return buildLiveAssetUrl(payload, resolvedUrl, mimeType);
  })
  .join('\n');

const proxyLiveAsset = async (req, res, payload) => {
  const upstreamResponse = await fetch(payload.upstreamUrl, {
    headers: req.headers.range ? { range: String(req.headers.range) } : {},
  });

  if (!upstreamResponse.ok) {
    throw new ApiError(502, 'Live stream source is unavailable', { code: 'LIVE_STREAM_SOURCE_UNAVAILABLE' });
  }

  const upstreamUrl = new URL(payload.upstreamUrl);
  const extension = path.extname(upstreamUrl.pathname).toLowerCase();
  const mimeType = assetMimeTypeByExtension[extension] || payload.mimeType || upstreamResponse.headers.get('content-type') || 'application/octet-stream';

  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', mimeType);

  const contentLength = upstreamResponse.headers.get('content-length');
  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }

  const contentRange = upstreamResponse.headers.get('content-range');
  if (contentRange) {
    res.status(206);
    res.setHeader('Content-Range', contentRange);
  }

  if (extension === '.m3u8') {
    const manifestText = await upstreamResponse.text();
    res.send(rewriteLiveManifest(manifestText, payload));
    return;
  }

  const arrayBuffer = await upstreamResponse.arrayBuffer();
  res.send(Buffer.from(arrayBuffer));
};

const getLiveClasses = asyncHandler(async (_req, res) => {
  const classes = await liveClassesRepository.list();
  return ok(res, classes);
});

const getAdminLiveClasses = asyncHandler(async (_req, res) => {
  const classes = await liveClassesRepository.listAdmin();
  return ok(res, classes);
});

const getLiveClass = asyncHandler(async (req, res) => {
  const liveClass = await liveClassesRepository.findById(requireString(req.params.id, 'live class id'));
  if (!liveClass) {
    throw new ApiError(404, 'Live class not found', { code: 'LIVE_CLASS_NOT_FOUND' });
  }

  return ok(res, liveClass);
});

const createLiveClass = asyncHandler(async (req, res) => {
  const liveClass = await liveClassesRepository.create(
    await resolveCoursePathMetadata(normalizeLiveClassPayload(req.body || {})),
  );
  return created(res, liveClass);
});

const updateLiveClass = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const existing = await liveClassesRepository.findRawById(liveClassId);
  if (!existing) {
    throw new ApiError(404, 'Live class not found', { code: 'LIVE_CLASS_NOT_FOUND' });
  }

  const mergedPayload = {
    ...existing,
    ...(req.body || {}),
  };

  const updated = await liveClassesRepository.update(
    liveClassId,
    await resolveCoursePathMetadata(normalizeLiveClassPayload(mergedPayload)),
  );

  return ok(res, updated);
});

const startLiveClass = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const existing = await liveClassesRepository.findRawById(liveClassId);
  if (!existing) {
    throw new ApiError(404, 'Live class not found', { code: 'LIVE_CLASS_NOT_FOUND' });
  }

  const hasPlaybackSource = Boolean(existing.livePlaybackUrl || existing.embedUrl || existing.roomUrl);
  const shouldUseLiveKit = existing.livePlaybackType === 'livekit';
  const shouldBootstrapFreeJitsi = !hasPlaybackSource && !shouldUseLiveKit;

  if (shouldUseLiveKit) {
    await createLiveKitRoom(liveClassId);
  }

  const jitsiDetails = (existing.livePlaybackType === 'jitsi' || shouldBootstrapFreeJitsi)
    ? buildJitsiRoomDetails(liveClassId)
    : {};

  const updated = await liveClassesRepository.update(liveClassId, {
    ...jitsiDetails,
    status: 'live',
    livePlaybackType: shouldBootstrapFreeJitsi ? 'jitsi' : existing.livePlaybackType,
    provider: shouldUseLiveKit
      ? 'EduMaster Live Studio'
      : (existing.livePlaybackType === 'jitsi' || shouldBootstrapFreeJitsi)
        ? 'Jitsi Meet'
        : existing.provider,
    startTime: new Date().toISOString(),
  });

  await notificationsRepository.notifyLiveClassStarted(updated);

  return ok(res, updated);
});

const endLiveClass = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const existing = await liveClassesRepository.findRawById(liveClassId);
  if (!existing) {
    throw new ApiError(404, 'Live class not found', { code: 'LIVE_CLASS_NOT_FOUND' });
  }

  const recordingUrl = optionalString(req.body?.recordingUrl, existing.recordingUrl || '', { maxLength: 2000 }) || null;
  const replayCourseId = optionalString(req.body?.replayCourseId, existing.replayCourseId || '', { maxLength: 120 }) || null;
  const replayLessonId = optionalString(req.body?.replayLessonId, existing.replayLessonId || '', { maxLength: 120 }) || null;
  const replayAvailable = req.body?.replayAvailable === undefined
    ? existing.replayAvailable !== false
    : toBoolean(req.body?.replayAvailable, true);

  if (existing.livePlaybackType === 'livekit') {
    await deleteLiveKitRoom(liveClassId);
  }

  const updated = await liveClassesRepository.update(liveClassId, {
    status: 'ended',
    recordingUrl,
    replayCourseId,
    replayLessonId,
    replayAvailable,
  });

  return ok(res, updated);
});

const getLiveKitJoinToken = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const liveClass = await liveClassesRepository.findRawById(liveClassId);
  if (!liveClass) {
    throw new ApiError(404, 'Live class not found', { code: 'LIVE_CLASS_NOT_FOUND' });
  }

  if (liveClass.livePlaybackType !== 'livekit') {
    throw new ApiError(409, 'This live class is not configured for the in-app live studio', {
      code: 'LIVEKIT_NOT_ENABLED_FOR_CLASS',
    });
  }

  await liveClassesRepository.getAccess({
    liveClassId,
    userId: req.user?.id || null,
  });

  const canPublish = req.user?.role === 'admin' && String(req.query.role || 'viewer') === 'host';
  const authUser = await usersRepository.findSafeById(req.user?.id || '');
  const identity = getLiveKitParticipantIdentity({
    userId: req.user?.id || 'guest',
    canPublish,
  });

  await removeLiveKitParticipant({
    liveClassId,
    identity,
  });

  const token = await issueLiveKitToken({
    liveClassId,
    userId: req.user?.id || 'guest',
    name: authUser?.name || (canPublish ? 'Admin Host' : 'Student Viewer'),
    canPublish,
  });

  return ok(res, {
    liveClassId,
    roomName: token.roomName || getLiveKitRoomName(liveClassId),
    url: token.url,
    token: token.token,
    canPublish,
  });
});

const startBroadcastSession = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const liveClass = await liveClassesRepository.findRawById(liveClassId);
  if (!liveClass) {
    throw new ApiError(404, 'Live class not found', { code: 'LIVE_CLASS_NOT_FOUND' });
  }

  const session = {
    liveClassId,
    adminUserId: req.user?.id,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    viewers: new Map(),
  };

  liveBroadcastSessions.set(liveClassId, session);
  return ok(res, { liveClassId, status: 'live', createdAt: session.createdAt });
});

const stopBroadcastSession = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  liveBroadcastSessions.delete(liveClassId);
  return ok(res, { liveClassId, stopped: true });
});

const getBroadcastAdminState = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const session = getBroadcastSession(liveClassId);
  if (!session) {
    throw new ApiError(404, 'Broadcast session not found', { code: 'LIVE_BROADCAST_NOT_FOUND' });
  }

  return ok(res, {
    liveClassId,
    status: 'live',
    viewers: Array.from(session.viewers.values()).map(serializeViewerStateForAdmin),
  });
});

const joinBroadcastAsViewer = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const session = getBroadcastSession(liveClassId);
  if (!session) {
    throw new ApiError(404, 'Broadcast session not found', { code: 'LIVE_BROADCAST_NOT_FOUND' });
  }

  const access = await liveClassesRepository.getAccess({
    liveClassId,
    userId: req.user?.id || null,
  });

  if (access.accessType !== 'webrtc-live') {
    throw new ApiError(409, 'This live class is not running with in-app live broadcast', {
      code: 'LIVE_BROADCAST_NOT_ACTIVE',
    });
  }

  const existing = Array.from(session.viewers.values()).find((viewer) => viewer.userId === req.user?.id);
  if (existing) {
    existing.lastSeenAt = nowIso();
    session.updatedAt = nowIso();
    return ok(res, { viewerId: existing.viewerId, liveClassId });
  }

  const viewerId = nextId('live_viewer');
  session.viewers.set(viewerId, {
    viewerId,
    userId: req.user?.id,
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    offer: null,
    answer: null,
    adminCandidates: [],
    viewerCandidates: [],
  });
  session.updatedAt = nowIso();

  return created(res, { viewerId, liveClassId });
});

const getViewerBroadcastState = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const viewerId = requireString(req.params.viewerId, 'viewer id');
  const session = getBroadcastSession(liveClassId);
  if (!session) {
    throw new ApiError(404, 'Broadcast session not found', { code: 'LIVE_BROADCAST_NOT_FOUND' });
  }

  const viewer = session.viewers.get(viewerId);
  if (!viewer || viewer.userId !== req.user?.id) {
    throw new ApiError(404, 'Viewer connection not found', { code: 'LIVE_BROADCAST_VIEWER_NOT_FOUND' });
  }

  viewer.lastSeenAt = nowIso();
  session.updatedAt = nowIso();

  return ok(res, serializeViewerStateForViewer(viewer));
});

const postBroadcastOffer = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const viewerId = requireString(req.params.viewerId, 'viewer id');
  const session = getBroadcastSession(liveClassId);
  if (!session) {
    throw new ApiError(404, 'Broadcast session not found', { code: 'LIVE_BROADCAST_NOT_FOUND' });
  }

  if (session.adminUserId !== req.user?.id) {
    throw new ApiError(403, 'Only the active admin broadcaster can send offers', { code: 'LIVE_BROADCAST_FORBIDDEN' });
  }

  const viewer = session.viewers.get(viewerId);
  if (!viewer) {
    throw new ApiError(404, 'Viewer connection not found', { code: 'LIVE_BROADCAST_VIEWER_NOT_FOUND' });
  }

  viewer.offer = {
    id: nextId('rtc_offer'),
    type: requireString(req.body?.type, 'offer type', { maxLength: 20 }),
    sdp: requireString(req.body?.sdp, 'offer sdp', { maxLength: 200000 }),
    createdAt: nowIso(),
  };
  session.updatedAt = nowIso();

  return ok(res, { viewerId, offerId: viewer.offer.id });
});

const postBroadcastAnswer = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const viewerId = requireString(req.params.viewerId, 'viewer id');
  const session = getBroadcastSession(liveClassId);
  if (!session) {
    throw new ApiError(404, 'Broadcast session not found', { code: 'LIVE_BROADCAST_NOT_FOUND' });
  }

  const viewer = session.viewers.get(viewerId);
  if (!viewer || viewer.userId !== req.user?.id) {
    throw new ApiError(404, 'Viewer connection not found', { code: 'LIVE_BROADCAST_VIEWER_NOT_FOUND' });
  }

  viewer.answer = {
    id: nextId('rtc_answer'),
    type: requireString(req.body?.type, 'answer type', { maxLength: 20 }),
    sdp: requireString(req.body?.sdp, 'answer sdp', { maxLength: 200000 }),
    createdAt: nowIso(),
  };
  viewer.lastSeenAt = nowIso();
  session.updatedAt = nowIso();

  return ok(res, { viewerId, answerId: viewer.answer.id });
});

const postBroadcastCandidate = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const viewerId = requireString(req.params.viewerId, 'viewer id');
  const role = requireString(req.body?.role, 'candidate role', { maxLength: 20 });
  const session = getBroadcastSession(liveClassId);
  if (!session) {
    throw new ApiError(404, 'Broadcast session not found', { code: 'LIVE_BROADCAST_NOT_FOUND' });
  }

  const viewer = session.viewers.get(viewerId);
  if (!viewer) {
    throw new ApiError(404, 'Viewer connection not found', { code: 'LIVE_BROADCAST_VIEWER_NOT_FOUND' });
  }

  const candidatePayload = {
    id: nextId('rtc_candidate'),
    candidate: requireString(req.body?.candidate, 'ice candidate', { maxLength: 200000 }),
    sdpMid: optionalString(req.body?.sdpMid, '', { maxLength: 120 }) || null,
    sdpMLineIndex: optionalNumber(req.body?.sdpMLineIndex, null, { min: 0, max: 100, integer: true }),
    usernameFragment: optionalString(req.body?.usernameFragment, '', { maxLength: 120 }) || null,
    createdAt: nowIso(),
  };

  if (role === 'admin') {
    if (session.adminUserId !== req.user?.id) {
      throw new ApiError(403, 'Only the active admin broadcaster can send admin ICE candidates', {
        code: 'LIVE_BROADCAST_FORBIDDEN',
      });
    }
    viewer.adminCandidates.push(candidatePayload);
  } else if (role === 'viewer') {
    if (viewer.userId !== req.user?.id) {
      throw new ApiError(403, 'Only this viewer can send viewer ICE candidates', {
        code: 'LIVE_BROADCAST_FORBIDDEN',
      });
    }
    viewer.viewerCandidates.push(candidatePayload);
    viewer.lastSeenAt = nowIso();
  } else {
    throw new ApiError(400, 'candidate role must be admin or viewer', { code: 'VALIDATION_ERROR' });
  }

  session.updatedAt = nowIso();
  return created(res, { viewerId, candidateId: candidatePayload.id });
});

const deleteLiveClass = asyncHandler(async (req, res) => {
  const deleted = await liveClassesRepository.delete(requireString(req.params.id, 'live class id'));
  if (!deleted) {
    throw new ApiError(404, 'Live class not found', { code: 'LIVE_CLASS_NOT_FOUND' });
  }

  return ok(res, { deleted: true, liveClassId: deleted._id });
});

const getLiveClassAccess = asyncHandler(async (req, res) => {
  const access = await liveClassesRepository.getAccess({
    liveClassId: requireString(req.params.id, 'live class id'),
    userId: req.user?.id || null,
  });
  return ok(res, access);
});

const streamLiveClass = asyncHandler(async (req, res) => {
  const token = requireString(req.params.token, 'live playback token');
  const payload = verifyPlaybackToken(token);

  if (!payload) {
    throw new ApiError(401, 'Live playback token is invalid or expired', { code: 'LIVE_PLAYBACK_TOKEN_INVALID' });
  }

  const activeSessionId = payload.userId
    ? await sessionRepository.getActiveSessionId(String(payload.userId), payload.sessionId || null)
    : null;
  if (payload.sessionId && activeSessionId !== payload.sessionId) {
    throw new ApiError(401, 'Live playback session is no longer active', { code: 'LIVE_PLAYBACK_SESSION_INVALID' });
  }

  if (!payload.upstreamUrl) {
    throw new ApiError(400, 'Live playback source is missing', { code: 'LIVE_PLAYBACK_SOURCE_MISSING' });
  }

  await proxyLiveAsset(req, res, payload);
});

const getLiveChat = asyncHandler(async (req, res) => {
  const liveClassId = requireString(req.params.id, 'live class id');
  const liveClass = await liveClassesRepository.findRawById(liveClassId);
  if (!liveClass) {
    throw new ApiError(404, 'Live class not found', { code: 'LIVE_CLASS_NOT_FOUND' });
  }

  await liveClassesRepository.getAccess({ liveClassId, userId: req.user?.id || null });
  const messages = await liveClassesRepository.getChat(liveClassId);
  return ok(res, messages);
});

const postLiveChat = asyncHandler(async (req, res) => {
  const { message, kind } = req.body || {};
  if (!message) {
    throw new ApiError(400, 'message is required', { code: 'VALIDATION_ERROR' });
  }

  const posted = await liveClassesRepository.postChat({
    liveClassId: requireString(req.params.id, 'live class id'),
    userId: req.user?.id,
    message,
    kind,
  });

  if (posted === null) {
    throw new ApiError(404, 'Live class not found', { code: 'LIVE_CLASS_NOT_FOUND' });
  }

  if (posted === false) {
    throw new ApiError(404, 'User not found', { code: 'USER_NOT_FOUND' });
  }

  return created(res, posted);
});

module.exports = {
  getLiveClasses,
  getAdminLiveClasses,
  getLiveClass,
  createLiveClass,
  updateLiveClass,
  startLiveClass,
  endLiveClass,
  deleteLiveClass,
  getLiveClassAccess,
  streamLiveClass,
  getLiveChat,
  postLiveChat,
  getLiveKitJoinToken,
  startBroadcastSession,
  stopBroadcastSession,
  getBroadcastAdminState,
  joinBroadcastAsViewer,
  getViewerBroadcastState,
  postBroadcastOffer,
  postBroadcastAnswer,
  postBroadcastCandidate,
};
