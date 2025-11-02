const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const School = require('../Models/institure');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/logos');
  },
  filename: (req, file, cb) => {
    const filename = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, filename);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Error handling for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB'
      });
    }
  }
  res.status(400).json({
    success: false,
    message: err.message
  });
};

// Get all schools - Public access (no auth required)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      select: 'name displayName logoUrl themeColor address phone email website establishedYear',
      sort: { createdAt: -1 }
    };

    const schools = await School.paginate(filter, options);
    
    res.json({
      success: true,
      data: schools.docs,
      pagination: {
        page: schools.page,
        limit: schools.limit,
        total: schools.totalDocs,
        pages: schools.totalPages
      }
    });
  } catch (err) {
    console.error('Error fetching schools:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching schools',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get single school - Public access (no auth required)
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid school ID format'
      });
    }

    const school = await School.findById(req.params.id)
      .populate('courses', 'name description code teachers students')
      .populate('createdBy', 'name email userId role')
      .lean();

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    res.status(200).json({
      success: true,
      data: school
    });
  } catch (err) {
    console.error('Error fetching school:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Upload logo - Only admin and faculty with student_affairs permission
router.post('/logo', 
  authMiddleware, 
  roleAuth(['admin', 'faculty'], ['student_affairs']),
  upload.single('logo'), 
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Logo uploaded successfully',
      filePath: `/uploads/logos/${req.file.filename}`,
      fileName: req.file.filename
    });
  },
  handleMulterError
);

// Create school - Only admin and faculty with student_affairs permission
router.post('/', 
  authMiddleware, 
  roleAuth(['admin', 'faculty'], ['student_affairs']),
  async (req, res) => {
    try {
      const requiredFields = ['name', 'displayName', 'address', 'phone', 'email'];
      const missingFields = requiredFields.filter(field => !req.body[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      // Check if school name already exists
      const existingSchool = await School.findOne({ 
        name: { $regex: new RegExp(`^${req.body.name}$`, 'i') } 
      });
      
      if (existingSchool) {
        return res.status(409).json({
          success: false,
          message: 'School name already exists'
        });
      }

      const schoolData = {
        name: req.body.name.trim(),
        displayName: req.body.displayName.trim(),
        address: req.body.address.trim(),
        phone: req.body.phone.trim(),
        email: req.body.email.toLowerCase().trim(),
        website: req.body.website?.trim() || '',
        logoUrl: req.body.logoUrl?.trim() || '',
        themeColor: req.body.themeColor || '#3b82f6',
        description: req.body.description?.trim() || '',
        establishedYear: req.body.establishedYear || new Date().getFullYear(),
        createdBy: req.user._id
      };

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(schoolData.email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      const school = new School(schoolData);
      await school.save();

      const populatedSchool = await School.findById(school._id)
        .populate('createdBy', 'name email userId');

      res.status(201).json({
        success: true,
        message: 'School created successfully',
        data: populatedSchool
      });
    } catch (err) {
      console.error('Error creating school:', err);
      
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
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Update school - Only admin and faculty with student_affairs permission
router.put('/:id', 
  authMiddleware, 
  roleAuth(['admin', 'faculty'], ['student_affairs']),
  async (req, res) => {
    try {
      const schoolId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(schoolId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid school ID format'
        });
      }

      const {
        name,
        displayName,
        address,
        phone,
        email,
        website,
        themeColor,
        description,
        establishedYear
      } = req.body;

      // Basic validation
      const requiredFields = { name, displayName, address, phone, email };
      const missingFields = Object.entries(requiredFields)
        .filter(([_, value]) => !value)
        .map(([key]) => key);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          missingFields
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && !emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Check if school exists
      const existingSchool = await School.findById(schoolId);
      if (!existingSchool) {
        return res.status(404).json({
          success: false,
          message: 'School not found'
        });
      }

      // Check for duplicate name (excluding current school)
      if (name && name !== existingSchool.name) {
        const duplicateSchool = await School.findOne({
          name: { $regex: new RegExp(`^${name}$`, 'i') },
          _id: { $ne: schoolId }
        });
        
        if (duplicateSchool) {
          return res.status(409).json({
            success: false,
            message: 'School name already exists'
          });
        }
      }

      const updateData = {
        name: name?.trim(),
        displayName: displayName?.trim(),
        address: address?.trim(),
        phone: phone?.trim(),
        email: email?.toLowerCase().trim(),
        website: website?.trim() || '',
        themeColor: themeColor || '#3b82f6',
        description: description?.trim() || '',
        establishedYear: establishedYear ? parseInt(establishedYear) : new Date().getFullYear()
      };

      const school = await School.findByIdAndUpdate(
        schoolId,
        updateData,
        { 
          new: true,
          runValidators: true 
        }
      ).populate('createdBy', 'name email userId');

      if (!school) {
        return res.status(404).json({
          success: false,
          message: 'School not found'
        });
      }

      res.json({
        success: true,
        message: 'School updated successfully',
        data: school
      });
    } catch (err) {
      console.error('Error updating school:', err);
      
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
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Update logo - Only admin and faculty with student_affairs permission
router.patch('/:id/logo', 
  authMiddleware, 
  roleAuth(['admin', 'faculty'], ['student_affairs']),
  async (req, res) => {
    try {
      const schoolId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(schoolId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid school ID format'
        });
      }

      const { logoUrl } = req.body;

      if (!logoUrl) {
        return res.status(400).json({
          success: false,
          message: 'Logo URL is required'
        });
      }

      const school = await School.findByIdAndUpdate(
        schoolId,
        { logoUrl },
        { new: true }
      ).select('name displayName logoUrl themeColor');
      
      if (!school) {
        return res.status(404).json({
          success: false,
          message: 'School not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Logo updated successfully',
        data: school
      });
    } catch (err) {
      console.error('Error updating logo:', err);
      res.status(500).json({
        success: false,
        message: 'Error updating logo',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Delete school - Only admin
router.delete('/:id', 
  authMiddleware, 
  roleAuth(['admin']),
  async (req, res) => {
    try {
      const schoolId = req.params.id;

      if (!mongoose.Types.ObjectId.isValid(schoolId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid school ID format'
        });
      }

      const school = await School.findById(schoolId);
      if (!school) {
        return res.status(404).json({
          success: false,
          message: 'School not found'
        });
      }

      // Check if school has courses
      if (school.courses && school.courses.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete school with active courses. Please delete or transfer courses first.'
        });
      }

      await School.findByIdAndDelete(schoolId);

      res.json({
        success: true,
        message: 'School deleted successfully',
        data: { id: schoolId }
      });
    } catch (err) {
      console.error('Error deleting school:', err);
      res.status(500).json({
        success: false,
        message: 'Error deleting school',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

module.exports = router;