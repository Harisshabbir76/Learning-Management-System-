// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../Models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided, authorization denied'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET );
      
      // Check if user still exists
      const user = await User.findById(decoded.id || decoded._id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Token is no longer valid'
        });
      }

      // Set req.user with proper _id field
      req.user = {
        _id: user._id, // This is the critical fix
        id: user._id,
        userId: user.userId,
        role: user.role,
        school: user.school,
        permissions: user.permissions || []
      };
      
      next();
    } catch (jwtError) {
      console.error('JWT verification error:', jwtError);
      
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          expired: true
        });
      }
      
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Token verification failed'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

module.exports = authMiddleware;