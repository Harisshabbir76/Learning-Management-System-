const express = require('express');
const router = express.Router();
const DueDateConfig = require('../Models/DueDateConfig');
const auth = require('../middleware/auth');

// Get due date configuration
router.get('/', auth, async (req, res) => {
  try {
    const config = await DueDateConfig.getConfig();
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update due date configuration
router.post('/', auth, async (req, res) => {
  try {
    const { dayOfMonth } = req.body;
    
    let config = await DueDateConfig.findOne();
    
    if (!config) {
      config = new DueDateConfig({ dayOfMonth });
    } else {
      config.dayOfMonth = dayOfMonth;
    }

    await config.save();

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Manual reset of all payments
router.post('/reset-now', auth, async (req, res) => {
  try {
    // Import models
    const Student = require('../Models/Student');
    const Teacher = require('../Models/Teacher');
    const Faculty = require('../Models/Faculty');
    const Admin = require('../Models/Admin');
    
    console.log('Manually resetting all payments...');
    
    // Reset student fees
    const students = await Student.find().populate('user');
    for (const student of students) {
      student.feesHistory.unshift({
        amount: student.fees || 0,
        date: new Date(),
        status: 'pending'
      });
      await student.save();
    }
    
    // Reset staff salaries
    const teachers = await Teacher.find().populate('user');
    for (const teacher of teachers) {
      teacher.salaryHistory.unshift({
        amount: teacher.salary || 0,
        date: new Date(),
        status: 'pending'
      });
      await teacher.save();
    }
    
    const faculty = await Faculty.find().populate('user');
    for (const facultyMember of faculty) {
      facultyMember.salaryHistory.unshift({
        amount: facultyMember.salary || 0,
        date: new Date(),
        status: 'pending'
      });
      await facultyMember.save();
    }
    
    const admins = await Admin.find().populate('user');
    for (const admin of admins) {
      admin.salaryHistory.unshift({
        amount: admin.salary || 0,
        date: new Date(),
        status: 'pending'
      });
      await admin.save();
    }
    
    // Update due date config
    const config = await DueDateConfig.getConfig();
    config.lastApplied = new Date();
    await config.save();
    
    res.json({
      success: true,
      message: `All payments reset to pending for ${students.length} students, ${teachers.length} teachers, ${faculty.length} faculty, and ${admins.length} admins`
    });
  } catch (error) {
    console.error('Error in manual reset:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;