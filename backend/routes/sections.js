const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Section = require('../Models/Section');
const User = require('../Models/User');
const School = require('../Models/institure');
const mongoose = require('mongoose');

// Helper function to check section management permissions
const hasSectionManagementPermission = (user) => {
  return user.role === 'admin' || user.permissions?.includes('student_affairs');
};

// Enhanced ObjectId validation
const isValidObjectId = (id) => {
  if (!id || id === 'undefined' || id === 'null' || id === '') return false;
  return mongoose.Types.ObjectId.isValid(id);
};

// Create Section - Only admin and student_affairs
router.post('/', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasSectionManagementPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied. Requires admin role or student_affairs permission'
      });
    }

    const { name, sectionCode, description, capacity, sessionStartDate, sessionEndDate, teacher } = req.body;

    // Validation - teacher and dates are now required
    if (!name || !sectionCode || !sessionStartDate || !sessionEndDate || !teacher) {
      return res.status(400).json({ 
        success: false,
        error: 'Section name, code, session dates, and teacher are required'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.school) {
      return res.status(400).json({ 
        success: false,
        error: 'User not found or not linked to a school'
      });
    }

    // Validate dates
    const startDate = new Date(sessionStartDate);
    const endDate = new Date(sessionEndDate);
    const today = new Date();
    
    if (startDate >= endDate) {
      return res.status(400).json({ 
        success: false,
        error: 'End date must be after start date'
      });
    }
    
    if (startDate < today.setHours(0, 0, 0, 0)) {
      return res.status(400).json({ 
        success: false,
        error: 'Start date cannot be in the past'
      });
    }

    // Check if teacher exists and is actually a teacher
    const teacherUser = await User.findById(teacher);
    if (!teacherUser || teacherUser.role !== 'teacher') {
      return res.status(400).json({ 
        success: false,
        error: 'Teacher not found or invalid role'
      });
    }

    // Check if section code already exists in the same school
    const existingSection = await Section.findOne({
      sectionCode: sectionCode.toUpperCase(),
      school: user.school
    });

    if (existingSection) {
      return res.status(400).json({ 
        success: false,
        error: 'Section code already exists in this school'
      });
    }

    // Create section with dates
    const section = new Section({
      name,
      sectionCode: sectionCode.toUpperCase(),
      description,
      teacher,
      capacity: capacity || 30,
      sessionStartDate: startDate,
      sessionEndDate: endDate,
      school: user.school,
      createdBy: user._id
    });

    await section.save();

    // Populate the created section for response
    const populatedSection = await Section.findById(section._id)
      .populate('school', 'name')
      .populate('teacher', 'name email userId')
      .populate('students', 'name email userId');

    res.status(201).json({
      success: true,
      data: populatedSection,
      message: 'Section created successfully'
    });

  } catch (err) {
    console.error('Create section error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get All Sections - Role-based access
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.school) {
      return res.status(400).json({ 
        success: false,
        error: 'User not found or not linked to a school'
      });
    }

    let filter = { school: user.school };
    
    // Teachers can only see their own sections
    if (user.role === 'teacher') {
      filter.teacher = user._id;
    }
    
    // Students can only see sections they're enrolled in
    if (user.role === 'student') {
      filter.students = user._id;
      filter.isActive = true;
    }

    const sections = await Section.find(filter)
      .populate('students', 'name email userId')
      .populate('teacher', 'name email userId')
      .populate('school', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: sections,
      count: sections.length
    });

  } catch (err) {
    console.error('Get sections error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get Single Section - Role-based access
router.get('/:id', auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid section ID format'
      });
    }

    const section = await Section.findById(req.params.id)
      .populate('students', 'name email userId isActive') // Added isActive field
      .populate('teacher', 'name email userId')
      .populate('school', 'name')
      .populate('createdBy', 'name email');

    if (!section) {
      return res.status(404).json({ 
        success: false,
        error: 'Section not found'
      });
    }

    const user = await User.findById(req.user.id);
    
    // Check if section belongs to user's school
    if (section.school._id.toString() !== user.school.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'You do not have permission to access this section'
      });
    }

    // Role-specific access checks
    if (user.role === 'teacher' && section.teacher._id.toString() !== user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'You can only access your own sections'
      });
    }

    if (user.role === 'student' && !section.students.some(s => s._id.toString() === user._id.toString())) {
      return res.status(403).json({ 
        success: false,
        error: 'You can only access sections you are enrolled in'
      });
    }

    res.json({
      success: true,
      data: section
    });

  } catch (err) {
    console.error('Get section error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// Update Section - Only admin and student_affairs
router.put('/:id', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasSectionManagementPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied. Requires admin role or student_affairs permission'
      });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid section ID format'
      });
    }

    const { name, description, teacher, capacity, sessionStartDate, sessionEndDate, isActive } = req.body;

    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ 
        success: false,
        error: 'Section not found'
      });
    }

    const user = await User.findById(req.user.id);
    if (section.school.toString() !== user.school.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'You do not have permission to edit this section'
      });
    }

    // Validate dates only if they're being changed
    if (sessionStartDate) {
      const startDate = new Date(sessionStartDate);
      const today = new Date();
      
      // Only validate if the date is actually changing to a past date
      if (startDate < today.setHours(0, 0, 0, 0) && 
          startDate.getTime() !== new Date(section.sessionStartDate).getTime()) {
        return res.status(400).json({ 
          success: false,
          error: 'Start date cannot be in the past'
        });
      }
    }

    // Validate end date only if it's being changed
    if (sessionEndDate) {
      const endDate = new Date(sessionEndDate);
      
      // Compare with either the new start date (if provided) or the existing one
      const compareStartDate = sessionStartDate 
        ? new Date(sessionStartDate) 
        : new Date(section.sessionStartDate);
      
      if (compareStartDate >= endDate) {
        return res.status(400).json({ 
          success: false,
          error: 'End date must be after start date'
        });
      }
    }

    // Validate teacher if provided
    if (teacher) {
      const teacherUser = await User.findById(teacher);
      if (!teacherUser || teacherUser.role !== 'teacher') {
        return res.status(400).json({ 
          success: false,
          error: 'Teacher not found or invalid role'
        });
      }
    }

    const updates = {
      name: name || section.name,
      description: description !== undefined ? description : section.description,
      teacher: teacher || section.teacher,
      capacity: capacity || section.capacity,
      isActive: isActive !== undefined ? isActive : section.isActive
    };

    // Only update dates if provided
    if (sessionStartDate) updates.sessionStartDate = new Date(sessionStartDate);
    if (sessionEndDate) updates.sessionEndDate = new Date(sessionEndDate);

    const updatedSection = await Section.findByIdAndUpdate(
      req.params.id,
      updates,
      { 
        new: true,
        runValidators: true 
      }
    )
    .populate('students', 'name email userId')
    .populate('teacher', 'name email userId')
    .populate('school', 'name');

    res.json({
      success: true,
      data: updatedSection,
      message: 'Section updated successfully'
    });

  } catch (err) {
    console.error('Update section error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Add Students to Section - Only admin and student_affairs
router.post('/:id/students', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasSectionManagementPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied. Requires admin role or student_affairs permission'
      });
    }

    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Student IDs array is required'
      });
    }

    // Validate section ID
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid section ID format'
      });
    }

    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ 
        success: false,
        error: 'Section not found'
      });
    }

    // Check if section is active
    if (!section.isActive) {
      return res.status(400).json({ 
        success: false,
        error: 'Cannot add students to an inactive section'
      });
    }

    const user = await User.findById(req.user.id);
    if (section.school.toString() !== user.school.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'You do not have permission to modify this section'
      });
    }

    // Check if section has capacity for new students
    const availableCapacity = section.capacity - section.students.length;
    if (studentIds.length > availableCapacity) {
      return res.status(400).json({ 
        success: false,
        error: `Section can only accept ${availableCapacity} more students`
      });
    }

    // Find students by their userIds (numeric)
    const students = await User.find({
      userId: { $in: studentIds },
      role: 'student',
      school: user.school
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({ 
        success: false,
        error: 'Some student IDs are invalid or students belong to different schools'
      });
    }

    const studentObjectIds = students.map(s => s._id);
    const newStudents = studentObjectIds.filter(id => !section.students.includes(id));

    if (newStudents.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'All students are already in this section'
      });
    }

    // Add students to section
    section.students = [...section.students, ...newStudents];
    await section.save();

    // Add section to students' records
    await User.updateMany(
      { _id: { $in: newStudents } },
      { $addToSet: { sections: section._id } }
    );

    const updatedSection = await Section.findById(req.params.id)
      .populate('students', 'name email userId')
      .populate('teacher', 'name email userId');

    res.json({
      success: true,
      data: updatedSection,
      message: `${newStudents.length} students added to section successfully`
    });

  } catch (err) {
    console.error('Add students error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Remove Student from Section - Only admin and student_affairs
router.delete('/:id/students/:studentId', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasSectionManagementPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied. Requires admin role or student_affairs permission'
      });
    }

    const { id: sectionId, studentId } = req.params;

    // Validate section ID
    if (!isValidObjectId(sectionId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid section ID format'
      });
    }

    // Validate student ID
    if (!isValidObjectId(studentId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid student ID format'
      });
    }

    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({ 
        success: false,
        error: 'Section not found'
      });
    }

    const user = await User.findById(req.user.id);
    if (section.school.toString() !== user.school.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'You do not have permission to modify this section'
      });
    }

    // Remove student from section
    section.students = section.students.filter(id => id.toString() !== studentId);
    await section.save();

    // Remove section from student's record
    await User.findByIdAndUpdate(
      studentId,
      { $pull: { sections: sectionId } }
    );

    const updatedSection = await Section.findById(sectionId)
      .populate('students', 'name email userId')
      .populate('teacher', 'name email userId');

    res.json({
      success: true,
      data: updatedSection,
      message: 'Student removed from section successfully'
    });

  } catch (err) {
    console.error('Remove student error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Delete Section - Only admin and student_affairs
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasSectionManagementPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied. Requires admin role or student_affairs permission'
      });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid section ID format'
      });
    }

    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ 
        success: false,
        error: 'Section not found'
      });
    }

    const user = await User.findById(req.user.id);
    if (section.school.toString() !== user.school.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'You do not have permission to delete this section'
      });
    }

    // Remove section from all students' records
    await User.updateMany(
      { _id: { $in: section.students } },
      { $pull: { sections: section._id } }
    );

    await Section.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      data: { id: req.params.id },
      message: 'Section deleted successfully'
    });

  } catch (err) {
    console.error('Delete section error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get sections for a specific teacher
router.get('/teacher/:teacherId', auth, async (req, res) => {
  try {
    const { teacherId } = req.params;

    // Validate teacher ID
    if (!isValidObjectId(teacherId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid teacher ID format'
      });
    }

    // Check if user is authorized (teacher viewing own data or admin)
    if (req.user.role !== 'admin' && req.user._id.toString() !== teacherId) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.school) {
      return res.status(400).json({ 
        success: false,
        error: 'User not found or not linked to a school'
      });
    }

    const sections = await Section.find({
      teacher: teacherId,
      school: user.school
    })
    .populate('students', 'name email userId')
    .populate('teacher', 'name email userId')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: sections,
      count: sections.length
    });

  } catch (err) {
    console.error('Get teacher sections error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get sections for a specific student
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate student ID
    if (!isValidObjectId(studentId)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid student ID format'
      });
    }

    // Check if user is authorized (student viewing own data or admin)
    if (req.user.role !== 'admin' && req.user._id.toString() !== studentId) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied'
      });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.school) {
      return res.status(400).json({ 
        success: false,
        error: 'User not found or not linked to a school'
      });
    }

    const sections = await Section.find({
      students: studentId,
      school: user.school,
      isActive: true
    })
    .populate('teacher', 'name email userId')
    .populate('school', 'name')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: sections,
      count: sections.length
    });

  } catch (err) {
    console.error('Get student sections error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get session status for a section
router.get('/:id/session-status', auth, async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid section ID format'
      });
    }

    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ 
        success: false,
        error: 'Section not found'
      });
    }

    const user = await User.findById(req.user.id);
    if (section.school.toString() !== user.school.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'You do not have permission to access this section'
      });
    }

    const isActive = section.isSessionActive();
    const timeRemaining = isActive ? 
      Math.max(0, section.sessionEndDate - new Date()) : 0;

    res.json({
      success: true,
      data: {
        isActive,
        sessionStartDate: section.sessionStartDate,
        sessionEndDate: section.sessionEndDate,
        timeRemaining: timeRemaining, // in milliseconds
        sessionStatus: section.getSessionStatus()
      }
    });

  } catch (err) {
    console.error('Session status error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// End a session manually
router.post('/:id/end-session', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasSectionManagementPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied. Requires admin role or student_affairs permission'
      });
    }

    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid section ID format'
      });
    }

    const section = await Section.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ 
        success: false,
        error: 'Section not found'
      });
    }

    const user = await User.findById(req.user.id);
    if (section.school.toString() !== user.school.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'You do not have permission to modify this section'
      });
    }

    // End the session
    section.isActive = false;
    await section.save();

    res.json({
      success: true,
      message: 'Session ended successfully'
    });

  } catch (err) {
    console.error('End session error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get all active sessions for a school
router.get('/school/active-sessions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.school) {
      return res.status(400).json({ 
        success: false,
        error: 'User not found or not linked to a school'
      });
    }

    const activeSessions = await Section.find({
      school: user.school,
      isActive: true,
      sessionEndDate: { $gt: new Date() }
    })
    .populate('students', 'name userId')
    .populate('teacher', 'name email userId');

    res.json({
      success: true,
      data: activeSessions,
      count: activeSessions.length
    });

  } catch (err) {
    console.error('Get active sessions error:', err);
    res.status(500).json({ 
      success: false,
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;