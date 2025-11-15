const express = require('express');
const router = express.Router();
const Notification = require('../Models/Notification');
const User = require('../Models/User');
const Course = require('../Models/Course');
const Section = require('../Models/section');
const authMiddleware = require('../middleware/auth');
const roleAuth = require('../middleware/roleAuth');

let io;

function setIO(socketioInstance) {
  io = socketioInstance;
}

// Middleware to ensure io is initialized
const checkIO = (req, res, next) => {
  if (!io) {
    return res.status(503).json({ 
      success: false,
      message: 'Socket.IO not initialized' 
    });
  }
  next();
};

// Enhanced function to process and send notifications
const processAndSendNotification = async (notification) => {
  if (!io) {
    console.error('❌ Socket.IO not initialized');
    return 0;
  }

  try {
    let deliveredCount = 0;

    // Emit to all recipients
    notification.recipients.forEach(recipientId => {
      const recipientStr = recipientId.toString();
      const userRoom = io.sockets.adapter.rooms.get(recipientStr);
      const isConnected = userRoom && userRoom.size > 0;

      if (isConnected) {
        io.to(recipientStr).emit('newNotification', {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          createdAt: notification.createdAt,
          sender: notification.sender,
          category: notification.category,
          priority: notification.priority,
          recipientType: notification.recipientType
        });
        deliveredCount++;
        console.log(`📤 Notification sent to user ${recipientStr}`);
      }
    });

    notification.status = 'sent';
    notification.metadata = {
      ...notification.metadata,
      socketDelivery: {
        delivered: deliveredCount,
        total: notification.recipients.length,
        deliveredAt: new Date(),
        onlineRecipients: deliveredCount
      }
    };
    
    await notification.save();
    
    console.log(`✅ Notification ${notification._id} processed. Delivered to ${deliveredCount}/${notification.recipients.length} users via Socket.IO`);
    
    return deliveredCount;
  } catch (error) {
    console.error('❌ Error processing notification:', error);
    notification.status = 'failed';
    notification.metadata = {
      ...notification.metadata,
      error: error.message,
      failedAt: new Date()
    };
    await notification.save();
    return 0;
  }
};

// Health check for notifications route
router.get('/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'Notifications API is working',
    socketStatus: io ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Send notification
router.post('/send', authMiddleware, roleAuth(['admin']), checkIO, async (req, res) => {
  const { 
    title, 
    message, 
    recipientType, 
    recipientIds = [], 
    scheduledFor, 
    priority = 'medium',
    category = 'general',
    metadata = {}
  } = req.body;
  
  const senderId = req.user.id;

  try {
    // Validate required fields
    if (!title || !message || !recipientType) {
      return res.status(400).json({ 
        success: false,
        message: 'Title, message, and recipient type are required' 
      });
    }

    let recipients = [];
    let recipientDetails = {};

    switch (recipientType) {
      case 'all_teachers':
        const teachers = await User.find({ role: 'teacher' }).select('_id');
        recipients = teachers.map(t => t._id);
        break;
      case 'all_students':
        const students = await User.find({ role: 'student' }).select('_id');
        recipients = students.map(s => s._id);
        break;
      case 'course_students':
        if (!recipientIds.length) {
          return res.status(400).json({ 
            success: false,
            message: 'Course ID is required' 
          });
        }
        const course = await Course.findById(recipientIds[0]).populate('students', '_id');
        if (!course) {
          return res.status(404).json({ 
            success: false,
            message: 'Course not found' 
          });
        }
        recipients = course.students.map(s => s._id);
        recipientDetails.courseId = recipientIds[0];
        recipientDetails.courseName = course.name;
        break;
      case 'class_students':
        if (!recipientIds.length) {
          return res.status(400).json({ 
            success: false,
            message: 'Class ID is required' 
          });
        }
        const section = await Section.findById(recipientIds[0]).populate('students', '_id');
        if (!section) {
          return res.status(404).json({ 
            success: false,
            message: 'Class not found' 
          });
        }
        recipients = section.students.map(s => s._id);
        recipientDetails.sectionId = recipientIds[0];
        recipientDetails.sectionName = section.name;
        break;
      case 'specific_user':
        if (!recipientIds.length) {
          return res.status(400).json({ 
            success: false,
            message: 'User ID is required' 
          });
        }
        // Validate users exist
        const users = await User.find({ _id: { $in: recipientIds } }).select('_id name role');
        if (users.length !== recipientIds.length) {
          return res.status(404).json({ 
            success: false,
            message: 'One or more users not found' 
          });
        }
        recipients = recipientIds;
        recipientDetails.userIds = recipientIds;
        recipientDetails.userNames = users.map(u => ({ id: u._id, name: u.name, role: u.role }));
        break;
      case 'all_employees':
        const employees = await User.find({ 
          role: { $in: ['admin', 'teacher', 'staff'] } 
        }).select('_id');
        recipients = employees.map(e => e._id);
        break;
      default:
        return res.status(400).json({ 
          success: false,
          message: 'Invalid recipient type' 
        });
    }

    if (recipients.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'No recipients found for the specified criteria' 
      });
    }

    const notificationData = {
      title: title.trim(),
      message: message.trim(),
      sender: senderId,
      recipients,
      recipientType,
      recipientDetails,
      priority,
      category,
      metadata: {
        ...metadata,
        senderInfo: {
          id: req.user.id,
          name: req.user.name,
          role: req.user.role
        },
        recipientCount: recipients.length
      },
      status: scheduledFor ? 'scheduled' : 'sent',
      scheduledFor: scheduledFor || null,
    };

    const notification = new Notification(notificationData);
    await notification.save();

    // Populate sender info for response
    await notification.populate('sender', 'name email avatar');

    let deliveryResult = null;
    if (notification.status === 'sent') {
      deliveryResult = await processAndSendNotification(notification);
    }

    res.status(201).json({ 
      success: true,
      message: `Notification ${notification.status} successfully`, 
      notification,
      delivery: deliveryResult ? {
        delivered: deliveryResult,
        total: recipients.length,
        offline: recipients.length - deliveryResult
      } : null
    });
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send notification',
      error: error.message 
    });
  }
});

