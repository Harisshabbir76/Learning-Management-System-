const express = require('express');
const router = express.Router();
const User = require('../Models/User');
const Teacher = require('../Models/Teacher');
const Faculty = require('../Models/Faculty');
const Admin = require('../Models/Admin');
const Permission = require('../Models/Permission');
const auth = require('../middleware/auth');
const mongoose = require('mongoose');



// -------------------- GET all users with permissions --------------------
router.get('/', auth, async (req, res) => {
  try {
    // Only admins can view permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Only admins can view permissions' 
      });
    }

    // Get teachers, faculty, and admin users in the same school
    const users = await User.find({ 
      school: req.user.school,
      role: { $in: ['teacher', 'faculty', 'admin'] }
    })
    .select('userId name email role permissions createdAt')
    .sort({ userId: 1 });

    // Get permissions from role-specific collections
    const usersWithPermissions = await Promise.all(users.map(async (user) => {
      let rolePermissions = [];
      
      try {
        if (user.role === 'teacher') {
          const teacher = await Teacher.findOne({ user: user._id }).select('permissions');
          rolePermissions = teacher?.permissions || [];
        } else if (user.role === 'faculty') {
          const faculty = await Faculty.findOne({ user: user._id }).select('permissions');
          rolePermissions = faculty?.permissions || [];
        } else if (user.role === 'admin') {
          const admin = await Admin.findOne({ user: user._id }).select('privileges');
          rolePermissions = admin?.privileges || [];
        }
      } catch (err) {
        console.error(`Error fetching permissions for user ${user.userId}:`, err);
        rolePermissions = [];
      }

      // Combine user permissions with role-specific permissions
      const allPermissions = [...(user.permissions || []), ...rolePermissions];
      
      return {
        ...user.toObject(),
        permissions: allPermissions
      };
    }));

    // Filter to only show users with permissions
    const usersWithActualPermissions = usersWithPermissions.filter(user => 
      user.permissions && user.permissions.length > 0
    );

    res.json({ 
      success: true, 
      users: usersWithActualPermissions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error', 
      error: err.message 
    });
  }
});

// -------------------- GET user permissions by ID --------------------
router.get('/:userId', auth, async (req, res) => {
  try {
    // Only admins can view permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Only admins can view permissions' 
      });
    }

    const { userId } = req.params;

    const user = await User.findOne({ 
      userId: parseInt(userId), 
      school: req.user.school,
      role: { $in: ['teacher', 'faculty', 'admin'] }
    }).select('userId name email role permissions');

    if (!user) {
      return res.status(404).json({ 
        success: false,
        msg: 'User not found in your school' 
      });
    }

    // Get permissions from role-specific collection
    let rolePermissions = [];
    try {
      if (user.role === 'teacher') {
        const teacher = await Teacher.findOne({ user: user._id }).select('permissions');
        rolePermissions = teacher?.permissions || [];
      } else if (user.role === 'faculty') {
        const faculty = await Faculty.findOne({ user: user._id }).select('permissions');
        rolePermissions = faculty?.permissions || [];
      } else if (user.role === 'admin') {
        const admin = await Admin.findOne({ user: user._id }).select('privileges');
        rolePermissions = admin?.privileges || [];
      }
    } catch (err) {
      console.error(`Error fetching permissions for user ${user.userId}:`, err);
      rolePermissions = [];
    }

    // Combine permissions
    const allPermissions = [...(user.permissions || []), ...rolePermissions];

    res.json({ 
      success: true, 
      user: {
        ...user.toObject(),
        permissions: allPermissions
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error', 
      error: err.message 
    });
  }
});

