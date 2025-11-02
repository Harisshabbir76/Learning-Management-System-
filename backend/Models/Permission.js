// models/Permission.js
const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  school: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'School', 
    required: true 
  },
  permission: { 
    type: String, 
    enum: ['student_affairs', 'accounts_office'],
    required: true 
  },
  grantedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  grantedAt: { type: Date, default: Date.now },
  revokedAt: { type: Date },
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Compound index for unique active permissions
permissionSchema.index({ user: 1, permission: 1, isActive: 1 }, { unique: true });

module.exports = mongoose.models.Permission || mongoose.model('Permission', permissionSchema);