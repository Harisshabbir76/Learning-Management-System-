// models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  class: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' }, // This should already exist
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  fees: { type: Number, default: 0 },
  feesHistory: [{ 
    amount: Number, 
    date: { type: Date, default: Date.now }, 
    status: { type: String, enum: ['paid', 'pending'], default: 'pending' } 
  }]
}, {
  timestamps: true
});

module.exports = mongoose.models.Student || mongoose.model('Student', studentSchema);