// Get user's notifications with pagination and filtering
router.get('/my-notifications', authMiddleware, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      unreadOnly = false,
      category,
      priority,
      startDate,
      endDate,
      search 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const userId = req.user.id;

    let query = { recipients: userId };

    if (unreadOnly === 'true') {
      query['readBy.user'] = { $ne: userId };
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (priority && priority !== 'all') {
      query.priority = priority;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const totalNotifications = await Notification.countDocuments(query);

    const notifications = await Notification.find(query)
      .populate('sender', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Add isRead status for each notification
    const notificationsWithReadStatus = notifications.map(notification => {
      const isRead = notification.readBy && notification.readBy.some(read => 
        read.user && read.user.toString() === userId.toString()
      );
      return {
        ...notification,
        isRead: !!isRead,
        read: !!isRead // For backward compatibility
      };
    });

    const unreadCount = await Notification.countDocuments({
      recipients: userId,
      $or: [
        { readBy: { $eq: [] } },
        { 'readBy.user': { $ne: userId } }
      ]
    });

    res.json({
      success: true,
      data: notificationsWithReadStatus,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalNotifications / parseInt(limit)),
        totalNotifications,
        hasNext: parseInt(page) * parseInt(limit) < totalNotifications,
        hasPrev: parseInt(page) > 1
      },
      unreadCount
    });
  } catch (error) {
    console.error('❌ Error fetching user notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// Mark notification as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    
    if (!notification) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }

    // Check if user is a recipient
    if (!notification.recipients.includes(req.user.id)) {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    await notification.markAsRead(req.user.id);

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification: await Notification.findById(req.params.id).populate('sender', 'name email avatar')
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// Mark all notifications as read
router.post('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await Notification.updateMany(
      { 
        recipients: userId,
        $or: [
          { readBy: { $eq: [] } },
          { 'readBy.user': { $ne: userId } }
        ]
      },
      { 
        $push: { 
          readBy: { user: userId, readAt: new Date() } 
        } 
      }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

// Get notification statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const totalNotifications = await Notification.countDocuments({ recipients: userId });
    const unreadCount = await Notification.countDocuments({ 
      recipients: userId,
      $or: [
        { readBy: { $eq: [] } },
        { 'readBy.user': { $ne: userId } }
      ]
    });
    
    const categoryStats = await Notification.aggregate([
      { $match: { recipients: userId } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const priorityStats = await Notification.aggregate([
      { $match: { recipients: userId } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: {
        total: totalNotifications,
        unread: unreadCount,
        read: totalNotifications - unreadCount,
        byCategory: categoryStats,
        byPriority: priorityStats
      }
    });
  } catch (error) {
    console.error('❌ Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification statistics',
      error: error.message
    });
  }
});

// Get notification by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('sender', 'name email avatar')
      .populate('recipients', 'name email role');

    if (!notification) {
      return res.status(404).json({ 
        success: false,
        message: 'Notification not found' 
      });
    }

    // Check if user is a recipient or admin
    if (!notification.recipients.includes(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false,
        message: 'Access denied' 
      });
    }

    // Mark as read if viewing for the first time
    const isRead = notification.readBy && notification.readBy.some(read => 
      read.user && read.user.toString() === req.user.id.toString()
    );
    
    if (!isRead) {
      await notification.markAsRead(req.user.id);
    }

    res.json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('❌ Error fetching notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification',
      error: error.message
    });
  }
});

// Test notification endpoint (for development)
router.post('/test/send', authMiddleware, roleAuth(['admin']), checkIO, async (req, res) => {
  try {
    const { userId } = req.body;
    const senderId = req.user.id;

    const testNotification = new Notification({
      title: 'Test Notification',
      message: 'This is a test notification to verify the notification system is working properly.',
      sender: senderId,
      recipients: [userId || senderId], // Send to specified user or self
      recipientType: 'specific_user',
      priority: 'medium',
      category: 'general',
      status: 'sent'
    });

    await testNotification.save();
    await testNotification.populate('sender', 'name email');

    const deliveredCount = await processAndSendNotification(testNotification);

    res.json({
      success: true,
      message: 'Test notification sent successfully',
      notification: testNotification,
      delivered: deliveredCount,
      socketStatus: io ? io.engine.clientsCount : 0
    });
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error.message
    });
  }
});

module.exports = { router, setIO, processAndSendNotification };