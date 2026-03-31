// Course Controller
const { coursesRepository } = require('../lib/repositories.js');
const {
  ApiError,
  asyncHandler,
  ok,
  created,
  requireString,
  optionalString,
  optionalNumber,
} = require('../lib/http.js');

const getCourses = asyncHandler(async (req, res) => {
  const courses = await coursesRepository.listForViewer(req.user?.id || null);
  return ok(res, courses);
});

const getCourse = asyncHandler(async (req, res) => {
  const courseId = requireString(req.params.id, 'course id');
  const course = await coursesRepository.findVisibleById(courseId, req.user?.id || null);
  if (!course) {
    throw new ApiError(404, 'Course not found', { code: 'COURSE_NOT_FOUND' });
  }

  return ok(res, course);
});

const getCourseLessons = asyncHandler(async (req, res) => {
  const courseId = requireString(req.params.id, 'course id');
  const lessons = await coursesRepository.listLessons(courseId, req.user?.id || null);
  return ok(res, lessons);
});

const createCourse = asyncHandler(async (req, res) => {
  const title = requireString(req.body?.title, 'title', { maxLength: 160 });
  const description = optionalString(req.body?.description, '', { maxLength: 3000 });
  const category = optionalString(req.body?.category, 'SSC JE', { maxLength: 80 });
  const exam = optionalString(req.body?.exam, category, { maxLength: 80 });
  const subject = optionalString(req.body?.subject, 'General', { maxLength: 120 });
  const instructor = optionalString(req.body?.instructor, 'EduMaster Faculty', { maxLength: 120 });
  const officialChannelUrl = optionalString(req.body?.officialChannelUrl, '', { maxLength: 500 }) || null;
  const level = optionalString(req.body?.level, 'Full Course', { maxLength: 80 });
  const thumbnailUrl = optionalString(req.body?.thumbnailUrl, '', { maxLength: 500 });
  const price = optionalNumber(req.body?.price, 0, { min: 0 });
  const validityDays = optionalNumber(req.body?.validityDays, 365, { min: 1, max: 3650, integer: true });
  const modules = Array.isArray(req.body?.modules) ? req.body.modules : [];

  const course = await coursesRepository.create({
    title,
    description,
    category,
    exam,
    subject,
    instructor,
    officialChannelUrl,
    level,
    thumbnailUrl,
    price,
    validityDays,
    modules,
    createdBy: req.user?.id || req.body?.createdBy || null,
  });
  return created(res, course);
});

module.exports = { getCourses, getCourse, getCourseLessons, createCourse };
