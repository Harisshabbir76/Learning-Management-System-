const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  recipients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  recipientType: {
    type: String,
    enum: ['all_teachers', 'all_students', 'course_students', 'class_students', 'specific_user', 'all_employees'],
    required: true,
  },
  recipientDetails: {
    // Store additional info like course/class IDs for filtering
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course'
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Section'
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['sent', 'scheduled', 'draft', 'failed'],
    default: 'sent',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['general', 'academic', 'administrative', 'emergency', 'event'],
    default: 'general'
  },
  scheduledFor: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { 
  timestamps: true 
});

// Index for better query performance
notificationSchema.index({ recipients: 1, createdAt: -1 });
notificationSchema.index({ sender: 1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ 'readBy.user': 1 });

// Virtual for isRead status
notificationSchema.virtual('isRead').get(function() {
  return this.readBy.length > 0;
});

// Method to mark as read for a user
notificationSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read => read.user.toString() === userId.toString());
  if (!existingRead) {
    this.readBy.push({ user: userId });
  }
  return this.save();
};

// Static method to get unread count for user
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    recipients: userId,
    'readBy.user': { $ne: userId }
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;