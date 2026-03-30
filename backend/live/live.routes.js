const express = require('express');
const controller = require('./live.controller.js');
const { requireAuth } = require('../middleware/auth.js');

const router = express.Router();

router.get('/', controller.getLiveClasses);
router.get('/:id', controller.getLiveClass);
router.get('/:id/chat', controller.getLiveChat);
router.post('/:id/chat', requireAuth, controller.postLiveChat);

module.exports = router;
