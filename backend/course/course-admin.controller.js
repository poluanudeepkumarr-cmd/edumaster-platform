// Course Admin Controller - Edit, Delete, Update functionality
const { coursesRepository } = require('../lib/repositories.js');

const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    const course = await coursesRepository.findById(id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Update allowed fields
    const allowedFields = [
      'title',
      'description',
      'category',
      'exam',
      'subject',
      'instructor',
      'officialChannelUrl',
      'price',
      'validityDays',
      'level',
      'thumbnailUrl',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        course[field] = req.body[field];
      }
    });

    // Update timestamp
    course.updated_at = new Date().toISOString();
    course.lastEditedBy = req.user?.id || 'admin';

    // Save to repository
    const updatedCourse = await coursesRepository.updateCourseModule(id, course);

    res.json({
      message: 'Course updated successfully',
      course: updatedCourse,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    const course = await coursesRepository.findById(id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Check if course has enrollments (optional protection)
    if (course.enrollmentCount && course.enrollmentCount > 0) {
      return res.status(409).json({
        message: `Cannot delete course with ${course.enrollmentCount} active enrollments. Archive instead.`,
      });
    }

    // Delete videos directory for this course if exists
    const fs = require('fs');
    const path = require('path');
    const courseVideosPath = path.join(__dirname, `../../uploads/videos/course_${id}`);
    if (fs.existsSync(courseVideosPath)) {
      fs.rmSync(courseVideosPath, { recursive: true, force: true });
    }

    // Call repository delete method
    await coursesRepository.delete(id);

    res.json({
      message: 'Course deleted successfully',
      courseId: id,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const addModule = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { title, description, order } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    if (!title) {
      return res.status(400).json({ message: 'Module title is required' });
    }

    const course = await coursesRepository.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (!Array.isArray(course.modules)) {
      course.modules = [];
    }

    const newModule = {
      id: `module_${Date.now()}`,
      title,
      description: description || '',
      order: order || course.modules.length + 1,
      lessons: [],
      createdAt: new Date().toISOString(),
      createdBy: req.user?.id || 'admin',
    };

    course.modules.push(newModule);
    course.updated_at = new Date().toISOString();

    const updatedCourse = await coursesRepository.updateCourseModule(courseId, course);

    res.status(201).json({
      message: 'Module added successfully',
      module: newModule,
      course: updatedCourse,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateModule = async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;
    const { title, description, order } = req.body;

    if (!courseId || !moduleId) {
      return res.status(400).json({ message: 'Course ID and Module ID are required' });
    }

    const course = await coursesRepository.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const module = course.modules?.find((m) => m.id === moduleId);
    if (!module) {
      return res.status(404).json({ message: 'Module not found' });
    }

    // Update allowed fields
    if (title) module.title = title;
    if (description !== undefined) module.description = description;
    if (order !== undefined) module.order = order;

    module.updatedAt = new Date().toISOString();
    module.updatedBy = req.user?.id || 'admin';

    course.updated_at = new Date().toISOString();

    const updatedCourse = await coursesRepository.updateCourseModule(courseId, course);

    res.json({
      message: 'Module updated successfully',
      module,
      course: updatedCourse,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteModule = async (req, res) => {
  try {
    const { courseId, moduleId } = req.params;

    if (!courseId || !moduleId) {
      return res.status(400).json({ message: 'Course ID and Module ID are required' });
    }

    const course = await coursesRepository.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const moduleIndex = course.modules?.findIndex((m) => m.id === moduleId);
    if (moduleIndex === undefined || moduleIndex === -1) {
      return res.status(404).json({ message: 'Module not found' });
    }

    const deletedModule = course.modules[moduleIndex];

    // Delete associated videos
    if (deletedModule.lessons && Array.isArray(deletedModule.lessons)) {
      const fs = require('fs');
      const path = require('path');

      deletedModule.lessons.forEach((lesson) => {
        if (lesson.videoUrl) {
          try {
            const videoPath = path.join(__dirname, '../../', lesson.videoUrl);
            if (fs.existsSync(videoPath)) {
              fs.unlinkSync(videoPath);
            }
          } catch (err) {
            console.error(`Failed to delete video file: ${lesson.videoUrl}`, err);
          }
        }
      });
    }

    // Remove module from course
    course.modules.splice(moduleIndex, 1);
    course.updated_at = new Date().toISOString();

    const updatedCourse = await coursesRepository.updateCourseModule(courseId, course);

    res.json({
      message: 'Module deleted successfully',
      moduleId,
      course: updatedCourse,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCourseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: 'Course ID is required' });
    }

    const course = await coursesRepository.findById(id);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Add statistics
    const stats = {
      totalModules: course.modules?.length || 0,
      totalLessons: course.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0,
      totalVideos: course.modules?.reduce(
        (sum, m) => sum + (m.lessons?.filter((l) => l.type === 'video')?.length || 0),
        0
      ) || 0,
      totalEnrollments: course.enrollmentCount || 0,
    };

    res.json({
      ...course,
      stats,
    });
  } catch (err) {
    res.status(400).json({ message: 'Invalid course ID' });
  }
};

const listCoursesAdmin = async (req, res) => {
  try {
    const courses = await coursesRepository.list();

    // Enrich with stats
    const enrichedCourses = courses.map((course) => ({
      ...course,
      stats: {
        totalModules: course.modules?.length || 0,
        totalLessons: course.modules?.reduce((sum, m) => sum + (m.lessons?.length || 0), 0) || 0,
        totalEnrollments: course.enrollmentCount || 0,
      },
    }));

    res.json(enrichedCourses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  updateCourse,
  deleteCourse,
  addModule,
  updateModule,
  deleteModule,
  getCourseDetails,
  listCoursesAdmin,
};
