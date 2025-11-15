const express = require("express");
const router = express.Router();
const Assessment = require("../Models/Assessment");
const Grade = require("../Models/Grade");
const Course = require("../Models/Course");
const authMiddleware = require("../middleware/auth");

// ✅ middleware for role check
const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }
  next();
};

// Create an assessment for a course (Teacher/Admin only)
router.post(
  "/:courseId",
  authMiddleware,
  requireRole(["teacher", "admin"]),
  async (req, res) => {
    try {
      const { title, type, totalMarks } = req.body;
      const { courseId } = req.params;

      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: "Course not found" });
      }

      const assessment = new Assessment({
        title,
        type,
        totalMarks,
        course: courseId,
        createdBy: req.user._id,
      });

      await assessment.save();
      res.status(201).json({ success: true, data: assessment });
    } catch (error) {
      console.error("Create Assessment Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Get all assessments for a course
router.get(
  "/:courseId",
  authMiddleware,
  requireRole(["teacher", "admin", "student"]),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const assessments = await Assessment.find({ course: courseId });
      res.json({ success: true, data: assessments });
    } catch (error) {
      console.error("Fetch Assessments Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Grade a student for an assessment
router.post(
  "/:assessmentId/grade/:studentId",
  authMiddleware,
  requireRole(["teacher", "admin"]),
  async (req, res) => {
    try {
      const { marksObtained } = req.body;
      const { assessmentId, studentId } = req.params;

      // Check if assessment exists
      const assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        return res.status(404).json({ success: false, message: "Assessment not found" });
      }

      // Check if grade already exists
      let grade = await Grade.findOne({
        assessment: assessmentId,
        student: studentId
      });

      if (grade) {
        // Update existing grade
        grade.marksObtained = marksObtained;
        grade.gradedBy = req.user._id;
      } else {
        // Create new grade
        grade = new Grade({
          student: studentId,
          assessment: assessmentId,
          marksObtained,
          gradedBy: req.user._id
        });
      }

      await grade.save();
      res.json({ success: true, data: grade });
    } catch (error) {
      console.error("Grade Student Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Get all grades for an assessment
router.get(
  "/:assessmentId/grades",
  authMiddleware,
  requireRole(["teacher", "admin", "student"]),
  async (req, res) => {
    try {
      const { assessmentId } = req.params;
      
      const grades = await Grade.find({ assessment: assessmentId })
        .populate("student", "name userId email")
        .populate("gradedBy", "name");
        
      res.json({ success: true, data: grades });
    } catch (error) {
      console.error("Get Grades Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

// Get a single assessment by ID
router.get(
  "/single/:assessmentId",
  authMiddleware,
  requireRole(["teacher", "admin", "student"]),
  async (req, res) => {
    try {
      const { assessmentId } = req.params;
      const assessment = await Assessment.findById(assessmentId);
      
      if (!assessment) {
        return res.status(404).json({ success: false, message: "Assessment not found" });
      }
      
      res.json({ success: true, data: assessment });
    } catch (error) {
      console.error("Get Assessment by ID Error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }
);

module.exports = router;
