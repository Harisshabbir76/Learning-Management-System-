const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../Models/User');
const Course = require('../Models/Course');
const School = require('../Models/institure');
const authMiddleware = require('../middleware/auth');
const Student = require('../Models/Student');
const Teacher = require('../Models/Teacher');
const Faculty = require('../Models/Faculty');
const Admin = require('../Models/Admin.js');
const multer = require('multer');
const fs = require('fs'); // Add this import
const path = require('path'); // Add this import

const router = express.Router();

const generateToken = (user) => {
  const payload = {
    id: user._id, // Consistent 'id' field
    email: user.email,
    role: user.role,
    schoolId: user.school,
    userId: user.userId
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'secretkey', {
    expiresIn: '7d'
  });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/logos';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// ✅ SIGNUP ROUTE - UPDATED TO USE generateToken
router.post("/signup", upload.single('logo'), async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();

    const {
      name, email, password,
      schoolName, displayName, contactEmail, phone,
      website, themeColor, description,
      establishedYear, schoolAddress, userId
    } = req.body;

    const logoUrl = req.file ? `/uploads/logos/${req.file.filename}` : '';

    // Validate all required fields
    const requiredFields = ['name', 'email', 'password', 'schoolName', 'contactEmail', 'schoolAddress', 'userId'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: "Missing required fields",
        missingFields
      });
    }

    // Parse and validate userId format
    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId) || numericUserId < 1000 || numericUserId > 999999) {
      if (req.file) fs.unlinkSync(req.file.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: "User ID must be a number between 1000 and 999999" 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (req.file) fs.unlinkSync(req.file.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: "Invalid email format" 
      });
    }

    if (!emailRegex.test(contactEmail)) {
      if (req.file) fs.unlinkSync(req.file.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: "Invalid school email format" 
      });
    }

    // Check if school exists
    const existingSchool = await School.findOne({ 
      $or: [{ email: contactEmail }, { name: schoolName }] 
    }).session(session);
    
    if (existingSchool) {
      if (req.file) fs.unlinkSync(req.file.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: "School already exists with this email or name" 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { userId: numericUserId }] 
    }).session(session);
    
    if (existingUser) {
      if (req.file) fs.unlinkSync(req.file.path);
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        message: "User already exists with this email or user ID" 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create school
    const school = new School({
      name: schoolName,
      displayName: displayName || schoolName,
      email: contactEmail,
      address: schoolAddress,
      phone: phone || '',
      website: website || '',
      logoUrl,
      themeColor: themeColor || '#3b82f6',
      description: description || '',
      establishedYear: establishedYear || new Date().getFullYear(),
    });
    await school.save({ session });

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      userId: numericUserId,
      role: 'admin',
      school: school._id,
    });
    await user.save({ session });

    // Update school with createdBy reference
    school.createdBy = user._id;
    await school.save({ session });

    // Create admin profile
    const adminProfile = new Admin({
      user: user._id,
      privileges: ['all_permissions'],
      designation: 'School Administrator'
    });
    await adminProfile.save({ session });
    
    // Update user with role profile reference
    user.roleProfile = adminProfile._id;
    user.roleRef = 'Admin';
    await user.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    // ✅ USE generateToken FOR CONSISTENT TOKEN FORMAT
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: "Signup successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.userId,
        school: school._id
      },
      school: {
        _id: school._id,
        name: school.name,
        displayName: school.displayName
      }
    });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    
    console.error("Signup error:", error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ 
        success: false,
        message: "Validation failed",
        errors 
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: "User or school with these details already exists" 
      });
    }

    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({ 
        success: false,
        message: "Only image files are allowed for logo" 
      });
    }

    res.status(500).json({ 
      success: false,
      message: "Signup failed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ✅ LOGIN ROUTE - UPDATED TO USE generateToken
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find base user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Fetch role-specific profile
    let profile = null;
    if (user.role === 'student') {
      profile = await Student.findOne({ user: user._id });
    } else if (user.role === 'teacher') {
      profile = await Teacher.findOne({ user: user._id });
    } else if (user.role === 'faculty') {
      profile = await Faculty.findOne({ user: user._id });
    } else if (user.role === 'admin') {
      profile = await Admin.findOne({ user: user._id });
    }

    // ✅ USE generateToken FOR CONSISTENT TOKEN FORMAT
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.userId,
        school: user.school
      },
      profile
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login' 
    });
  }
});

// ✅ REFRESH TOKEN ROUTE - UPDATED TO USE generateToken
router.post('/refresh', authMiddleware, async (req, res) => {
  try {
    // Get fresh user data
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('school', 'name displayName');
      
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // ✅ USE generateToken FOR CONSISTENT TOKEN FORMAT
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.userId,
        school: user.school
      }
    });
  } catch (err) {
    console.error('Token refresh error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error during token refresh'
    });
  }
});

// ✅ TOKEN VALIDATION ENDPOINT
router.get('/validate-token', authMiddleware, async (req, res) => {
  try {
    // Get fresh user data from database
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('school', 'name displayName themeColor logoUrl');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: 'User not found'
      });
    }

    res.json({ 
      success: true,
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.userId,
        school: user.school
      }
    });
  } catch (err) {
    console.error('Token validation error:', err);
    res.status(500).json({ 
      success: false,
      valid: false,
      message: 'Token validation failed' 
    });
  }
});


// ✅ Get Current User - Fixed response format
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password')
      .populate('school', 'name displayName themeColor logoUrl');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Fetch role-specific profile based on user role
    let profile = null;
    const roleModels = {
      'student': require('../Models/Student'),
      'teacher': require('../Models/Teacher'),
      'faculty': require('../Models/Faculty'),
      'admin': require('../Models/Admin')
    };

    if (roleModels[user.role]) {
      profile = await roleModels[user.role].findOne({ user: user._id });
    }

    res.json({ 
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        userId: user.userId,
        school: user.school
      },
      profile 
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
});


// Get user dashboard data
// routes/auth-route.js
router.get('/:schoolId/:userId/dashboard', authMiddleware, async (req, res) => {
  try {
    const { schoolId, userId } = req.params;

    // Convert userId to number
    const numericUserId = parseInt(userId);
    if (isNaN(numericUserId)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid user ID format' 
      });
    }

    const user = await User.findOne({
      userId: numericUserId, // Query with number
      school: schoolId
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found in this school' 
      });
    }

    // Auth check
    if (req.user._id.toString() !== user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Unauthorized access' 
      });
    }

    res.json({
      success: true,
      data: { message: `Dashboard for user ${numericUserId} in school ${schoolId}` }
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});


// Get school info for logged-in user
router.get('/school-info', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'school',
      select: '_id name displayName address email phone website logoUrl themeColor description establishedYear',
      populate: {
        path: 'createdBy',
        select: 'name email userId'
      }
    });

    if (!user || !user.school) {
      return res.status(404).json({
        success: false,
        message: 'School information not found'
      });
    }

    res.json({
      success: true,
      school: user.school
    });
  } catch (err) {
    console.error('Error fetching school info:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching school info'
    });
  }
});


router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Validate input
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }
    
    // Find user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if email is already taken by another user
    const existingUser = await User.findOne({ 
      email, 
      _id: { $ne: user._id },
      school: user.school
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already in use by another account'
      });
    }
    
    // Update user
    user.name = name;
    user.email = email;
    
    await user.save();
    
    // Return updated user without password
    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate('school', 'name displayName');
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error('Profile update error:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

module.exports = router;