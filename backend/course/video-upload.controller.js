// Video Upload Controller
const fs = require('fs');
const path = require('path');
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

const uploadPath = path.join(__dirname, '../../uploads/videos');

// Ensure upload directory exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const uploadVideoToModule = asyncHandler(async (req, res) => {
  const lessonTitle = requireString(req.body?.lessonTitle, 'lessonTitle', { maxLength: 160 });
  const lessonType = optionalString(req.body?.lessonType, 'video', { maxLength: 40 });
  const durationMinutes = optionalNumber(req.body?.durationMinutes, 0, { min: 0, max: 5000 });
  const moduleName = optionalString(req.body?.moduleName, 'Untitled Module', { maxLength: 160 });
  const moduleDescription = optionalString(req.body?.moduleDescription, '', { maxLength: 1500 });
  const chapterId = optionalString(req.body?.chapterId, '', { maxLength: 120 });
  const chapterTitle = optionalString(req.body?.chapterTitle, 'Untitled Chapter', { maxLength: 160 });
  const chapterDescription = optionalString(req.body?.chapterDescription, '', { maxLength: 1500 });
  const courseId = requireString(req.params.courseId, 'courseId');
  const moduleId = requireString(req.params.moduleId, 'moduleId');

  if (!req.file) {
    throw new ApiError(400, 'No video file provided', { code: 'VIDEO_REQUIRED' });
  }

  const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
  if (!validVideoTypes.includes(req.file.mimetype)) {
    fs.unlinkSync(req.file.path);
    throw new ApiError(400, 'Invalid video format. Supported: MP4, WebM, OGG, MOV', { code: 'INVALID_VIDEO_FORMAT' });
  }

  const maxSize = 500 * 1024 * 1024;
  if (req.file.size > maxSize) {
    fs.unlinkSync(req.file.path);
    throw new ApiError(400, 'Video file too large. Max 500MB allowed', { code: 'VIDEO_TOO_LARGE' });
  }

  const videoId = `video_${Date.now()}`;
  const fileExt = path.extname(req.file.originalname);
  const filename = `${videoId}${fileExt}`;
  const finalPath = path.join(uploadPath, filename);
  fs.renameSync(req.file.path, finalPath);

  const videoMetadata = {
    id: videoId,
    title: lessonTitle,
    type: lessonType,
    videoUrl: `/uploads/videos/${filename}`,
    originalFilename: req.file.originalname,
    fileSize: req.file.size,
    mimeType: req.file.mimetype,
    uploadedAt: new Date().toISOString(),
    uploadedBy: req.user?.id || 'admin',
    durationMinutes,
    premium: req.body?.isPremium === 'true' || req.body?.isPremium === true,
  };

  const course = await coursesRepository.findById(courseId);
  if (!course) {
    fs.unlinkSync(finalPath);
    throw new ApiError(404, 'Course not found', { code: 'COURSE_NOT_FOUND' });
  }

  let targetModule = course.modules?.find((m) => m.id === moduleId);
  if (!targetModule) {
    if (!Array.isArray(course.modules)) {
      course.modules = [];
    }
    targetModule = {
      id: moduleId,
      title: moduleName,
      description: moduleDescription,
      lessons: [],
    };
    course.modules.push(targetModule);
  }

  let lessonContainer = targetModule;
  if (chapterId) {
    if (!Array.isArray(targetModule.chapters)) {
      targetModule.chapters = [];
    }

    let targetChapter = targetModule.chapters.find((chapter) => chapter.id === chapterId);
    if (!targetChapter) {
      targetChapter = {
        id: chapterId,
        title: chapterTitle,
        description: chapterDescription,
        lessons: [],
      };
      targetModule.chapters.push(targetChapter);
    }

    if (!Array.isArray(targetChapter.lessons)) {
      targetChapter.lessons = [];
    }

    lessonContainer = targetChapter;
  } else if (!Array.isArray(targetModule.lessons)) {
    targetModule.lessons = [];
  }

  lessonContainer.lessons.push(videoMetadata);
  course.updated_at = new Date().toISOString();
  await coursesRepository.updateCourseModule(courseId, course);

  return created(res, {
    message: 'Video uploaded successfully',
    video: videoMetadata,
    course,
  });
});

const deleteVideoFromModule = asyncHandler(async (req, res) => {
  const courseId = requireString(req.params.courseId, 'courseId');
  const moduleId = requireString(req.params.moduleId, 'moduleId');
  const videoId = requireString(req.params.videoId, 'videoId');

  const course = await coursesRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found', { code: 'COURSE_NOT_FOUND' });
  }

  const targetModule = course.modules?.find((m) => m.id === moduleId);
  if (!targetModule) {
    throw new ApiError(404, 'Module not found', { code: 'MODULE_NOT_FOUND' });
  }

  const videoIndex = targetModule.lessons?.findIndex((l) => l.id === videoId);
  if (videoIndex === -1 || videoIndex === undefined) {
    throw new ApiError(404, 'Video not found', { code: 'VIDEO_NOT_FOUND' });
  }

  const video = targetModule.lessons[videoIndex];
  const filePath = path.join(__dirname, '../../', video.videoUrl);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  targetModule.lessons.splice(videoIndex, 1);
  await coursesRepository.updateCourseModule(courseId, course);
  return ok(res, { message: 'Video deleted successfully' });
});

const listVideosInModule = asyncHandler(async (req, res) => {
  const courseId = requireString(req.params.courseId, 'courseId');
  const moduleId = requireString(req.params.moduleId, 'moduleId');

  const course = await coursesRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found', { code: 'COURSE_NOT_FOUND' });
  }

  const targetModule = course.modules?.find((m) => m.id === moduleId);
  if (!targetModule) {
    throw new ApiError(404, 'Module not found', { code: 'MODULE_NOT_FOUND' });
  }

  return ok(res, {
    module: targetModule,
    videos: targetModule.lessons || [],
  });
});

const getVideoMetadata = asyncHandler(async (req, res) => {
  const courseId = requireString(req.params.courseId, 'courseId');
  const moduleId = requireString(req.params.moduleId, 'moduleId');
  const videoId = requireString(req.params.videoId, 'videoId');

  const course = await coursesRepository.findById(courseId);
  if (!course) {
    throw new ApiError(404, 'Course not found', { code: 'COURSE_NOT_FOUND' });
  }

  const targetModule = course.modules?.find((m) => m.id === moduleId);
  if (!targetModule) {
    throw new ApiError(404, 'Module not found', { code: 'MODULE_NOT_FOUND' });
  }

  const video = targetModule.lessons?.find((l) => l.id === videoId);
  if (!video) {
    throw new ApiError(404, 'Video not found', { code: 'VIDEO_NOT_FOUND' });
  }

  return ok(res, video);
});

module.exports = {
  uploadVideoToModule,
  deleteVideoFromModule,
  listVideosInModule,
  getVideoMetadata,
};
