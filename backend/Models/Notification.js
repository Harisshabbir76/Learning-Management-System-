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
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['info', 'warning', 'success', 'error', 'announcement', 'reminder', 'assignment', 'grade'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  // Target specifications
  targetType: {
    type: String,
    enum: ['all', 'role', 'specific', 'section', 'course'],
    required: true
  },
  targetRoles: [{
    type: String,
    enum: ['student', 'teacher', 'parent', 'faculty', 'admin']
  }],
  specificUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  sections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section'
  }],
  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  // Assignment reference (for assignment notifications)
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment'
  },
  // Course reference (for course-specific notifications)
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  // Delivery settings
  deliveryMethods: {
    inApp: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
    email: { type: Boolean, default: false }
  },
  // Delivery status
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sent', 'failed'],
    default: 'draft'
  },
  scheduledFor: {
    type: Date
  },
  sentAt: {
    type: Date
  },
  // Push notification tracking
  pushSent: {
    type: Boolean,
    default: false
  },
  pushSentAt: {
    type: Date
  },
  // Read tracking
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
  // Analytics
  totalRecipients: {
    type: Number,
    default: 0
  },
  readCount: {
    type: Number,
    default: 0
  },
  // Expiration
  expiresAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Metadata for enhanced filtering
  metadata: {
    studentOnly: { type: Boolean, default: false },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    grade: { type: Number },
    maxMarks: { type: Number },
    gradedBy: { type: String }
  }
}, {
  timestamps: true
});

// SINGLE SET OF INDEXES
notificationSchema.index({ school: 1, status: 1 });
notificationSchema.index({ sender: 1, createdAt: -1 });
notificationSchema.index({ targetType: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ scheduledFor: 1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ 'deliveryMethods.push': 1, pushSent: 1 });
notificationSchema.index({ assignment: 1 });
notificationSchema.index({ course: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ targetRoles: 1 });
notificationSchema.index({ specificUsers: 1 });
notificationSchema.index({ 'metadata.studentOnly': 1 });

// Enhanced Static method to get notifications for a user with STUDENT-ONLY filtering
notificationSchema.statics.getUserNotifications = async function(userId, schoolId, options = {}) {
  const { limit = 20, page = 1, unreadOnly = false } = options;
  const skip = (page - 1) * limit;

  try {
    console.log(`🔍 Fetching notifications for user: ${userId}, school: ${schoolId}`);
    
    // Get user with populated sections and courses
    const user = await mongoose.model('User').findById(userId)
      .populate('sections', '_id name sectionCode')
      .populate('courses', '_id name code');

    if (!user) {
      console.log('❌ User not found for notifications');
      return [];
    }

    console.log(`👤 User found: ${user.name}, Role: ${user.role}`);

    const userSectionIds = user.sections?.map(s => s._id) || [];
    const userCourseIds = user.courses?.map(c => c._id) || [];

    // BASE QUERY - Always filter by school, status, and active
    const query = {
      school: schoolId,
      status: 'sent',
      isActive: true,
      $and: [
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        }
      ]
    };

    // 🚨 CRITICAL FIX: If user is NOT a student, EXCLUDE assignment and grade notifications
    if (user.role !== 'student') {
      query.type = { $nin: ['assignment', 'grade'] }; // Non-students don't see assignment or grade notifications
      query['metadata.studentOnly'] = { $ne: true }; // Also exclude any student-only notifications
      console.log(`🚫 User is ${user.role}, excluding assignment and grade notifications`);
    }

    // Add targeting logic
    query.$or = [
      { targetType: 'all' },
      { targetType: 'role', targetRoles: user.role },
      { targetType: 'specific', specificUsers: userId },
      { targetType: 'section', sections: { $in: userSectionIds } },
      { targetType: 'course', courses: { $in: userCourseIds } }
    ];

    console.log('🔎 Final notification query:', JSON.stringify(query, null, 2));

    if (unreadOnly) {
      query.readBy = { $not: { $elemMatch: { user: userId } } };
    }

    const notifications = await this.find(query)
      .populate('sender', 'name email userId')
      .populate('courses', 'name code')
      .populate('sections', 'name sectionCode')
      .populate('assignment', 'title dueDate maxMarks')
      .populate('course', 'name code')
      .populate('specificUsers', 'name email role')
      .sort({ createdAt: -1, priority: -1 })
      .skip(skip)
      .limit(limit);

    console.log(`📨 Found ${notifications.length} notifications for ${user.role}: ${user.name}`);

    return notifications;
  } catch (error) {
    console.error('❌ Error in getUserNotifications:', error);
    return [];
  }
};

