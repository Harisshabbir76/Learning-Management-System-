const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');
const Notification = require('../Models/Notification');
const User = require('../Models/User');
const Section = require('../Models/Section');
const Course = require('../Models/Course');
const mongoose = require('mongoose');

// Helper function to calculate recipients
const calculateRecipients = async (notificationData, schoolId) => {
  let recipientCount = 0;
  
  switch (notificationData.targetType) {
    case 'all':
      recipientCount = await User.countDocuments({ school: schoolId, isActive: true });
      break;
    
    case 'role':
      if (notificationData.targetRoles && notificationData.targetRoles.length > 0) {
        recipientCount = await User.countDocuments({
          school: schoolId,
          role: { $in: notificationData.targetRoles },
          isActive: true
        });
      }
      break;
    
    case 'specific':
      if (notificationData.specificUsers && notificationData.specificUsers.length > 0) {
        recipientCount = notificationData.specificUsers.length;
      }
      break;
    
    case 'section':
      if (notificationData.sections && notificationData.sections.length > 0) {
        const sections = await Section.find({
          _id: { $in: notificationData.sections },
          school: schoolId
        }).populate('students');
        
        sections.forEach(section => {
          recipientCount += section.students.length;
        });
      }
      break;
    
    case 'course':
      if (notificationData.courses && notificationData.courses.length > 0) {
        const courses = await Course.find({
          _id: { $in: notificationData.courses },
          school: schoolId
        }).populate('students');
        
        courses.forEach(course => {
          recipientCount += course.students.length;
        });
      }
      break;
  }
  
  return recipientCount;
};

// Helper function to send push notifications
const sendPushNotifications = async (notification, recipients) => {
  try {
    console.log(`📱 Sending push notification to ${recipients.length} recipients`);
    console.log('Notification:', {
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority
    });
    
    // Simulate push notification sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      sentCount: recipients.length,
      failedCount: 0
    };
    
  } catch (error) {
    console.error('❌ Error sending push notifications:', error);
    return {
      success: false,
      sentCount: 0,
      failedCount: recipients.length,
      error: error.message
    };
  }
};

