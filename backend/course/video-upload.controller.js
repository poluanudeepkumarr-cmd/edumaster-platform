// Video Upload Controller
const fs = require('fs');
const path = require('path');
const { coursesRepository } = require('../lib/repositories.js');

const uploadPath = path.join(__dirname, '../../uploads/videos');

// Ensure upload directory exists
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const uploadVideoToModule = async (req, res) => {
  try {
    const {
      lessonTitle,
      lessonType = 'video',
      isPremium = false,
      durationMinutes = 0,
      moduleName,
      moduleDescription = '',
    } = req.body;
    const { courseId, moduleId } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    if (!courseId || !moduleId) {
      return res.status(400).json({ message: 'courseId and moduleId are required' });
    }

    if (!lessonTitle) {
      return res.status(400).json({ message: 'lessonTitle is required' });
    }

    // Validate file is video
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (!validVideoTypes.includes(req.file.mimetype)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Invalid video format. Supported: MP4, WebM, OGG, MOV' });
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (req.file.size > maxSize) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: 'Video file too large. Max 500MB allowed' });
    }

    // Generate unique video ID and filename
    const videoId = `video_${Date.now()}`;
    const fileExt = path.extname(req.file.originalname);
    const filename = `${videoId}${fileExt}`;
    const finalPath = path.join(uploadPath, filename);

    // Move file to final location
    fs.renameSync(req.file.path, finalPath);

    // Create video metadata
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
      durationMinutes: Number(durationMinutes),
      premium: isPremium === 'true' || isPremium === true,
    };

    // Add to course module
    const course = await coursesRepository.findById(courseId);
    if (!course) {
      fs.unlinkSync(finalPath);
      return res.status(404).json({ message: 'Course not found' });
    }

    // Find or create module
    let targetModule = course.modules?.find((m) => m.id === moduleId);
    if (!targetModule) {
      if (!Array.isArray(course.modules)) {
        course.modules = [];
      }
      targetModule = {
        id: moduleId,
        title: moduleName || 'Untitled Module',
        description: moduleDescription,
        lessons: [],
      };
      course.modules.push(targetModule);
    }

    if (!Array.isArray(targetModule.lessons)) {
      targetModule.lessons = [];
    }

    // Add video as lesson
    targetModule.lessons.push(videoMetadata);

    // Update course in repository
    course.updated_at = new Date().toISOString();
    await coursesRepository.updateCourseModule(courseId, course);

    res.status(201).json({
      message: 'Video uploaded successfully',
      video: videoMetadata,
      course,
    });
  } catch (err) {
    // Cleanup file if error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: err.message });
  }
};

const deleteVideoFromModule = async (req, res) => {
  try {
    const { courseId, moduleId, videoId } = req.params;

    const course = await coursesRepository.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const targetModule = course.modules?.find((m) => m.id === moduleId);
    if (!targetModule) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const videoIndex = targetModule.lessons?.findIndex((l) => l.id === videoId);
    if (videoIndex === -1 || videoIndex === undefined) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Delete file
    const video = targetModule.lessons[videoIndex];
    const filePath = path.join(__dirname, '../../', video.videoUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from lessons array
    targetModule.lessons.splice(videoIndex, 1);

    // Update course
    await coursesRepository.updateCourseModule(courseId, course);

    res.json({ message: 'Video deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listVideosInModule = async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;

    const course = await coursesRepository.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const targetModule = course.modules?.find((m) => m.id === moduleId);
    if (!targetModule) {
      return res.status(404).json({ message: 'Module not found' });
    }

    res.json({
      module: targetModule,
      videos: targetModule.lessons || [],
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getVideoMetadata = async (req, res) => {
  try {
    const { courseId, moduleId, videoId } = req.params;

    const course = await coursesRepository.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const targetModule = course.modules?.find((m) => m.id === moduleId);
    if (!targetModule) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const video = targetModule.lessons?.find((l) => l.id === videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    res.json(video);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  uploadVideoToModule,
  deleteVideoFromModule,
  listVideosInModule,
  getVideoMetadata,
};
