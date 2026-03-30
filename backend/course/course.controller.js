// Course Controller
const { coursesRepository } = require('../lib/repositories.js');

const getCourses = async (req, res) => {
  try {
    const courses = await coursesRepository.listForViewer(req.user?.id || null);
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getCourse = async (req, res) => {
  try {
    const course = await coursesRepository.findVisibleById(req.params.id, req.user?.id || null);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (err) {
    res.status(400).json({ message: 'Invalid course id' });
  }
};

const getCourseLessons = async (req, res) => {
  try {
    const lessons = await coursesRepository.listLessons(req.params.id, req.user?.id || null);
    res.json(lessons);
  } catch (err) {
    res.status(400).json({ message: 'Invalid course id' });
  }
};

const createCourse = async (req, res) => {
  try {
    if (!req.body?.title) {
      return res.status(400).json({ message: 'title is required' });
    }

    const course = await coursesRepository.create({
      ...req.body,
      createdBy: req.user?.id || req.body?.createdBy || null,
    });
    res.status(201).json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getCourses, getCourse, getCourseLessons, createCourse };
