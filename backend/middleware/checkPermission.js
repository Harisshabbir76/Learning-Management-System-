const checkPermission = (permission) => {
  return (req, res, next) => {
    if (req.user.role === 'admin') {
      return next(); // Admins have all permissions
    }

    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }

    res.status(403).json({
      success: false,
      msg: `Access denied. Required permission: ${permission}`
    });
  };
};

module.exports = checkPermission;