// -------------------- POST assign permission --------------------
router.post('/', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Only admins can assign permissions
    if (req.user.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Only admins can assign permissions' 
      });
    }

    const { userId, permission } = req.body;
    
    if (!userId || !permission) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        msg: 'userId and permission are required' 
      });
    }

    // Validate permission value
    const validPermissions = ['student_affairs', 'accounts_office'];
    
    if (!validPermissions.includes(permission)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid permission',
        validPermissions 
      });
    }

    const user = await User.findOne({ 
      userId: parseInt(userId), 
      school: req.user.school,
      role: { $in: ['teacher', 'faculty', 'admin'] }
    }).session(session);
    
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false,
        msg: 'User not found in your school' 
      });
    }

    // Check if user already has this permission in any collection
    let existingPermission = false;
    
    // Check user collection
    if (user.permissions && user.permissions.includes(permission)) {
      existingPermission = true;
    }
    
    // Check role-specific collection
    if (!existingPermission) {
      if (user.role === 'teacher') {
        const teacher = await Teacher.findOne({ user: user._id }).session(session);
        if (teacher && teacher.permissions && teacher.permissions.includes(permission)) {
          existingPermission = true;
        }
      } else if (user.role === 'faculty') {
        const faculty = await Faculty.findOne({ user: user._id }).session(session);
        if (faculty && faculty.permissions && faculty.permissions.includes(permission)) {
          existingPermission = true;
        }
      } else if (user.role === 'admin') {
        const admin = await Admin.findOne({ user: user._id }).session(session);
        if (admin && admin.privileges && admin.privileges.includes(permission)) {
          existingPermission = true;
        }
      }
    }

    if (existingPermission) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        msg: `User ${user.name} (ID: ${user.userId}) already has the '${permission}' permission`,
        userId: user.userId
      });
    }

    // Add permission to role-specific collection
    if (user.role === 'teacher') {
      await Teacher.findOneAndUpdate(
        { user: user._id },
        { $addToSet: { permissions: permission } },
        { session, upsert: true }
      );
    } else if (user.role === 'faculty') {
      await Faculty.findOneAndUpdate(
        { user: user._id },
        { $addToSet: { permissions: permission } },
        { session, upsert: true }
      );
    } else if (user.role === 'admin') {
      await Admin.findOneAndUpdate(
        { user: user._id },
        { $addToSet: { privileges: permission } },
        { session, upsert: true }
      );
    }

    // Check if permission record already exists (active or inactive)
    const existingPermissionRecord = await Permission.findOne({
      user: user._id,
      permission: permission
    }).session(session);

    if (existingPermissionRecord) {
      // Update existing record to be active
      await Permission.findByIdAndUpdate(
        existingPermissionRecord._id,
        {
          isActive: true,
          revokedAt: null,
          grantedBy: req.user._id,
          grantedAt: new Date()
        },
        { session }
      );
    } else {
      // Create new permission record for auditing
      const permissionRecord = new Permission({
        user: user._id,
        school: req.user.school,
        permission: permission,
        grantedBy: req.user._id,
        isActive: true
      });
      await permissionRecord.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ 
      success: true,
      msg: 'Permission assigned successfully', 
      userId: user.userId
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    
    console.error(err);
    
    // Handle duplicate key error specifically
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false,
        msg: 'Permission already exists for this user',
        error: 'Duplicate permission'
      });
    }
    
    res.status(500).json({ 
      success: false,
      msg: 'Server error', 
      error: err.message 
    });
  }
});

// -------------------- DELETE remove permission --------------------
router.delete('/', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Only admins can remove permissions
    if (req.user.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Only admins can remove permissions' 
      });
    }

    const { userId, permission } = req.body;
    
    if (!userId || !permission) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        msg: 'userId and permission are required' 
      });
    }

    const user = await User.findOne({ 
      userId: parseInt(userId), 
      school: req.user.school,
      role: { $in: ['teacher', 'faculty', 'admin'] }
    }).session(session);
    
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false,
        msg: 'User not found in your school' 
      });
    }

    // Remove permission from role-specific collection
    let permissionRemoved = false;
    
    if (user.role === 'teacher') {
      const result = await Teacher.findOneAndUpdate(
        { user: user._id },
        { $pull: { permissions: permission } },
        { session }
      );
      permissionRemoved = result !== null;
    } else if (user.role === 'faculty') {
      const result = await Faculty.findOneAndUpdate(
        { user: user._id },
        { $pull: { permissions: permission } },
        { session }
      );
      permissionRemoved = result !== null;
    } else if (user.role === 'admin') {
      const result = await Admin.findOneAndUpdate(
        { user: user._id },
        { $pull: { privileges: permission } },
        { session }
      );
      permissionRemoved = result !== null;
    }

    if (!permissionRemoved) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        msg: 'User does not have this permission',
        userId: user.userId
      });
    }

    // Update permission record for auditing (mark as revoked)
    await Permission.findOneAndUpdate(
      { 
        user: user._id, 
        permission: permission
      },
      { 
        revokedAt: new Date(),
        isActive: false 
      },
      { session, upsert: true }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({ 
      success: true,
      msg: 'Permission removed successfully', 
      userId: user.userId
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    
    console.error(err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error', 
      error: err.message 
    });
  }
});


