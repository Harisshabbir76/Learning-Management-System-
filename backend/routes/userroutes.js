const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');
const User = require('../Models/User');
const Student = require('../Models/Student');
const Teacher = require('../Models/Teacher');
const Faculty = require('../Models/Faculty');
const Admin = require('../Models/Admin');
const Section = require('../Models/section');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');



const getRoleModel = (role) => {
  switch (role) {
    case 'student': return Student;
    case 'teacher': return Teacher;
    case 'faculty': return Faculty;
    case 'admin': return Admin;
    default: return null;
  }
};

router.post('/create', auth, roleAuth(['admin', 'faculty'], ['student_affairs']), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, password, role, userId, class: sectionId, ...roleSpecificData } = req.body;

    // Validate required fields
    const requiredFields = ['name', 'email', 'password', 'role', 'userId'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate role
    const validRoles = ['student', 'teacher', 'parent', 'faculty', 'admin'];
    if (!validRoles.includes(role)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
        validRoles
      });
    }

    // Faculty with student_affairs permission can only create students
    if (req.user.role === 'faculty' && req.user.permissions?.includes('student_affairs')) {
      if (role !== 'student') {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({
          success: false,
          message: 'You can only create student accounts'
        });
      }
    }

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [{ email }, { userId }],
      school: req.user.school
    }).session(session);

    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: 'User ID or email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      userId,
      school: req.user.school,
      createdBy: req.user._id
    });

    await user.save({ session });

    // Create role-specific profile
    const RoleModel = getRoleModel(role);
    let roleProfile = null;
    
    if (RoleModel) {
      roleProfile = new RoleModel({
        user: user._id,
        ...roleSpecificData
      });
      await roleProfile.save({ session });
      user.roleProfile = roleProfile._id;
      user.roleRef = RoleModel.modelName;
      await user.save({ session });
    }

    // ✅ Add student to section if class/section is specified
    if (role === 'student' && sectionId) {
      try {
        const section = await Section.findById(sectionId).session(session);
        if (section) {
          // Check if section has capacity
          if (section.students.length >= section.capacity) {
            throw new Error(`Section "${section.name}" is at full capacity`);
          }
          
          // Check if student is already in the section
          if (section.students.includes(user._id)) {
            throw new Error('Student is already in this section');
          }
          
          // Add student to section
          section.students.push(user._id);
          await section.save({ session });
          
          // Add section to student's sections array
          user.sections.push(sectionId);
          await user.save({ session });

          console.log(`Student ${user.name} added to section ${section.name}`);
        }
      } catch (sectionError) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: sectionError.message || 'Error adding student to section'
        });
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Get the populated user with section info
    const populatedUser = await User.findById(user._id)
      .select('-password')
      .populate('school', 'name displayName')
      .populate('sections', 'name sectionCode')
      .populate('roleProfile');

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: populatedUser
    });
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    console.error('Error creating user:', err);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});



