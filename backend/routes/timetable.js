const express = require('express');
const router = express.Router();
const Timetable = require('../Models/Timetable');
const Section = require('../Models/Section');
const Course = require('../Models/Course');
const User = require('../Models/User');
const auth = require('../middleware/auth');

// Helper function to check permissions
const hasPermission = (user) => {
  return user.role === 'admin' || user.permissions?.includes('student_affairs');
};

// Validation helper
const validateTimetableInput = (days, periodsPerDay) => {
  const errors = [];
  
  if (!days || days < 1 || days > 7) {
    errors.push('Days must be between 1 and 7');
  }
  
  if (!periodsPerDay || periodsPerDay < 1 || periodsPerDay > 12) {
    errors.push('Periods per day must be between 1 and 12');
  }
  
  return errors;
};

// Check if timetable exists for section
router.get('/check/:sectionId', auth, async (req, res) => {
  try {
    const { sectionId } = req.params;

    const timetable = await Timetable.findOne({ section: sectionId })
      .populate('section', 'name grade sectionCode');

    if (timetable) {
      return res.json({
        success: true,
        exists: true,
        data: timetable,
        msg: `Timetable already exists for ${timetable.section.name}`
      });
    }

    res.json({
      success: true,
      exists: false,
      msg: 'No timetable found for this section'
    });
  } catch (err) {
    console.error('Check timetable error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Create timetable for a section - Only admin and student_affairs
router.post('/create', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const { sectionId, days, periodsPerDay } = req.body;

    // Validate input
    const validationErrors = validateTimetableInput(days, periodsPerDay);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false,
        msg: validationErrors.join(', ') 
      });
    }

    // Check if timetable already exists for section
    const existing = await Timetable.findOne({ section: sectionId })
      .populate('section', 'name grade sectionCode');
      
    if (existing) {
      return res.status(400).json({ 
        success: false,
        data: existing,
        msg: `Timetable already exists for ${existing.section.name}. Please modify the existing timetable instead.` 
      });
    }

    // Verify section exists and belongs to user's school
    const section = await Section.findOne({ 
      _id: sectionId,
      school: req.user.school 
    });
    
    if (!section) {
      return res.status(404).json({ 
        success: false,
        msg: 'Section not found or access denied' 
      });
    }

    const timetable = new Timetable({
      section: sectionId,
      days,
      periodsPerDay,
      schedule: [] // empty initially
    });

    await timetable.save();
    
    // Populate section before returning
    await timetable.populate('section', 'name grade sectionCode');
    
    res.json({
      success: true,
      data: timetable,
      msg: 'Timetable created successfully'
    });
  } catch (err) {
    console.error('Create timetable error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Create timetable by section name - Only admin and student_affairs
router.post('/create-by-name', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const { sectionName, days, periodsPerDay } = req.body;

    // Validate input
    const validationErrors = validateTimetableInput(days, periodsPerDay);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false,
        msg: validationErrors.join(', ') 
      });
    }

    // Find section by name
    const section = await Section.findOne({ 
      name: new RegExp('^' + sectionName + '$', 'i'),
      school: req.user.school
    });
    
    if (!section) {
      return res.status(404).json({ 
        success: false,
        msg: 'Section not found' 
      });
    }

    // Check if timetable already exists for section
    const existing = await Timetable.findOne({ section: section._id })
      .populate('section', 'name grade sectionCode');
      
    if (existing) {
      return res.status(400).json({ 
        success: false,
        data: existing,
        msg: `Timetable already exists for ${existing.section.name}. Please modify the existing timetable instead.` 
      });
    }

    const timetable = new Timetable({
      section: section._id,
      days,
      periodsPerDay,
      schedule: []
    });

    await timetable.save();
    
    // Populate the section field before returning
    await timetable.populate('section', 'name grade sectionCode');
    
    res.json({
      success: true,
      data: timetable,
      msg: 'Timetable created successfully'
    });
  } catch (err) {
    console.error('Create timetable by name error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Get timetables based on user role
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('roleProfile');
    if (!user) return res.status(404).json({ 
      success: false,
      msg: 'User not found' 
    });

    let timetables = [];

    if (user.role === 'admin' || user.permissions?.includes('student_affairs')) {
      // Admin/Student Affairs: Get all timetables for the school
      const allTimetables = await Timetable.find()
        .populate({
          path: 'section',
          match: { school: user.school },
          select: 'name grade sectionCode school'
        })
        .populate('schedule.course', 'name code')
        .populate('schedule.teacher', 'name email userId')
        .sort({ 'section.name': 1 });
      timetables = allTimetables.filter(t => t.section !== null);

    } else if (user.role === 'student') {
      // Student: Get timetable for their section
      if (user.roleProfile && user.roleProfile.class) {
        const studentTimetable = await Timetable.findOne({ section: user.roleProfile.class })
          .populate('section', 'name grade sectionCode')
          .populate('schedule.course', 'name code')
          .populate('schedule.teacher', 'name email userId');
        if (studentTimetable) timetables.push(studentTimetable);
      }

    } else if (user.role === 'teacher') {
      // Teacher: Get all timetables they are part of
      const teacherTimetables = await Timetable.find({ 'schedule.teacher': user._id })
        .populate('section', 'name grade sectionCode')
        .populate('schedule.course', 'name code')
        .populate('schedule.teacher', 'name email userId');
      timetables = teacherTimetables;

    } else if (user.role === 'parent') {
      // Parent: Get timetables for their children's sections
      if (user.roleProfile && user.roleProfile.children.length > 0) {
        const children = await User.find({ _id: { $in: user.roleProfile.children } }).populate({
          path: 'roleProfile',
          populate: {
            path: 'class'
          }
        });
        
        const sectionIds = children
          .map(child => child.roleProfile?.class?._id)
          .filter(id => id);
          
        if (sectionIds.length > 0) {
          const parentTimetables = await Timetable.find({ section: { $in: sectionIds } })
            .populate('section', 'name grade sectionCode')
            .populate('schedule.course', 'name code')
            .populate('schedule.teacher', 'name email userId');
          timetables = parentTimetables;
        }
      }
    }

    res.json({ 
      success: true,
      data: timetables 
    });
  } catch (err) {
    console.error('Get timetables error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Add/Update a course in a timetable slot - Only admin and student_affairs
router.post('/assign', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const { timetableId, dayIndex, periodIndex, courseId, teacherId } = req.body;

    // Validate slot indices
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ 
        success: false,
        msg: 'Timetable not found' 
      });
    }

    if (dayIndex < 0 || dayIndex >= timetable.days) {
      return res.status(400).json({ 
        success: false,
        msg: `Invalid day index. Must be between 0 and ${timetable.days - 1}` 
      });
    }

    if (periodIndex < 0 || periodIndex >= timetable.periodsPerDay) {
      return res.status(400).json({ 
        success: false,
        msg: `Invalid period index. Must be between 0 and ${timetable.periodsPerDay - 1}` 
      });
    }

    // Check teacher conflict (is teacher already teaching at this time?)
    const conflict = await Timetable.findOne({
      _id: { $ne: timetableId },
      "schedule.dayIndex": dayIndex,
      "schedule.periodIndex": periodIndex,
      "schedule.teacher": teacherId
    });

    if (conflict) {
      return res.status(400).json({ 
        success: false,
        msg: 'Teacher already assigned to another section at this time' 
      });
    }

    // Update or insert slot
    const slotIndex = timetable.schedule.findIndex(
      (s) => s.dayIndex === dayIndex && s.periodIndex === periodIndex
    );

    if (slotIndex >= 0) {
      // Update existing
      timetable.schedule[slotIndex].course = courseId;
      timetable.schedule[slotIndex].teacher = teacherId;
    } else {
      // Insert new slot
      timetable.schedule.push({ dayIndex, periodIndex, course: courseId, teacher: teacherId });
    }

    await timetable.save();
    
    // Populate before returning
    await timetable.populate('section', 'name grade sectionCode');
    await timetable.populate('schedule.course', 'name code');
    await timetable.populate('schedule.teacher', 'name email userId');
    
    res.json({
      success: true,
      data: timetable,
      msg: 'Course assigned successfully'
    });
  } catch (err) {
    console.error('Assign course error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Update timetable structure (days, periods) - Only admin and student_affairs
router.put('/:timetableId/structure', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const { days, periodsPerDay } = req.body;

    // Validate input
    const validationErrors = validateTimetableInput(days, periodsPerDay);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        success: false,
        msg: validationErrors.join(', ') 
      });
    }

    const updatedTimetable = await Timetable.findByIdAndUpdate(
      req.params.timetableId,
      {
        $set: {
          days,
          periodsPerDay,
          schedule: [] // Clear schedule when structure changes
        }
      },
      { new: true } // Return the updated document
    ).populate('section', 'name grade sectionCode');

    if (!updatedTimetable) {
      return res.status(404).json({ 
        success: false,
        msg: 'Timetable not found' 
      });
    }

    res.json({
      success: true,
      data: updatedTimetable,
      msg: 'Timetable structure updated successfully'
    });
  } catch (err) {
    console.error('Update structure error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Get timetable for a section by ID - Only admin and student_affairs
router.get('/:sectionId', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const timetable = await Timetable.findOne({ section: req.params.sectionId })
      .populate('section', 'name grade sectionCode school')
      .populate('schedule.course', 'name code description')
      .populate('schedule.teacher', 'name email userId');

    if (!timetable) {
      return res.status(404).json({ 
        success: false,
        msg: 'No timetable for this section' 
      });
    }

    res.json({
      success: true,
      data: timetable
    });
  } catch (err) {
    console.error('Get timetable error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Delete timetable - Only admin and student_affairs
router.delete('/:timetableId', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const timetable = await Timetable.findByIdAndDelete(req.params.timetableId);
    
    if (!timetable) {
      return res.status(404).json({ 
        success: false,
        msg: 'Timetable not found' 
      });
    }

    res.json({ 
      success: true,
      msg: 'Timetable deleted successfully' 
    });
  } catch (err) {
    console.error('Delete timetable error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Clear a timetable slot - Only admin and student_affairs
router.post('/clear-slot', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const { timetableId, dayIndex, periodIndex } = req.body;

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ 
        success: false,
        msg: 'Timetable not found' 
      });
    }

    // Remove the slot from schedule
    timetable.schedule = timetable.schedule.filter(
      (s) => !(s.dayIndex === dayIndex && s.periodIndex === periodIndex)
    );

    await timetable.save();
    
    // Populate before returning
    await timetable.populate('section', 'name grade sectionCode');
    await timetable.populate('schedule.course', 'name code');
    await timetable.populate('schedule.teacher', 'name email userId');
    
    res.json({
      success: true,
      data: timetable,
      msg: 'Slot cleared successfully'
    });
  } catch (err) {
    console.error('Clear slot error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Clear a timetable slot by section name - Only admin and student_affairs
router.post('/clear-slot-by-section', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const { sectionName, dayIndex, periodIndex } = req.body;

    // Find section by name
    const section = await Section.findOne({ 
      name: new RegExp('^' + sectionName + '$', 'i'),
      school: req.user.school
    });
    
    if (!section) {
      return res.status(404).json({ 
        success: false,
        msg: 'Section not found' 
      });
    }

    const timetable = await Timetable.findOne({ section: section._id });
    if (!timetable) {
      return res.status(404).json({ 
        success: false,
        msg: 'Timetable not found' 
      });
    }

    // Remove the slot from schedule
    timetable.schedule = timetable.schedule.filter(
      (s) => !(s.dayIndex === dayIndex && s.periodIndex === periodIndex)
    );

    await timetable.save();
    
    // Populate before returning
    await timetable.populate('section', 'name grade sectionCode');
    await timetable.populate('schedule.course', 'name code');
    await timetable.populate('schedule.teacher', 'name email userId');
    
    res.json({
      success: true,
      data: timetable,
      msg: 'Slot cleared successfully'
    });
  } catch (err) {
    console.error('Clear slot by section error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Get timetable for a section by name - Only admin and student_affairs
router.get('/section/:sectionName', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const sectionName = decodeURIComponent(req.params.sectionName);
    
    // Find the section by name
    const section = await Section.findOne({ 
      $or: [
        { name: new RegExp('^' + sectionName + '$', 'i') },
        { name: new RegExp('^' + sectionName.replace(/-/g, ' ') + '$', 'i') },
        { name: new RegExp('^' + sectionName.replace(/ /g, '-') + '$', 'i') },
        { name: new RegExp('^' + sectionName.replace(/-/g, '') + '$', 'i') },
        { name: new RegExp('^' + sectionName.replace(/ /g, '') + '$', 'i') }
      ],
      school: req.user.school
    });
    
    if (!section) {
      return res.status(404).json({ 
        success: false,
        msg: 'Section not found' 
      });
    }

    // Find timetable for this section
    const timetable = await Timetable.findOne({ section: section._id })
      .populate('section', 'name grade sectionCode school')
      .populate('schedule.course', 'name code description')
      .populate('schedule.teacher', 'name email userId');

    if (!timetable) {
      return res.status(404).json({ 
        success: false,
        msg: 'No timetable for this section' 
      });
    }

    res.json({
      success: true,
      data: timetable
    });
  } catch (err) {
    console.error('Get timetable by section name error:', err);
    res.status(500).json({ 
      success: false,
      msg: err.message 
    });
  }
});

// Check if a section exists by name - Only admin and student_affairs
router.get('/check-section/:sectionName', auth, async (req, res) => {
  try {
    // Check permissions
    if (!hasPermission(req.user)) {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Requires admin or student_affairs permission' 
      });
    }

    const sectionName = decodeURIComponent(req.params.sectionName);

    const section = await Section.findOne({
      $or: [
        { name: new RegExp('^' + sectionName + '$', 'i') },
        { name: new RegExp('^' + sectionName.replace(/-/g, ' ') + '$', 'i') },
        { name: new RegExp('^' + sectionName.replace(/ /g, '-') + '$', 'i') },
        { name: new RegExp('^' + sectionName.replace(/-/g, '') + '$', 'i') },
        { name: new RegExp('^' + sectionName.replace(/ /g, '') + '$', 'i') }
      ],
      school: req.user.school
    });

    if (!section) {
      return res.json({ 
        success: false, 
        msg: 'Section not found' 
      });
    }

    res.json({ 
      success: true, 
      data: section 
    });
  } catch (err) {
    console.error('Check section error:', err);
    res.status(500).json({ 
      success: false, 
      msg: err.message 
    });
  }
});

module.exports = router;  