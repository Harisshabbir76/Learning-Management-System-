const mongoose = require("mongoose");

const submissionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Assignment",
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  fileUrl: {
    type: String,
    required: true // student must upload a file
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  marksObtained: {
    type: Number,
    default: null // teacher will update later
  },
  feedback: {
    type: String,
    trim: true
  },
  gradedAt: {
    type: Date
  },
  gradedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
});

module.exports = mongoose.model("Submission", submissionSchema);
