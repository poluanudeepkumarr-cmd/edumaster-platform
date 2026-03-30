const express = require('express');
const { getCourses, getCourse, getCourseLessons, createCourse } = require('./course.controller.js');
const { requireAuth, attachAuthIfPresent } = require('../middleware/auth.js');
const { requireAdmin } = require('../middleware/admin.js');
const router = express.Router();

router.get('/', attachAuthIfPresent, getCourses);
router.get('/:id', attachAuthIfPresent, getCourse);
router.get('/:id/lessons', attachAuthIfPresent, getCourseLessons);
router.post('/', requireAuth, requireAdmin, createCourse);

module.exports = router;
