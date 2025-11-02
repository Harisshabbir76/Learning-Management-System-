const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: Number, required: true, min: 0 },
  marks: { type: Number, required: true, default: 1 } // Made required with default
}, { _id: false });

const quizSchema = new mongoose.Schema({
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  type: { type: String, default: 'mcq' },
  questions: { type: [questionSchema], default: [] },
  totalMarks: { type: Number, required: true },
  durationMinutes: { type: Number, default: null },
  visibleFrom: { type: Date, default: null },
  visibleUntil: { type: Date, default: null },
  maxAttempts: { type: Number, default: 1, min: 1 },
  retakePolicy: {
    allowRetake: { type: Boolean, default: false },
    minScoreToPass: { type: Number, default: 60, min: 0, max: 100 },
    daysBetweenAttempts: { type: Number, default: 1, min: 0 }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  school: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  isPublished: { type: Boolean, default: true },
}, {
  timestamps: true
});

quizSchema.index({ course: 1 });
quizSchema.set('strictPopulate', false);

module.exports = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);