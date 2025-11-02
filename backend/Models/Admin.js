const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // role-specific fields for admin
  designation: {
    type: String,
    default: "School Admin"
  },
  salaryHistory: [{
    amount: Number,
    date: Date,
    status: { type: String, enum: ['paid', 'pending'] },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  privileges: [{
    type: String
  }]
}, { timestamps: true });

module.exports = mongoose.models.Admin || mongoose.model('Admin', adminSchema);
