// models/Faculty.js
const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  salary: { type: Number, default: 0 },
  permissions: [{ type: String }],
  salaryHistory: [{
    amount: Number,
    date: Date,
    status: { type: String, enum: ['paid', 'pending'] },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
});

module.exports = mongoose.models.Faculty || mongoose.model('Faculty', facultySchema);
