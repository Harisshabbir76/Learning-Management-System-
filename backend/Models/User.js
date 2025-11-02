// models/User.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  userId: { 
    type: Number, 
    required: true, 
    unique: true
  },
  role: { 
    type: String, 
    enum: ['student', 'teacher', 'parent', 'faculty', 'admin'],
    required: true 
  },
  school: { type: Schema.Types.ObjectId, ref: 'School', required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  roleProfile: { type: Schema.Types.ObjectId, refPath: 'roleRef' },
  roleRef: {
    type: String,
    enum: ['Student', 'Teacher', 'Faculty', 'Admin', 'Parent'],
  },
  notifications: [{
    notification: {
      type: Schema.Types.ObjectId,
      ref: 'Notification'
    },
    read: {
      type: Boolean,
      default: false
    },
    readAt: Date
  }],
  sections: [{
    type: Schema.Types.ObjectId,
    ref: 'Section'
  }],
  courses: [{
    type: Schema.Types.ObjectId,
    ref: 'Course'
  }]
}, { 
  timestamps: true,
  strictPopulate: false
});

module.exports = mongoose.model('User', userSchema);