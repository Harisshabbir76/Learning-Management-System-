const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  selectedOption: { type: Number, required: true },
  correctAnswer: { type: Number, required: true },
  isCorrect: { type: Boolean, required: true },
  marksAwarded: { type: Number, required: true },
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  questionMarks: { type: Number, required: true }
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: { type: [answerSchema], default: [] },
  score: { type: Number, required: true, default: 0 },
  percentage: { type: Number, required: true, default: 0 },
  totalMarks: { type: Number, required: true },
  attemptNumber: { type: Number, required: true, default: 1 },
  submittedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
submissionSchema.index({ quiz: 1, student: 1, attemptNumber: 1 });
submissionSchema.index({ quiz: 1, student: 1 });

module.exports = mongoose.models.QuizSubmission || mongoose.model('QuizSubmission', submissionSchema);