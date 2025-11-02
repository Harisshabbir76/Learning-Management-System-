const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');
const Attendance = require('../Models/Attendance');
const Section = require('../Models/Section');
const User = require('../Models/User');

// Mark attendance for a section
router.post('/mark', auth, roleAuth(['teacher', 'admin']), async (req, res) => {
  try {
    const { sectionId, date, attendanceData } = req.body;
    
    // Validate section exists and teacher has access
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }
    
    // Check if teacher owns this section (unless admin)
    if (req.user.role !== 'admin' && section.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to mark attendance for this section'
      });
    }
    
    // Process attendance records
    const attendanceRecords = [];
    for (const record of attendanceData) {
      // Check if student is in the section
      if (!section.students.includes(record.studentId)) {
        continue; // Skip students not in this section
      }
      
      // Check if attendance already exists for this date
      const existingAttendance = await Attendance.findOne({
        student: record.studentId,
        date: new Date(date)
      });
      
      if (existingAttendance) {
        // Update existing record
        existingAttendance.status = record.status;
        existingAttendance.notes = record.notes || '';
        await existingAttendance.save();
        attendanceRecords.push(existingAttendance);
      } else {
        // Create new record
        const newAttendance = new Attendance({
          student: record.studentId,
          section: sectionId,
          date: new Date(date),
          status: record.status,
          recordedBy: req.user._id,
          notes: record.notes || ''
        });
        await newAttendance.save();
        attendanceRecords.push(newAttendance);
      }
    }
    
    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendanceRecords
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get attendance for a student
router.get('/student/:studentId', auth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate, sectionId } = req.query;
    
    // Check if user is authorized (student viewing own data or teacher/admin)
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own attendance'
      });
    }
    
    // Build query
    const query = { student: studentId };
    
    if (sectionId) {
      query.section = sectionId;
    }
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const attendance = await Attendance.find(query)
      .populate('section', 'name sectionCode')
      .populate('recordedBy', 'name')
      .sort({ date: -1 });
    
    // Calculate statistics
    const totalRecords = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const absentCount = attendance.filter(a => a.status === 'absent').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    const excusedCount = attendance.filter(a => a.status === 'excused').length;
    
    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        records: attendance,
        statistics: {
          total: totalRecords,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          excused: excusedCount,
          attendanceRate: attendanceRate.toFixed(2)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get attendance for a section
router.get('/section/:sectionId', auth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { date, startDate, endDate } = req.query;
    
    // Check if user is authorized (teacher of section or admin)
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }
    
    if (req.user.role !== 'admin' && section.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view attendance for this section'
      });
    }
    
    // Build query
    const query = { section: sectionId };
    
    if (date) {
      query.date = new Date(date);
    } else if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const attendance = await Attendance.find(query)
      .populate('student', 'name userId')
      .populate('recordedBy', 'name')
      .sort({ date: -1 });
    
    // Get section statistics if date range is provided
    let sectionStatistics = null;
    if (startDate && endDate) {
      const students = await User.find({ _id: { $in: section.students } });
      
      sectionStatistics = await Promise.all(students.map(async (student) => {
        const studentAttendance = await Attendance.find({
          section: sectionId,
          student: student._id,
          date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        });
        
        const totalRecords = studentAttendance.length;
        const presentCount = studentAttendance.filter(a => a.status === 'present').length;
        const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;
        
        return {
          student: {
            _id: student._id,
            name: student.name,
            userId: student.userId
          },
          total: totalRecords,
          present: presentCount,
          absent: studentAttendance.filter(a => a.status === 'absent').length,
          late: studentAttendance.filter(a => a.status === 'late').length,
          excused: studentAttendance.filter(a => a.status === 'excused').length,
          attendanceRate: attendanceRate.toFixed(2)
        };
      }));
    }
    
    res.json({
      success: true,
      data: {
        section: section,
        records: attendance,
        statistics: sectionStatistics
      }
    });
  } catch (error) {
    console.error('Error fetching section attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching section attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get attendance summary for admin dashboard
router.get('/summary', auth, roleAuth(['admin']), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date query
    const dateQuery = {};
    if (startDate && endDate) {
      dateQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Get all sections with their attendance data
    const sections = await Section.find()
      .populate('teacher', 'name')
      .populate('students', 'name userId');
    
    const sectionSummaries = await Promise.all(sections.map(async (section) => {
      const attendanceRecords = await Attendance.find({
        section: section._id,
        ...dateQuery
      });
      
      const totalPossible = section.students.length * (attendanceRecords.length / section.students.length || 0);
      const presentCount = attendanceRecords.filter(a => a.status === 'present').length;
      const overallAttendanceRate = totalPossible > 0 ? (presentCount / totalPossible) * 100 : 0;
      
      return {
        section: {
          _id: section._id,
          name: section.name,
          sectionCode: section.sectionCode,
          teacher: section.teacher
        },
        totalStudents: section.students.length,
        totalRecords: attendanceRecords.length,
        overallAttendanceRate: overallAttendanceRate.toFixed(2)
      };
    }));
    
    res.json({
      success: true,
      data: sectionSummaries
    });
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching attendance summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get today's attendance for a section
router.get('/section/:sectionId/today', auth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    
    // Check if user is authorized (teacher of section or admin)
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }
    
    if (req.user.role !== 'admin' && section.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view attendance for this section'
      });
    }
    
    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const attendance = await Attendance.find({
      section: sectionId,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    })
    .populate('student', 'name userId')
    .populate('recordedBy', 'name');
    
    res.json({
      success: true,
      data: {
        section: section,
        records: attendance,
        date: today
      }
    });
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching today\'s attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get attendance for a student in a specific section
router.get('/student/:studentId/section/:sectionId', auth, async (req, res) => {
  try {
    const { studentId, sectionId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Check if user is authorized (student viewing own data or teacher/admin)
    if (req.user.role === 'student' && req.user._id.toString() !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own attendance'
      });
    }
    
    // Check if student is in the section
    const section = await Section.findById(sectionId);
    if (!section || !section.students.includes(studentId)) {
      return res.status(404).json({
        success: false,
        message: 'Student not found in this section'
      });
    }
    
    // Build query
    const query = { 
      student: studentId,
      section: sectionId
    };
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const attendance = await Attendance.find(query)
      .populate('section', 'name sectionCode')
      .populate('recordedBy', 'name')
      .sort({ date: -1 });
    
    // Calculate statistics
    const totalRecords = attendance.length;
    const presentCount = attendance.filter(a => a.status === 'present').length;
    const attendanceRate = totalRecords > 0 ? (presentCount / totalRecords) * 100 : 0;
    
    res.json({
      success: true,
      data: {
        student: studentId,
        section: section,
        records: attendance,
        statistics: {
          total: totalRecords,
          present: presentCount,
          absent: attendance.filter(a => a.status === 'absent').length,
          late: attendance.filter(a => a.status === 'late').length,
          excused: attendance.filter(a => a.status === 'excused').length,
          attendanceRate: attendanceRate.toFixed(2)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching student section attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching student section attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});



router.get('/section/:sectionId/statistics', auth, async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { startDate, endDate } = req.query;
    
    console.log('Statistics request received for section:', sectionId);
    console.log('Date range:', startDate, 'to', endDate);
    
    // Check if user is authorized (teacher of section or admin)
    const section = await Section.findById(sectionId).populate('students', 'name userId');
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }
    
    if (req.user.role !== 'admin' && section.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view attendance for this section'
      });
    }
    
    // Build date query
    const dateQuery = { section: sectionId };
    if (startDate && endDate) {
      dateQuery.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    console.log('Date query:', dateQuery);
    
    // Get all attendance records for this section and date range
    const allAttendance = await Attendance.find(dateQuery)
      .populate('student', 'name userId')
      .lean();
    
    console.log('Found', allAttendance.length, 'attendance records');
    
    // Get statistics for each student
    const statistics = await Promise.all(section.students.map(async (student) => {
      // Filter attendance records for this specific student
      const studentAttendance = allAttendance.filter(record => 
        record.student && record.student._id.toString() === student._id.toString()
      );
      
      console.log(`Student ${student.name}: ${studentAttendance.length} records`);
      
      const totalRecords = studentAttendance.length;
      const presentCount = studentAttendance.filter(a => a.status === 'present').length;
      const absentCount = studentAttendance.filter(a => a.status === 'absent').length;
      const lateCount = studentAttendance.filter(a => a.status === 'late').length;
      const excusedCount = studentAttendance.filter(a => a.status === 'excused').length;
      
      const attendanceRate = totalRecords > 0 ? 
        Math.round((presentCount / totalRecords) * 100) : 0;
      
      return {
        student: {
          _id: student._id,
          name: student.name,
          userId: student.userId
        },
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        excused: excusedCount,
        attendanceRate: attendanceRate,
        totalRecords: totalRecords
      };
    }));
    
    console.log('Statistics calculated:', statistics);
    
    res.json({
      success: true,
      data: {
        section: {
          _id: section._id,
          name: section.name,
          sectionCode: section.sectionCode
        },
        statistics: statistics,
        dateRange: {
          start: startDate,
          end: endDate
        }
      }
    });
  } catch (error) {
    console.error('Error fetching section statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching section statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Mark attendance for a section (updated to use studentId)
router.post('/mark', auth, roleAuth(['teacher', 'admin']), async (req, res) => {
  try {
    const { sectionId, date, attendanceData } = req.body;
    
    console.log('Mark attendance request:', { sectionId, date, attendanceData });
    
    // Validate section exists and teacher has access
    const section = await Section.findById(sectionId);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }
    
    // Check if teacher owns this section (unless admin)
    if (req.user.role !== 'admin' && section.teacher.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to mark attendance for this section'
      });
    }
    
    // Process attendance records
    const attendanceRecords = [];
    for (const record of attendanceData) {
      // Check if student is in the section
      if (!section.students.includes(record.studentId)) {
        console.log('Student not in section:', record.studentId);
        continue;
      }
      
      // Check if attendance already exists for this date
      const existingAttendance = await Attendance.findOne({
        student: record.studentId,
        date: new Date(date),
        section: sectionId
      });
      
      if (existingAttendance) {
        // Update existing record
        existingAttendance.status = record.status;
        existingAttendance.notes = record.notes || '';
        existingAttendance.recordedBy = req.user._id;
        await existingAttendance.save();
        attendanceRecords.push(existingAttendance);
        console.log('Updated existing attendance:', existingAttendance._id);
      } else {
        // Create new record
        const newAttendance = new Attendance({
          student: record.studentId,
          section: sectionId,
          date: new Date(date),
          status: record.status,
          recordedBy: req.user._id,
          notes: record.notes || ''
        });
        await newAttendance.save();
        attendanceRecords.push(newAttendance);
        console.log('Created new attendance:', newAttendance._id);
      }
    }
    
    res.json({
      success: true,
      message: 'Attendance marked successfully',
      data: attendanceRecords
    });
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


module.exports = router;