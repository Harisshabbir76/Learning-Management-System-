const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  sectionCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  students: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  capacity: {
    type: Number,
    default: 30,
    min: 1,
    max: 100
  },
  sessionStartDate: {
    type: Date,
    required: true
  },
  sessionEndDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Index for better query performance
sectionSchema.index({ school: 1, sectionCode: 1 }, { unique: true });
sectionSchema.index({ school: 1, isActive: 1 });
sectionSchema.index({ sessionEndDate: 1 });
sectionSchema.index({ teacher: 1 });

// Virtual for student count
sectionSchema.virtual('studentCount').get(function() {
  return this.students.length;
});

// Virtual for session duration in months
sectionSchema.virtual('sessionDuration').get(function() {
  if (!this.sessionStartDate || !this.sessionEndDate) return 0;
  
  const start = new Date(this.sessionStartDate);
  const end = new Date(this.sessionEndDate);
  const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + 
                    (end.getMonth() - start.getMonth());
  
  return Math.max(0, diffMonths);
});

// Method to check if section has available capacity
sectionSchema.methods.hasCapacity = function() {
  return this.students.length < this.capacity;
};

// Method to add student if capacity allows
sectionSchema.methods.addStudent = function(studentId) {
  if (this.hasCapacity() && !this.students.includes(studentId)) {
    this.students.push(studentId);
    return true;
  }
  return false;
};

// Method to check if session is active
sectionSchema.methods.isSessionActive = function() {
  const now = new Date();
  return this.isActive && now >= this.sessionStartDate && now <= this.sessionEndDate;
};

// Method to get session status
sectionSchema.methods.getSessionStatus = function() {
  const now = new Date();
  
  if (now < this.sessionStartDate) {
    return 'upcoming';
  } else if (now > this.sessionEndDate) {
    return 'completed';
  } else {
    return 'active';
  }
};

// Static method to check and update expired sessions
sectionSchema.statics.checkExpiredSessions = async function() {
  const now = new Date();
  
  // Find expired sessions
  const expiredSessions = await this.find({
    sessionEndDate: { $lt: now },
    isActive: true
  });
  
  // Update each expired session
  for (const session of expiredSessions) {
    session.isActive = false;
    await session.save();
    console.log(`Session ${session.name} (${session.sessionCode}) has been marked as expired`);
  }
  
  // Also update upcoming sessions that should be active
  await this.updateMany(
    {
      sessionStartDate: { $lte: now },
      sessionEndDate: { $gte: now },
      isActive: false
    },
    { $set: { isActive: true } }
  );
  
  console.log(`Session expiration check completed. ${expiredSessions.length} sessions expired.`);
  return expiredSessions.length;
};

module.exports = mongoose.models.Section || mongoose.model('Section', sectionSchema);