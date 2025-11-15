const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');
const Course = require('../Models/Course');
const User = require('../Models/User');
const School = require('../Models/institure');
const Section = require('../Models/Section');
const mongoose = require('mongoose');

// Helper functions
const hasCourseManagementPermission = (user) => {
  if (user.role === 'admin') return true;
  if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) return true;
  if (user.role === 'teacher' && user.permissions?.includes('manage_courses')) return true;
  return false;
};

const validateSchoolAccess = (user, targetSchoolId) => {
  if (user.role === 'admin') return true;
  const userSchoolStr = user.school?.toString();
  const targetSchoolStr = targetSchoolId?.toString();
  return userSchoolStr === targetSchoolStr;
};

// Standard error response
const errorResponse = (res, status, message, details = null) => {
  return res.status(status).json({
    success: false,
    error: message,
    ...(details && process.env.NODE_ENV === 'development' && { details })
  });
};

// Create Course - Admin and Faculty with student_affairs permission
router.post('/', 
  auth, 
  roleAuth(['admin', 'faculty'], ['student_affairs']),
  async (req, res) => {
  try {
    const { name, description, teacherIds, code, sectionId, isActive = true } = req.body;

    if (!name) {
      return errorResponse(res, 400, 'Course name is required');
    }

    if (!teacherIds || teacherIds.length === 0) {
      return errorResponse(res, 400, 'At least one teacher is required');
    }

    if (!sectionId) {
      return errorResponse(res, 400, 'Section is required');
    }

    // Verify section exists and belongs to the same school
    const section = await Section.findOne({
      _id: sectionId,
      school: req.user.school
    });

    if (!section) {
      return errorResponse(res, 400, 'Invalid section or section does not belong to your school');
    }

    // Verify all teachers exist and belong to the same school
    const teachers = await User.find({
      _id: { $in: teacherIds },
      role: 'teacher',
      school: req.user.school
    });

    if (teachers.length !== teacherIds.length) {
      return errorResponse(res, 400, 'Invalid teacher IDs or school mismatch');
    }

    // Check if course code already exists
    if (code) {
      const existingCourse = await Course.findOne({ 
        code, 
        school: req.user.school 
      });
      if (existingCourse) {
        return errorResponse(res, 400, 'Course code already exists');
      }
    }

    // Make sure req.user._id is properly set - use req.user.id as fallback
    const createdById = req.user._id || req.user.id;
    if (!createdById) {
      return errorResponse(res, 400, 'User authentication error - missing user ID');
    }

    const course = new Course({
      name,
      description,
      code,
      teachers: teacherIds,
      section: sectionId,
      school: req.user.school,
      createdBy: createdById,
      isActive
    });

    await course.save();

    // Update teachers' courses
    await User.updateMany(
      { _id: { $in: teacherIds } },
      { $addToSet: { courses: course._id } }
    );

    // Update school's courses
    await School.findByIdAndUpdate(
      req.user.school,
      { $addToSet: { courses: course._id } }
    );

    const populatedCourse = await Course.findById(course._id)
      .populate('teachers', 'name email userId')
      .populate('school', 'name')
      .populate('section', 'name sectionCode')
      .populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: populatedCourse,
      message: 'Course created successfully'
    });

  } catch (err) {
    console.error('Create course error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});

// In your courses router
router.get('/', auth, async (req, res) => {
  try {
    let filter = { school: req.user.school };
    
    // Apply role-specific filters (existing code)
    switch (req.user.role) {
      // ... existing code
    }

    const courses = await Course.find(filter)
      .populate('teachers', 'name email userId role')
      .populate('students', 'name email userId')
      .populate('school', 'name')
      .populate({
        path: 'section',
        populate: {
          path: 'students',
          select: 'name email userId'
        }
      })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: courses,
      count: courses.length
    });

  } catch (err) {
    console.error('Get courses error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});

// Get Single Course - Role-based access
// GET course by id with section + students
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate({
        path: 'section',
        populate: {
          path: 'students',
          select: 'name email', // only return required fields
        },
      })
      .populate('teacher', 'name email'); // optional if you also want teacher details

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Update Course - Admin and Faculty with student_affairs permission
router.put('/:id', 
  auth, 
  roleAuth(['admin', 'faculty'], ['student_affairs']),
  async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 400, 'Invalid course ID format');
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return errorResponse(res, 404, 'Course not found');
    }

    if (!validateSchoolAccess(req.user, course.school)) {
      return errorResponse(res, 403, 'Access denied to this course');
    }

    const { name, description, teacherIds, sectionId, isActive } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (sectionId) {
      // Verify section exists and belongs to the same school
      const section = await Section.findOne({
        _id: sectionId,
        school: course.school
      });

      if (!section) {
        return errorResponse(res, 400, 'Invalid section or section does not belong to your school');
      }
      updates.section = sectionId;
    }
    if (isActive !== undefined) updates.isActive = isActive;

    // Handle teacher updates
    if (teacherIds) {
      const newTeacherIds = teacherIds.map(id => id.toString());
      const oldTeacherIds = course.teachers.map(t => t.toString());

      const removedTeachers = oldTeacherIds.filter(id => !newTeacherIds.includes(id));
      const addedTeachers = newTeacherIds.filter(id => !oldTeacherIds.includes(id));

      if (removedTeachers.length > 0) {
        await User.updateMany(
          { _id: { $in: removedTeachers } },
          { $pull: { courses: course._id } }
        );
      }

      if (addedTeachers.length > 0) {
        // Verify new teachers belong to the same school
        const newTeachers = await User.find({
          _id: { $in: addedTeachers },
          school: course.school,
          role: 'teacher'
        });

        if (newTeachers.length !== addedTeachers.length) {
          return errorResponse(res, 400, 'Invalid teacher IDs or school mismatch');
        }

        await User.updateMany(
          { _id: { $in: addedTeachers } },
          { $addToSet: { courses: course._id } }
        );
      }

      updates.teachers = newTeacherIds;
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      updates,
      { 
        new: true,
        runValidators: true 
      }
    )
    .populate('teachers', 'name email userId')
    .populate('school', 'name')
    .populate('section', 'name sectionCode')
    .populate('createdBy', 'name email');

    res.json({
      success: true,
      data: updatedCourse,
      message: 'Course updated successfully'
    });

  } catch (err) {
    console.error('Update course error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});

// Delete Course - Admin only
router.delete('/:id', 
  auth, 
  roleAuth(['admin']),
  async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return errorResponse(res, 400, 'Invalid course ID format');
    }

    const course = await Course.findById(req.params.id);
    if (!course) {
      return errorResponse(res, 404, 'Course not found');
    }

    if (!validateSchoolAccess(req.user, course.school)) {
      return errorResponse(res, 403, 'Access denied to this course');
    }

    // Remove course from teachers and students
    await User.updateMany(
      { 
        $or: [
          { _id: { $in: course.teachers } },
          { _id: { $in: course.students } }
        ]
      },
      { $pull: { courses: course._id } }
    );

    // Remove course from school
    await School.findByIdAndUpdate(
      course.school,
      { $pull: { courses: course._id } }
    );

    await Course.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      data: { id: req.params.id },
      message: 'Course deleted successfully'
    });

  } catch (err) {
    console.error('Delete course error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});

// Add Student to Course - Admin and Faculty with student_affairs permission
router.post('/:courseId/students', 
  auth, 
  roleAuth(['admin', 'faculty'], ['student_affairs']),
  async (req, res) => {
  try {
    const { courseId } = req.params;
    const { studentId } = req.body;

    if (!studentId) {
      return errorResponse(res, 400, 'Student ID is required');
    }

    const course = await Course.findById(courseId).populate('school');
    if (!course) {
      return errorResponse(res, 404, 'Course not found');
    }

    if (!validateSchoolAccess(req.user, course.school)) {
      return errorResponse(res, 403, 'Access denied to this course');
    }

    let student;
    // First try to find by numeric userId
    const numericId = parseInt(studentId);
    if (!isNaN(numericId)) {
      student = await User.findOne({ 
        userId: numericId,
        role: 'student'
      });
    }
    
    // If not found by numeric ID, try by MongoDB ObjectId
    if (!student && mongoose.Types.ObjectId.isValid(studentId)) {
      student = await User.findById(studentId);
    }

    if (!student) {
      return errorResponse(res, 404, 'Student not found');
    }

    if (student.role !== 'student') {
      return errorResponse(res, 400, 'User is not a student');
    }

    if (!validateSchoolAccess(student, course.school._id)) {
      return errorResponse(res, 400, 'Student belongs to a different school');
    }

    if (course.students.includes(student._id)) {
      return errorResponse(res, 400, 'Student is already enrolled');
    }

    course.students.push(student._id);
    await course.save();

    await User.findByIdAndUpdate(
      student._id,
      { $addToSet: { courses: course._id } }
    );

    const updatedCourse = await Course.findById(courseId)
      .populate('students', 'name email userId')
      .populate('teachers', 'name email')
      .populate('school', 'name')
      .populate('section', 'name sectionCode');

    res.json({
      success: true,
      data: updatedCourse,
      message: 'Student enrolled successfully'
    });

  } catch (err) {
    console.error('Enroll student error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});

// Remove Student from Course - Admin and Faculty with student_affairs permission
router.delete('/:courseId/students/:studentId', 
  auth, 
  roleAuth(['admin', 'faculty'], ['student_affairs']),
  async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return errorResponse(res, 404, 'Course not found');
    }

    if (!validateSchoolAccess(req.user, course.school)) {
      return errorResponse(res, 403, 'Access denied to this course');
    }

    let studentObjectId;
    if (mongoose.Types.ObjectId.isValid(studentId)) {
      studentObjectId = studentId;
    } else {
      const student = await User.findOne({ userId: parseInt(studentId) });
      if (!student) {
        return errorResponse(res, 404, 'Student not found');
      }
      studentObjectId = student._id;
    }

    if (!course.students.includes(studentObjectId)) {
      return errorResponse(res, 400, 'Student is not enrolled in this course');
    }

    await Course.findByIdAndUpdate(
      courseId,
      { $pull: { students: studentObjectId } }
    );

    await User.findByIdAndUpdate(
      studentObjectId,
      { $pull: { courses: courseId } }
    );

    const updatedCourse = await Course.findById(courseId)
      .populate('students', 'name email userId')
      .populate('teachers', 'name email')
      .populate('school', 'name')
      .populate('section', 'name sectionCode');

    res.json({
      success: true,
      data: updatedCourse,
      message: 'Student removed successfully'
    });

  } catch (err) {
    console.error('Remove student error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});

// Get Course Students - Role-based access
router.get('/:courseId/students', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId)
      .populate('students', 'name email userId class')
      .populate('school', 'name')
      .populate('teachers', 'name email')
      .populate('section', 'name sectionCode');

    if (!course) {
      return errorResponse(res, 404, 'Course not found');
    }

    // Check school access
    if (!validateSchoolAccess(req.user, course.school)) {
      return errorResponse(res, 403, 'Access denied');
    }

    // Role-specific access checks
    switch (req.user.role) {
      case 'teacher':
        if (!course.teachers.some(t => t._id.toString() === req.user._id.toString()) &&
            !req.user.permissions?.includes('view_all_courses')) {
          return errorResponse(res, 403, 'Access denied');
        }
        break;
      
      case 'student':
        if (!course.students.some(s => s._id.toString() === req.user._id.toString())) {
          return errorResponse(res, 403, 'Access denied');
        }
        break;
      
      case 'faculty':
        if (!req.user.permissions?.includes('student_affairs') && 
            !req.user.permissions?.includes('view_all_courses')) {
          return errorResponse(res, 403, 'Access denied');
        }
        break;
    }

    res.json({
      success: true,
      data: course.students,
      count: course.students.length
    });

  } catch (err) {
    console.error('Get course students error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});

// Get courses for a specific teacher
router.get('/teacher/:teacherId', auth, async (req, res) => {
  try {
    const { teacherId } = req.params;

    if (req.user.role !== 'admin' && req.user._id.toString() !== teacherId) {
      return errorResponse(res, 403, 'Access denied');
    }

    const courses = await Course.find({
      teachers: teacherId,
      school: req.user.school
    })
    .populate('students', 'name email userId')
    .populate('school', 'name')
    .populate('section', 'name sectionCode')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: courses,
      count: courses.length
    });

  } catch (err) {
    console.error('Get teacher courses error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});

// Get courses for a specific student
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (req.user.role !== 'admin' && req.user._id.toString() !== studentId) {
      return errorResponse(res, 403, 'Access denied');
    }

    const courses = await Course.find({
      students: studentId,
      school: req.user.school,
      isActive: true
    })
    .populate('teachers', 'name email userId')
    .populate('school', 'name')
    .populate('section', 'name sectionCode')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: courses,
      count: courses.length
    });

  } catch (err) {
    console.error('Get student courses error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});

// Get courses by section
router.get('/section/:sectionId', auth, async (req, res) => {
  try {
    const { sectionId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sectionId)) {
      return errorResponse(res, 400, 'Invalid section ID format');
    }

    // Verify section belongs to user's school
    const section = await Section.findOne({
      _id: sectionId,
      school: req.user.school
    });

    if (!section) {
      return errorResponse(res, 404, 'Section not found or access denied');
    }

    const courses = await Course.find({
      section: sectionId,
      school: req.user.school
    })
    .populate('teachers', 'name email userId')
    .populate('students', 'name email userId')
    .populate('section', 'name sectionCode')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: courses,
      count: courses.length
    });

  } catch (err) {
    console.error('Get courses by section error:', err);
    errorResponse(res, 500, 'Server error', err.message);
  }
});





// GET /api/courses/:courseId/enrollments
// GET /api/courses/:courseId/enrollments
router.get('/:courseId/enrollments', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId)
      .populate('students', 'name email userId userNumericId')
      .populate('teachers', 'name email userId userNumericId');
    
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Permission: admin or teacher of this course
    if (user.role !== 'admin') {
      const isTeacherOfCourse = course.teachers.some(t => 
        t._id.toString() === user._id.toString()
      );
      if (!isTeacherOfCourse) {
        return res.status(403).json({ 
          success: false, 
          message: 'Only course teachers or admins can view enrollment data' 
        });
      }
    }

    // Return the complete course object with populated students
    res.json({ 
      success: true, 
      data: course // Return the entire course object, not just students
    });
  } catch (err) {
    console.error('Get enrollments error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



// In your courses routes
// Get teachers for a specific course
router.get('/:courseId/teachers', auth, async (req, res) => {
  try {
    const { courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid course ID' 
      });
    }

    const course = await Course.findById(courseId)
      .populate('teachers', 'name email userId')
      .populate('school', 'name');

    if (!course) {
      return res.status(404).json({ 
        success: false, 
        message: 'Course not found' 
      });
    }

    // Check school access
    if (!validateSchoolAccess(req.user, course.school)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied' 
      });
    }

    res.json({
      success: true,
      data: course.teachers,
      count: course.teachers.length
    });

  } catch (err) {
    console.error('Get course teachers error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Check if timetable exists for section when creating course
router.get('/check-timetable/:sectionId', auth, async (req, res) => {
  try {
    const { sectionId } = req.params;

    const timetable = await Timetable.findOne({ section: sectionId })
      .populate('section', 'name grade sectionCode');

    res.json({
      success: true,
      exists: !!timetable,
      data: timetable || null,
      message: timetable ? 
        `Timetable already exists for ${timetable.section.name}` : 
        'No timetable found for this section'
    });

  } catch (err) {
    console.error('Check timetable error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;
