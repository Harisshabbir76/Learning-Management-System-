const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Submission = require("../Models/Submission");
const Assignment = require("../Models/Assignment");
const auth = require("../middleware/auth");
const roleAuth = require("../middleware/roleAuth");
const uploadSubmission = require("../middleware/uploadSubmission"); // Use the correct middleware

// ✅ Student submits assignment
router.post(
  "/:assignmentId",
  auth,
  roleAuth(["student"]),
  uploadSubmission.single("file"), // Use submission-specific middleware
  async (req, res) => {
    try {
      const { assignmentId } = req.params;

      // Validate assignmentId is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid assignment ID format" 
        });
      }

      const assignment = await Assignment.findById(assignmentId);
      if (!assignment) {
        return res.status(404).json({ 
          success: false, 
          message: "Assignment not found" 
        });
      }

      // Check if assignment is past due date
      if (new Date() > new Date(assignment.dueDate)) {
        return res.status(400).json({ 
          success: false, 
          message: "Cannot submit assignment after due date" 
        });
      }

      // Prevent multiple submissions
      const existing = await Submission.findOne({
        assignment: assignmentId,
        student: req.user.id
      });

      if (existing) {
        return res.status(400).json({ 
          success: false, 
          message: "You have already submitted this assignment" 
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: "No file uploaded" 
        });
      }

      const submission = new Submission({
        assignment: assignmentId,
        student: req.user.id,
        fileUrl: `/uploads/submissions/${req.file.filename}` // Correct path for submissions
      });

      await submission.save();

      // Populate the response for better frontend experience
      const populatedSubmission = await Submission.findById(submission._id)
        .populate("student", "name email rollNumber")
        .populate("assignment", "title");

      res.status(201).json({ 
        success: true, 
        message: "Assignment submitted successfully",
        data: populatedSubmission 
      });
    } catch (error) {
      console.error("Error submitting assignment:", error);
      res.status(500).json({ 
        success: false, 
        message: "Server error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ✅ Teacher/Admin fetch submissions for an assignment
router.get(
  "/:assignmentId",
  auth,
  roleAuth(["teacher", "admin"]),
  async (req, res) => {
    try {
      const { assignmentId } = req.params;

      // Validate assignmentId is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid assignment ID format" 
        });
      }

      const submissions = await Submission.find({
        assignment: assignmentId
      })
        .populate({
          path: "student",
          select: "name email rollNumber",
          model: "User"
        })
        .populate("assignment", "title maxMarks dueDate")
        .populate("gradedBy", "name email")
        .sort({ submittedAt: -1 });

      res.json({ 
        success: true, 
        data: submissions 
      });
    } catch (error) {
      console.error("Error fetching submissions:", error);
      res.status(500).json({ 
        success: false, 
        message: "Server error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ✅ Check if student has submitted an assignment
router.get(
  "/status/:assignmentId",
  auth,
  roleAuth(["student", "teacher", "admin"]),
  async (req, res) => {
    try {
      const { assignmentId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid assignment ID format" 
        });
      }

      const submission = await Submission.findOne({
        assignment: assignmentId,
        student: req.user.id
      });

      res.json({ 
        success: true, 
        submitted: !!submission,
        submission: submission || null
      });
    } catch (error) {
      console.error("Error checking submission status:", error);
      res.status(500).json({ 
        success: false, 
        message: "Server error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ✅ Teacher grades a submission
router.put(
  "/grade/:submissionId",
  auth,
  roleAuth(["teacher", "admin"]),
  async (req, res) => {
    try {
      const { submissionId } = req.params;
      const { marksObtained, feedback } = req.body;

      // Validate submissionId is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(submissionId)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid submission ID format" 
        });
      }

      const submission = await Submission.findById(submissionId);
      if (!submission) {
        return res.status(404).json({ 
          success: false, 
          message: "Submission not found" 
        });
      }

      // Validate marks if provided
      if (marksObtained !== undefined && marksObtained !== null) {
        const assignment = await Assignment.findById(submission.assignment);
        if (assignment && marksObtained > assignment.maxMarks) {
          return res.status(400).json({ 
            success: false, 
            message: `Marks cannot exceed maximum marks (${assignment.maxMarks})` 
          });
        }
      }

      submission.marksObtained = marksObtained;
      submission.feedback = feedback;
      submission.gradedAt = new Date();
      submission.gradedBy = req.user.id;

      await submission.save();

      // Populate the response
      const populatedSubmission = await Submission.findById(submission._id)
        .populate("student", "name email rollNumber")
        .populate("assignment", "title maxMarks")
        .populate("gradedBy", "name email");

      res.json({ 
        success: true, 
        message: "Submission graded successfully",
        data: populatedSubmission 
      });
    } catch (error) {
      console.error("Error grading submission:", error);
      res.status(500).json({ 
        success: false, 
        message: "Server error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get student's submission for an assignment
router.get('/assignment/:assignmentId/student', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    const submission = await Submission.findOne({
      assignment: assignmentId,
      student: studentId
    }).populate('gradedBy', 'name');

    if (!submission) {
      return res.json({
        submitted: false,
        submission: null
      });
    }

    res.json({
      submitted: true,
      submission: submission
    });
  } catch (error) {
    console.error("Error fetching student submission:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching submission"
    });
  }
});

// Add to your submission routes
router.get('/assignment/:assignmentId/student', auth, async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    const submission = await Submission.findOne({
      assignment: assignmentId,
      student: studentId
    })
    .populate('gradedBy', 'name')
    .select('marksObtained feedback submittedAt gradedAt');

    if (!submission) {
      return res.json({
        submitted: false,
        submission: null
      });
    }

    res.json({
      submitted: true,
      submission: submission
    });
  } catch (error) {
    console.error("Error fetching student submission:", error);
    res.status(500).json({
      success: false,
      message: "Server error fetching submission"
    });
  }
});

module.exports = router;