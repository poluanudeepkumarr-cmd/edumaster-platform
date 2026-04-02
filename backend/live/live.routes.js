const express = require('express');
const controller = require('./live.controller.js');
const { requireAuth } = require('../middleware/auth.js');
const { requireAdmin } = require('../middleware/admin.js');

const router = express.Router();

router.get('/stream/:token', controller.streamLiveClass);
router.get('/admin/list', requireAuth, requireAdmin, controller.getAdminLiveClasses);
router.post('/', requireAuth, requireAdmin, controller.createLiveClass);
router.post('/:id/start', requireAuth, requireAdmin, controller.startLiveClass);
router.post('/:id/end', requireAuth, requireAdmin, controller.endLiveClass);
router.get('/:id/livekit/token', requireAuth, controller.getLiveKitJoinToken);
router.post('/:id/broadcast/session', requireAuth, requireAdmin, controller.startBroadcastSession);
router.delete('/:id/broadcast/session', requireAuth, requireAdmin, controller.stopBroadcastSession);
router.get('/:id/broadcast/admin/state', requireAuth, requireAdmin, controller.getBroadcastAdminState);
router.post('/:id/broadcast/viewers', requireAuth, controller.joinBroadcastAsViewer);
router.get('/:id/broadcast/viewers/:viewerId', requireAuth, controller.getViewerBroadcastState);
router.post('/:id/broadcast/viewers/:viewerId/offer', requireAuth, requireAdmin, controller.postBroadcastOffer);
router.post('/:id/broadcast/viewers/:viewerId/answer', requireAuth, controller.postBroadcastAnswer);
router.post('/:id/broadcast/viewers/:viewerId/candidates', requireAuth, controller.postBroadcastCandidate);
router.put('/:id', requireAuth, requireAdmin, controller.updateLiveClass);
router.delete('/:id', requireAuth, requireAdmin, controller.deleteLiveClass);
router.get('/', controller.getLiveClasses);
router.get('/:id/access', requireAuth, controller.getLiveClassAccess);
router.get('/:id', controller.getLiveClass);
router.get('/:id/chat', requireAuth, controller.getLiveChat);
router.post('/:id/chat', requireAuth, controller.postLiveChat);

module.exports = router;