// Static method for staff notifications (no assignments or grades)
notificationSchema.statics.getStaffNotifications = async function(userId, schoolId, options = {}) {
  const { limit = 20, page = 1, unreadOnly = false } = options;
  const skip = (page - 1) * limit;

  try {
    console.log(`👨‍🏫 Fetching STAFF notifications for user: ${userId}`);
    
    const user = await mongoose.model('User').findById(userId);
    if (!user) {
      console.log('❌ User not found for staff notifications');
      return [];
    }

    const userSectionIds = user.sections?.map(s => s._id) || [];
    const userCourseIds = user.courses?.map(c => c._id) || [];

    // STAFF QUERY - Explicitly exclude assignment and grade notifications
    const query = {
      school: schoolId,
      status: 'sent',
      isActive: true,
      type: { $nin: ['assignment', 'grade'] }, // Never show assignments or grades to staff
      'metadata.studentOnly': { $ne: true }, // Exclude student-only notifications
      $and: [
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        }
      ],
      $or: [
        { targetType: 'all' },
        { targetType: 'role', targetRoles: user.role },
        { targetType: 'specific', specificUsers: userId },
        { targetType: 'section', sections: { $in: userSectionIds } },
        { targetType: 'course', courses: { $in: userCourseIds } }
      ]
    };

    console.log('🔎 Staff notification query:', JSON.stringify(query, null, 2));

    if (unreadOnly) {
      query.readBy = { $not: { $elemMatch: { user: userId } } };
    }

    const notifications = await this.find(query)
      .populate('sender', 'name email userId')
      .populate('courses', 'name code')
      .populate('sections', 'name sectionCode')
      .populate('specificUsers', 'name email role')
      .sort({ createdAt: -1, priority: -1 })
      .skip(skip)
      .limit(limit);

    console.log(`📨 Found ${notifications.length} STAFF notifications for ${user.role}: ${user.name}`);

    return notifications;
  } catch (error) {
    console.error('❌ Error in getStaffNotifications:', error);
    return [];
  }
};

// Static method for grade notifications (students only)
notificationSchema.statics.getGradeNotifications = async function(userId, schoolId, options = {}) {
  const { page = 1, limit = 20, unreadOnly = false } = options;
  const skip = (page - 1) * limit;

  try {
    console.log(`📊 Fetching grade notifications for student: ${userId}`);
    
    // Query for grade notifications specifically for this student
    const query = {
      school: schoolId,
      status: 'sent',
      isActive: true,
      type: 'grade',
      targetType: 'specific',
      specificUsers: userId,
      $and: [
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        }
      ]
    };

    if (unreadOnly) {
      query.readBy = { $not: { $elemMatch: { user: userId } } };
    }

    const notifications = await this.find(query)
      .populate('sender', 'name email userId')
      .populate('assignment', 'title maxMarks dueDate')
      .populate('course', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    console.log(`📨 Found ${notifications.length} grade notifications for student: ${userId}`);

    return notifications;
  } catch (error) {
    console.error('❌ Error in getGradeNotifications:', error);
    return [];
  }
};

