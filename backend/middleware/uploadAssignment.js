const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure upload directories exist
const assignmentsDir = "uploads/assignments";

if (!fs.existsSync(assignmentsDir)) {
  fs.mkdirSync(assignmentsDir, { recursive: true });
}

// Storage config for assignments
const assignmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, assignmentsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'assignment-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter (allow pdf, docx, doc, images)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|docx|doc|png|jpg|jpeg/i;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only PDF, DOCX, DOC, and image files are allowed"));
  }
};

const uploadAssignment = multer({ 
  storage: assignmentStorage, 
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

module.exports = uploadAssignment;