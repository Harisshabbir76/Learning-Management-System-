// models/Teacher.js
const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  salary: { type: Number, default: 0 },
  permissions: [{ type: String }],
  salaryHistory: [{
    amount: Number,
    date: Date,
    status: { type: String, enum: ['paid', 'pending'] },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
});

module.exports = mongoose.models.Teacher || mongoose.model('Teacher', teacherSchema);