// Create notification - Admin and Faculty with notification permission
router.post('/', 
  auth, 
  roleAuth(['admin', 'faculty'], ['send_notifications']),
  async (req, res) => {
    try {
      const {
        title,
        message,
        type,
        priority,
        targetType,
        targetRoles,
        specificUsers,
        sections,
        courses,
        deliveryMethods = {},
        scheduledFor,
        expiresAt
      } = req.body;

      // Validation
      if (!title || !message || !targetType) {
        return res.status(400).json({
          success: false,
          message: 'Title, message, and target type are required'
        });
      }

      if (targetType === 'role' && (!targetRoles || targetRoles.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Target roles are required for role-based notifications'
        });
      }

      if (targetType === 'specific' && (!specificUsers || specificUsers.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Specific users are required for user-specific notifications'
        });
      }

      if (targetType === 'section' && (!sections || sections.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Sections are required for section-based notifications'
        });
      }

      if (targetType === 'course' && (!courses || courses.length === 0)) {
        return res.status(400).json({
          success: false,
          message: 'Courses are required for course-based notifications'
        });
      }

      // Calculate total recipients
      const totalRecipients = await calculateRecipients({
        targetType,
        targetRoles,
        specificUsers,
        sections,
        courses
      }, req.user.school);

      // Determine status based on scheduling
      const isScheduled = scheduledFor && new Date(scheduledFor) > new Date();
      const status = isScheduled ? 'scheduled' : 'sent';

      const notification = new Notification({
        title,
        message,
        type: type || 'info',
        priority: priority || 'medium',
        sender: req.user._id,
        school: req.user.school,
        targetType,
        targetRoles,
        specificUsers,
        sections,
        courses,
        deliveryMethods: {
          inApp: deliveryMethods.inApp !== false, // Default to true
          push: deliveryMethods.push || false,
          email: deliveryMethods.email || false
        },
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        totalRecipients,
        status,
        sentAt: isScheduled ? null : new Date(),
        pushSent: false
      });

      await notification.save();

      // Send push notifications immediately if not scheduled and push is enabled
      if (!isScheduled && deliveryMethods.push) {
        // Get recipient user IDs for push notifications
        let recipientUserIds = [];
        
        switch (targetType) {
          case 'all':
            const allUsers = await User.find({ school: req.user.school, isActive: true }).select('_id');
            recipientUserIds = allUsers.map(user => user._id);
            break;
          case 'role':
            recipientUserIds = await User.find({
              school: req.user.school,
              role: { $in: targetRoles },
              isActive: true
            }).select('_id').then(users => users.map(user => user._id));
            break;
          case 'specific':
            recipientUserIds = specificUsers;
            break;
          case 'section':
            // This would need more complex logic to get users from sections
            break;
          case 'course':
            // This would need more complex logic to get users from courses
            break;
        }
        
        if (recipientUserIds.length > 0) {
          const pushResult = await sendPushNotifications(notification, recipientUserIds);
          
          if (pushResult.success) {
            notification.pushSent = true;
            notification.pushSentAt = new Date();
            await notification.save();
          }
        }
      }

      const populatedNotification = await Notification.findById(notification._id)
        .populate('sender', 'name email userId')
        .populate('specificUsers', 'name email userId role')
        .populate('sections', 'name sectionCode')
        .populate('courses', 'name code');

      res.status(201).json({
        success: true,
        message: 'Notification created successfully',
        data: populatedNotification
      });

    } catch (err) {
      console.error('❌ Create notification error:', err);
      res.status(500).json({
        success: false,
        message: 'Error creating notification',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Get all notifications (for management)
router.get('/', 
  auth, 
  roleAuth(['admin', 'faculty'], ['view_notifications']),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, status, targetType } = req.query;
      const skip = (page - 1) * limit;

      const filter = {
        school: req.user.school
      };
      
      if (status) filter.status = status;
      if (targetType) filter.targetType = targetType;

      const notifications = await Notification.find(filter)
        .populate('sender', 'name email userId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Notification.countDocuments(filter);

      res.json({
        success: true,
        data: notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (err) {
      console.error('❌ Get notifications error:', err);
      res.status(500).json({
        success: false,
        message: 'Error fetching notifications',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Get user's notifications
router.get('/my-notifications', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    
    console.log(`🔍 Fetching notifications for user: ${req.user._id}, role: ${req.user.role}`);

    let notifications;
    const options = { page, limit, unreadOnly: unreadOnly === 'true' };

    if (req.user.role === 'student') {
      notifications = await Notification.getUserNotifications(
        req.user._id, 
        req.user.school, 
        options
      );
    } else {
      notifications = await Notification.getStaffNotifications(
        req.user._id, 
        req.user.school, 
        options
      );
    }

    const total = await Notification.countDocuments({
      school: req.user.school,
      status: 'sent',
      isActive: true
    });

    const totalUnread = await Notification.countDocuments({
      school: req.user.school,
      status: 'sent',
      isActive: true,
      readBy: { $not: { $elemMatch: { user: req.user._id } } }
    });

    res.json({
      success: true,
      data: notifications,
      unreadCount: totalUnread,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error('❌ Get user notifications error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Mark notification as read
router.post('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead(req.user._id);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (err) {
    console.error('❌ Mark as read error:', err);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', auth, async (req, res) => {
  try {
    const userNotifications = await Notification.getUserNotifications(
      req.user._id,
      req.user.school,
      { limit: 1000, unreadOnly: true }
    );

    await Promise.all(
      userNotifications.map(notification => 
        notification.markAsRead(req.user._id)
      )
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (err) {
    console.error('❌ Mark all as read error:', err);
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

// Get notification statistics
router.get('/stats', 
  auth, 
  roleAuth(['admin', 'faculty'], ['view_notifications']),
  async (req, res) => {
    try {
      const stats = await Notification.aggregate([
        {
          $match: {
            school: mongoose.Types.ObjectId(req.user.school),
            status: 'sent'
          }
        },
        {
          $group: {
            _id: null,
            totalNotifications: { $sum: 1 },
            totalRecipients: { $sum: '$totalRecipients' },
            totalRead: { $sum: '$readCount' },
            pushNotifications: {
              $sum: {
                $cond: [{ $eq: ['$deliveryMethods.push', true] }, 1, 0]
              }
            },
            byType: {
              $push: {
                type: '$type',
                count: 1
              }
            },
            byPriority: {
              $push: {
                priority: '$priority',
                count: 1
              }
            }
          }
        }
      ]);

      res.json({
        success: true,
        data: stats[0] || {
          totalNotifications: 0,
          totalRecipients: 0,
          totalRead: 0,
          pushNotifications: 0,
          byType: [],
          byPriority: []
        }
      });

    } catch (err) {
      console.error('❌ Get stats error:', err);
      res.status(500).json({
        success: false,
        message: 'Error fetching notification statistics',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Delete notification
router.delete('/:id', 
  auth, 
  roleAuth(['admin', 'faculty'], ['manage_notifications']),
  async (req, res) => {
    try {
      const notification = await Notification.findById(req.params.id);
      
      if (!notification || notification.school.toString() !== req.user.school.toString()) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      await Notification.findByIdAndDelete(req.params.id);

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });

    } catch (err) {
      console.error('❌ Delete notification error:', err);
      res.status(500).json({
        success: false,
        message: 'Error deleting notification',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// Debug endpoint to check notifications for a specific user
router.get('/debug/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const schoolId = req.user.school;

    console.log(`🔍 Debug: Checking notifications for user ${userId} in school ${schoolId}`);

    // Get user details
    const user = await User.findById(userId)
      .populate('courses', 'name code _id')
      .populate('sections', 'name sectionCode _id');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all notifications for the school
    const allNotifications = await Notification.find({
      school: schoolId,
      status: 'sent',
      isActive: true
    })
    .populate('courses', 'name code')
    .populate('sections', 'name sectionCode')
    .sort({ createdAt: -1 });

    // Get user's notifications using the method
    const userNotifications = await Notification.getUserNotifications(userId, schoolId);

    // Check which notifications should be visible to user
    const visibleNotifications = allNotifications.filter(notification => {
      switch (notification.targetType) {
        case 'all':
          return true;
        
        case 'role':
          return notification.targetRoles?.includes(user.role);
        
        case 'specific':
          return notification.specificUsers?.some(id => id.toString() === userId);
        
        case 'section':
          const userSectionIds = user.sections?.map(s => s._id.toString()) || [];
          const notificationSectionIds = notification.sections?.map(s => s._id.toString()) || [];
          return notificationSectionIds.some(id => userSectionIds.includes(id));
        
        case 'course':
          const userCourseIds = user.courses?.map(c => c._id.toString()) || [];
          const notificationCourseIds = notification.courses?.map(c => c._id.toString()) || [];
          return notificationCourseIds.some(id => userCourseIds.includes(id));
        
        default:
          return false;
      }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          role: user.role,
          courses: user.courses,
          sections: user.sections
        },
        allNotifications: allNotifications.length,
        userNotifications: userNotifications.length,
        visibleNotifications: visibleNotifications.length,
        debug: {
          allNotifications: allNotifications.map(n => ({
            id: n._id,
            title: n.title,
            targetType: n.targetType,
            courses: n.courses?.map(c => ({ id: c._id, name: c.name })),
            sections: n.sections?.map(s => ({ id: s._id, name: s.name })),
            targetRoles: n.targetRoles
          })),
          userNotifications: userNotifications.map(n => ({
            id: n._id,
            title: n.title,
            targetType: n.targetType
          })),
          visibleNotifications: visibleNotifications.map(n => ({
            id: n._id,
            title: n.title,
            targetType: n.targetType
          }))
        }
      }
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
});


// routes/notifications.js - Add this route
router.get('/assignments/recent', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      school: req.user.school,
      type: 'assignment',
      status: 'sent',
      $or: [
        { targetType: 'all' },
        { targetType: 'role', targetRoles: req.user.role },
        { targetType: 'course', courses: { $in: req.user.courses } },
        { targetType: 'section', sections: { $in: req.user.sections } }
      ]
    })
    .populate('courses', 'name code')
    .populate('sender', 'name')
    .sort({ createdAt: -1 })
    .limit(10);

    // Mark which notifications are read by current user
    const notificationsWithReadStatus = notifications.map(notification => ({
      ...notification.toObject(),
      isReadByCurrentUser: notification.readBy.some(
        entry => entry.user.toString() === req.user._id.toString()
      )
    }));

    res.json({
      success: true,
      data: notificationsWithReadStatus
    });
  } catch (err) {
    console.error('Error fetching assignment notifications:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching assignment notifications'
    });
  }
});

module.exports = router;