// -------------------- PUT update multiple permissions --------------------
router.put('/:userId', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Only admins can update permissions
    if (req.user.role !== 'admin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Only admins can update permissions' 
      });
    }

    const { userId } = req.params;
    const { permissions } = req.body;

    if (!permissions || !Array.isArray(permissions)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        msg: 'Permissions array is required' 
      });
    }

    // Validate permissions
    const validPermissions = ['student_affairs', 'accounts_office'];
    
    const invalidPermissions = permissions.filter(p => !validPermissions.includes(p));
    
    if (invalidPermissions.length > 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid permissions found',
        invalidPermissions,
        validPermissions 
      });
    }

    const user = await User.findOne({ 
      userId: parseInt(userId), 
      school: req.user.school,
      role: { $in: ['teacher', 'faculty', 'admin'] }
    }).session(session);
    
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ 
        success: false,
        msg: 'User not found in your school' 
      });
    }

    // Get current permissions to determine changes
    const currentPermissions = user.permissions;
    const permissionsToAdd = permissions.filter(p => !currentPermissions.includes(p));
    const permissionsToRemove = currentPermissions.filter(p => !permissions.includes(p));

    // Update user permissions
    user.permissions = permissions;
    await user.save({ session });

    // Also update the role-specific profile
    if (user.role === 'teacher') {
      await Teacher.findOneAndUpdate(
        { user: user._id },
        { permissions: permissions },
        { session }
      );
    } else if (user.role === 'faculty') {
      await Faculty.findOneAndUpdate(
        { user: user._id },
        { permissions: permissions },
        { session }
      );
    } else if (user.role === 'admin') {
      await Admin.findOneAndUpdate(
        { user: user._id },
        { privileges: permissions },
        { session }
      );
    }

    // Handle permission auditing for added permissions
    for (const permission of permissionsToAdd) {
      const permissionRecord = new Permission({
        user: user._id,
        school: req.user.school,
        permission: permission,
        grantedBy: req.user._id,
        isActive: true
      });
      await permissionRecord.save({ session });
    }

    // Handle permission auditing for removed permissions
    for (const permission of permissionsToRemove) {
      await Permission.findOneAndUpdate(
        { 
          user: user._id, 
          permission: permission, 
          isActive: true 
        },
        { 
          revokedAt: new Date(),
          isActive: false 
        },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.json({ 
      success: true,
      msg: 'Permissions updated successfully', 
      userId: user.userId, 
      permissions: user.permissions,
      changes: {
        added: permissionsToAdd,
        removed: permissionsToRemove
      }
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    
    console.error(err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error', 
      error: err.message 
    });
  }
});

// -------------------- GET permission audit log --------------------
router.get('/audit/log', auth, async (req, res) => {
  try {
    // Only admins can view audit logs
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Only admins can view audit logs' 
      });
    }

    const { page = 1, limit = 50, userId, permission } = req.query;
    
    const filter = { school: req.user.school };
    
    if (userId) {
      const user = await User.findOne({ 
        userId: parseInt(userId), 
        school: req.user.school,
        role: { $in: ['teacher', 'faculty', 'admin'] }
      });
      if (user) {
        filter.user = user._id;
      }
    }
    
    if (permission) {
      filter.permission = permission;
    }

    const auditLogs = await Permission.find(filter)
      .populate('user', 'userId name email role')
      .populate('grantedBy', 'userId name')
      .populate('school', 'name')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Permission.countDocuments(filter);

    res.json({ 
      success: true,
      auditLogs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error', 
      error: err.message 
    });
  }
});

// -------------------- GET available permissions --------------------
router.get('/meta/available', auth, async (req, res) => {
  try {
    const validPermissions = [
      {
        value: 'student_affairs',
        label: 'Student Affairs',
        description: 'Manage student records, enrollment, and academic affairs'
      },
      {
        value: 'accounts_office',
        label: 'Accounts Office',
        description: 'Manage financial transactions, fees, and billing'
      }
    ];

    res.json({ 
      success: true,
      permissions: validPermissions 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error', 
      error: err.message 
    });
  }
});

// -------------------- GET users by role with permissions --------------------
router.get('/role/:roleType', auth, async (req, res) => {
  try {
    // Only admins can view permissions
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        msg: 'Access denied. Only admins can view permissions' 
      });
    }

    const { roleType } = req.params;
    
    // Validate role type
    if (!['teacher', 'faculty', 'admin'].includes(roleType)) {
      return res.status(400).json({ 
        success: false,
        msg: 'Invalid role type. Must be "teacher", "faculty", or "admin"' 
      });
    }

    const users = await User.find({ 
      school: req.user.school,
      role: roleType
    })
    .select('userId name email role permissions createdAt')
    .sort({ userId: 1 });

    res.json({ 
      success: true, 
      users,
      role: roleType
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      msg: 'Server error', 
      error: err.message 
    });
  }
});

module.exports = router;