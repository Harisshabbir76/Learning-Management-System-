const mongoose = require('mongoose');

const timetableSchema = new mongoose.Schema({
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Section',
    required: true,
    unique: true, // 1 timetable per section
  },
  days: {
    type: Number,
    required: true,
    min: 1, // Minimum 1 day
    max: 7  // Maximum 7 days (week)
  },
  periodsPerDay: {
    type: Number,
    required: true,
    min: 1, // Minimum 1 period per day
    max: 12 // Maximum 12 periods per day
  },
  schedule: [
    {
      dayIndex: { 
        type: Number, 
        required: true,
        min: 0
      }, // 0 = Monday, 1 = Tuesday ...
      periodIndex: { 
        type: Number, 
        required: true,
        min: 0
      }, // 0–(periods-1)
      course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
      teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // role=teacher
    },
  ],
}, {
  timestamps: true
});

// Index for better query performance
timetableSchema.index({ section: 1 });
timetableSchema.index({ 'schedule.teacher': 1 });
timetableSchema.index({ 'schedule.course': 1 });

module.exports = mongoose.model('Timetable', timetableSchema);