// Get all users - Only admin and faculty with student_affairs permission
router.get('/', auth, roleAuth(['admin', 'faculty'], ['student_affairs']), async (req, res) => {
  try {
    const { role, search, includeRoleData = 'false' } = req.query;
    
    const filter = { school: req.user.school };
    
    // Faculty with student_affairs permission can only view students
    if (req.user.role === 'faculty' && req.user.permissions?.includes('student_affairs')) {
      filter.role = 'student';
    } else if (role) {
      filter.role = role;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: isNaN(search) ? null : parseInt(search) }
      ].filter(Boolean);
    }

    let users = await User.find(filter)
      .select('-password')
      .populate('school', 'name displayName')
      .sort({ createdAt: -1 });

    // If includeRoleData is true, populate role-specific data
    if (includeRoleData === 'true') {
      users = await Promise.all(users.map(async (user) => {
        const populatedUser = await User.findById(user._id)
          .select('-password')
          .populate('school', 'name displayName')
          .populate('roleProfile');
        return populatedUser;
      }));
    }

    res.json({
      success: true,
      data: users
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get single user by ID - Only admin and faculty with student_affairs permission
router.get('/:id', auth, roleAuth(['admin', 'faculty'], ['student_affairs']), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('school', 'name displayName')
      .populate('roleProfile');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user belongs to the same school
    if (user.school._id.toString() !== req.user.school.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Faculty with student_affairs permission can only view students
    if (
      req.user.role === 'faculty' && 
      req.user.permissions?.includes('student_affairs') &&
      user.role !== 'student'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You can only view student accounts'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Update user - Only admin and faculty with student_affairs permission
router.put('/:id', auth, roleAuth(['admin', 'faculty'], ['student_affairs']), async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const { name, email, role, userId, ...roleSpecificData } = req.body;

    const user = await User.findById(req.params.id).session(session);
    if (!user || user.school.toString() !== req.user.school.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found or not authorized to update'
      });
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        email,
        school: req.user.school,
        _id: { $ne: user._id }
      }).session(session);

      if (existingUser) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          success: false,
          message: 'Email already in use by another user'
        });
      }
    }

    // Check if userId is already taken by another user
    if (userId && userId !== user.userId) {
      const existingUser = await User.findOne({
        userId,
        school: req.user.school,
        _id: { $ne: user._id }
      }).session(session);

      if (existingUser) {
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          success: false,
          message: 'User ID already in use by another user'
        });
      }
    }

    // Update user fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (userId) user.userId = userId;
    if (role) user.role = role;

    await user.save({ session });

    // Update role-specific profile
    if (user.roleProfile && Object.keys(roleSpecificData).length > 0) {
      const RoleModel = getRoleModel(user.role);
      if (RoleModel) {
        await RoleModel.findByIdAndUpdate(
          user.roleProfile,
          { $set: roleSpecificData },
          { new: true, runValidators: true, session }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Get the updated user
    const updatedUser = await User.findById(req.params.id)
      .select('-password')
      .populate('school', 'name displayName')
      .populate('roleProfile');

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    console.error('Error updating user:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Delete user - Only admin and faculty with student_affairs permission
router.delete('/:id', auth, roleAuth(['admin', 'faculty'], ['student_affairs']), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(req.params.id).session(session);
    if (!user || user.school.toString() !== req.user.school.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Faculty with student_affairs permission can only delete students
    if (
      req.user.role === 'faculty' && 
      req.user.permissions?.includes('student_affairs') &&
      user.role !== 'student'
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        success: false,
        message: 'You can only delete student accounts'
      });
    }

    // Delete role-specific profile
    if (user.roleProfile) {
      const RoleModel = getRoleModel(user.role);
      if (RoleModel) {
        await RoleModel.findByIdAndDelete(user.roleProfile).session(session);
      }
    }

    // Delete user
    await User.findByIdAndDelete(req.params.id).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error('Error deleting user:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// In your users route file
// In your users route file
router.get('/user-id/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { includeRoleData } = req.query;

    // Validate userId parameter
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid numeric User ID is required'
      });
    }

    const numericUserId = parseInt(userId);

    // Build query
    const query = { 
      userId: numericUserId,
      school: req.user.school // Ensure school filter
    };

    // Find user by numeric userId
    let userQuery = User.findOne(query)
      .select('name email userId role school permissions')
      .populate('school', 'name fullName');

    // If includeRoleData is true, populate role-specific data
    if (includeRoleData === 'true') {
      userQuery = userQuery.populate({
        path: 'roleProfile',
        // For teachers, populate the Teacher model specifically
        model: 'Teacher' // This ensures we get the Teacher document
      });
    }

    const user = await userQuery;

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (err) {
    console.error('Get user by ID error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


router.post('/:id/fees', auth, async (req, res) => {
  try {
    const { status, amount } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is a student
    if (user.role !== 'student') {
      return res.status(400).json({
        success: false,
        message: 'Only students have fees'
      });
    }

    const student = await Student.findOne({ user: req.params.id });
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Add to fee history
    student.feesHistory.unshift({
      amount: amount || student.fees,
      date: new Date(),
      status: status || 'paid'
    });

    await student.save();

    res.json({
      success: true,
      message: 'Fee status updated successfully',
      data: student
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// routes/userroutes.js - Add salary payment endpoint
// routes/userroutes.js - Update the salary endpoint
router.post('/:id/salary', auth, async (req, res) => {
  try {
    console.log('Salary payment request received for user:', req.params.id);
    console.log('Request body:', req.body);
    
    const { status, amount } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      console.log('User not found:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user is eligible for salary
    if (!['teacher', 'faculty', 'admin'].includes(user.role)) {
      console.log('User not eligible for salary:', user.role);
      return res.status(400).json({
        success: false,
        message: 'Only staff members have salaries'
      });
    }

    const RoleModel = getRoleModel(user.role);
    const staffMember = await RoleModel.findOne({ user: req.params.id });
    
    if (!staffMember) {
      console.log('Staff profile not found for user:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Staff profile not found'
      });
    }

    // Add to salary history
    staffMember.salaryHistory.unshift({
      amount: amount || staffMember.salary,
      date: new Date(),
      status: status || 'paid',
      paidBy: req.user._id
    });

    await staffMember.save();

    console.log('Salary payment successful for user:', req.params.id);
    
    res.json({
      success: true,
      message: 'Salary status updated successfully',
      data: staffMember
    });
  } catch (error) {
    console.error('Salary payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});




//STUDENT AFFIAR 

// Student Affairs Routes - Only for students with section data
router.get('/student_affairs/students', auth, roleAuth(['admin', 'faculty'], ['student_affairs']), async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    
    // Build filter for students only
    const filter = { 
      school: req.user.school,
      role: 'student'
    };

    // Add search filter if provided
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { userId: isNaN(search) ? null : parseInt(search) }
      ].filter(Boolean);
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get students with populated data
    const students = await User.find(filter)
      .select('-password')
      .populate('school', 'name displayName')
      .populate('sections', 'name sectionCode grade capacity students isActive')
      .populate({
        path: 'roleProfile',
        populate: {
          path: 'class',
          select: 'name sectionCode grade capacity'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: students,
      pagination: {
        current: pageNum,
        pages: Math.ceil(total / limitNum),
        total: total,
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error('Error fetching students for student affairs:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching students',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get single student for student affairs
router.get('/student_affairs/students/:id', auth, roleAuth(['admin', 'faculty'], ['student_affairs']), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID'
      });
    }

    const student = await User.findOne({
      _id: req.params.id,
      school: req.user.school,
      role: 'student'
    })
      .select('-password')
      .populate('school', 'name displayName')
      .populate('sections', 'name sectionCode grade capacity isActive')
      .populate({
        path: 'roleProfile',
        populate: {
          path: 'class',
          select: 'name sectionCode grade capacity'
        }
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: student
    });
  } catch (err) {
    console.error('Error fetching student:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching student',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Update student section assignment
router.put('/student_affairs/students/:id/section', auth, roleAuth(['admin', 'faculty'], ['student_affairs']), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { sectionId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid student ID'
      });
    }

    // Find student
    const student = await User.findOne({
      _id: req.params.id,
      school: req.user.school,
      role: 'student'
    }).session(session);

    if (!student) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // If sectionId is provided, assign student to section
    if (sectionId) {
      if (!mongoose.Types.ObjectId.isValid(sectionId)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Invalid section ID'
        });
      }

      const section = await Section.findById(sectionId).session(session);
      if (!section) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({
          success: false,
          message: 'Section not found'
        });
      }

      // Check if section has capacity
      if (section.students.length >= section.capacity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: 'Section is at full capacity'
        });
      }

      // Remove student from previous sections
      await Section.updateMany(
        { students: student._id },
        { $pull: { students: student._id } },
        { session }
      );

      // Clear student's sections
      student.sections = [];
      await student.save({ session });

      // Add student to new section
      if (!section.students.includes(student._id)) {
        section.students.push(student._id);
        await section.save({ session });
      }

      // Add section to student
      student.sections.push(sectionId);
      await student.save({ session });

      // Update student's roleProfile class if it exists
      const studentProfile = await Student.findOne({ user: student._id }).session(session);
      if (studentProfile) {
        studentProfile.class = sectionId;
        await studentProfile.save({ session });
      }
    } else {
      // Remove student from all sections
      await Section.updateMany(
        { students: student._id },
        { $pull: { students: student._id } },
        { session }
      );

      // Clear student's sections
      student.sections = [];
      await student.save({ session });

      // Clear class from student profile
      const studentProfile = await Student.findOne({ user: student._id }).session(session);
      if (studentProfile) {
        studentProfile.class = undefined;
        await studentProfile.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    // Get updated student data
    const updatedStudent = await User.findById(student._id)
      .select('-password')
      .populate('school', 'name displayName')
      .populate('sections', 'name sectionCode grade capacity')
      .populate({
        path: 'roleProfile',
        populate: {
          path: 'class',
          select: 'name sectionCode grade capacity'
        }
      });

    res.json({
      success: true,
      message: 'Student section updated successfully',
      data: updatedStudent
    });
  } catch (err) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
    console.error('Error updating student section:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating student section',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});


// Get single student for student affairs by numeric userId
router.get('/student_affairs/students/user-id/:userId', auth, roleAuth(['admin', 'faculty'], ['student_affairs']), async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId parameter
    if (!userId || isNaN(parseInt(userId))) {
      return res.status(400).json({
        success: false,
        message: 'Valid numeric Student ID is required'
      });
    }

    const numericUserId = parseInt(userId);

    const student = await User.findOne({
      userId: numericUserId,
      school: req.user.school,
      role: 'student'
    })
      .select('-password')
      .populate('school', 'name displayName')
      .populate('sections', 'name sectionCode grade capacity isActive')
      .populate({
        path: 'roleProfile',
        populate: {
          path: 'class',
          select: 'name sectionCode grade capacity'
        }
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    res.json({
      success: true,
      data: student
    });
  } catch (err) {
    console.error('Error fetching student by userId:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching student',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;