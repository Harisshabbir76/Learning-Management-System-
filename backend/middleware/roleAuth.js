const User = require('../Models/User'); // Add this import

const roleAuth = (allowedRoles = [], allowedPermissions = []) => {
  return async (req, res, next) => {
    try {
      // Check if user is authenticated first
      if (!req.user) {
        return res.status(401).json({ 
          success: false,
          error: 'Authentication required' 
        });
      }

      const user = await User.findById(req.user._id || req.user.id);
      
      if (!user) {
        return res.status(401).json({ 
          success: false,
          error: 'User not found' 
        });
      }

      // Check role
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          success: false,
          error: `Access denied. Required roles: ${allowedRoles.join(', ')}` 
        });
      }

      // Check permissions (skip for admin users)
      if (allowedPermissions.length > 0 && user.role !== 'admin') {
        const hasPermission = allowedPermissions.some(permission => 
          user.permissions?.includes(permission)
        );
        
        if (!hasPermission) {
          return res.status(403).json({ 
            success: false,
            error: `Access denied. Required permissions: ${allowedPermissions.join(', ')}` 
          });
        }
      }

      req.currentUser = user;
      next();
    } catch (err) {
      console.error('Role auth error:', err);
      res.status(500).json({ 
        success: false,
        error: 'Authentication error' 
      });
    }
  };
};

module.exports = roleAuth;