// Method to mark as read with timeout handling
notificationSchema.methods.markAsRead = function(userId) {
  const alreadyRead = this.readBy.some(entry => 
    entry.user && entry.user.toString() === userId.toString()
  );
  
  if (!alreadyRead) {
    this.readBy.push({ user: userId });
    this.readCount += 1;
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Virtual for unread status for a specific user
notificationSchema.virtual('isRead').get(function() {
  return (userId) => {
    return this.readBy.some(entry => entry.user.toString() === userId.toString());
  };
});

// Static method to create assignment notification for STUDENTS ONLY
notificationSchema.statics.createStudentAssignmentNotification = async function(assignment, course, senderId) {
  try {
    // Get students from section and course - FILTER FOR STUDENTS ONLY
    const sectionStudents = course.section?.students?.filter(student => student.role === 'student') || [];
    const courseStudents = course.students?.filter(student => student.role === 'student') || [];
    
    // Combine and deduplicate - ONLY STUDENTS
    const allStudentIds = [
      ...sectionStudents.map(s => s._id.toString()),
      ...courseStudents.map(s => s._id.toString())
    ];
    const uniqueStudentIds = [...new Set(allStudentIds)];

    if (uniqueStudentIds.length === 0) {
      console.log('⚠️ No STUDENTS found to notify for assignment');
      return null;
    }

    const notificationData = {
      title: `New Assignment: ${assignment.title}`,
      message: `A new assignment "${assignment.title}" has been created for ${course.name}. Due date: ${new Date(assignment.dueDate).toLocaleDateString()}`,
      type: 'assignment',
      priority: 'high',
      sender: senderId,
      school: course.school,
      targetType: 'specific',
      specificUsers: uniqueStudentIds, // Target specific student IDs only
      assignment: assignment._id,
      course: course._id,
      deliveryMethods: {
        inApp: true,
        push: true,
        email: false
      },
      status: 'sent',
      sentAt: new Date(),
      totalRecipients: uniqueStudentIds.length,
      metadata: {
        studentOnly: true,
        assignmentId: assignment._id,
        courseId: course._id
      }
    };

    const notification = new this(notificationData);
    await notification.save();
    
    console.log(`✅ Student assignment notification created for ${uniqueStudentIds.length} STUDENTS`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating student assignment notification:', error);
    throw error;
  }
};

// Static method to create grade notification for STUDENT ONLY
notificationSchema.statics.createGradeNotification = async function(submission, gradedBy) {
  try {
    const student = submission.student;
    const assignment = submission.assignment;
    const course = assignment.course;

    // 🚨 CRITICAL: Only send notification if the user is a student
    if (student.role !== 'student') {
      console.log(`⚠️ Not sending grade notification to non-student: ${student.name} (${student.role})`);
      return null;
    }

    const message = `Your submission for "${assignment.title}" in ${course.name} has been graded. You scored ${submission.marksObtained}/${assignment.maxMarks}.${submission.feedback ? ` Feedback: ${submission.feedback}` : ''}`;

    const notificationData = {
      title: `Assignment Graded: ${assignment.title}`,
      message: message,
      type: 'grade',
      priority: 'medium',
      sender: gradedBy,
      school: student.school,
      targetType: 'specific',
      specificUsers: [student._id], // ONLY the student who was graded
      assignment: assignment._id,
      course: course._id,
      deliveryMethods: {
        inApp: true,
        push: true,
        email: false
      },
      scheduledFor: null,
      status: 'sent',
      sentAt: new Date(),
      totalRecipients: 1,
      metadata: {
        studentOnly: true,
        assignmentId: assignment._id,
        courseId: course._id,
        grade: submission.marksObtained,
        maxMarks: assignment.maxMarks,
        gradedBy: gradedBy.name
      }
    };

    const notification = new this(notificationData);
    await notification.save();

    console.log(`✅ Grade notification created for STUDENT: ${student.name}`);
    return notification;

  } catch (error) {
    console.error('❌ Error creating grade notification:', error);
    throw error;
  }
};

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);