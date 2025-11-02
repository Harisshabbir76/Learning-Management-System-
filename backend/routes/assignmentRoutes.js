const express = require("express");
const router = express.Router();
const Assignment = require("../Models/Assignment");
const Submission = require("../Models/Submission");
const Course = require("../Models/Course");
const User = require("../Models/User");
const Notification = require("../Models/Notification");
const auth = require("../middleware/auth");
const roleAuth = require("../middleware/roleAuth");
const uploadAssignment = require("../middleware/uploadAssignment"); 
const mongoose = require("mongoose"); 

// Enhanced helper function to send assignment notifications to STUDENTS ONLY
const sendAssignmentNotification = async (assignment, courseId, createdBy) => {
  try {
    console.log('🔔 Starting assignment notification process (STRICT STUDENTS ONLY)...');
    console.log('Assignment:', assignment.title);
    console.log('Course ID:', courseId);
    console.log('Created by:', createdBy);

    // Get the course with populated section and students
    const course = await Course.findById(courseId)
      .populate({
        path: 'section',
        populate: {
          path: 'students',
          select: 'name email _id userId role',
          match: { role: 'student' } // 🚨 ONLY populate students
        }
      })
      .populate({
        path: 'students', 
        select: 'name email _id userId role',
        match: { role: 'student' } // 🚨 ONLY populate students
      })
      .populate('teacher', 'name email _id userId')
      .populate('school', 'name');

    if (!course) {
      console.error('❌ Course not found for notification');
      return;
    }

    console.log(`📚 Course found: ${course.name}`);
    console.log(`🏫 Section: ${course.section?.name || 'No section'}`);

    // Get ONLY students from both sources
    const sectionStudents = course.section?.students?.filter(student => 
      student && student.role === 'student'
    ) || [];
    
    const courseStudents = course.students?.filter(student => 
      student && student.role === 'student'
    ) || [];

    console.log(`👥 STUDENTS in section: ${sectionStudents.length}`);
    console.log(`👥 STUDENTS directly in course: ${courseStudents.length}`);

    // Combine and deduplicate - ONLY STUDENTS
    const allStudentIds = [
      ...sectionStudents.map(s => s._id.toString()),
      ...courseStudents.map(s => s._id ? s._id.toString() : s.toString())
    ];
    
    const uniqueStudentIds = [...new Set(allStudentIds)];
    console.log(`🎯 Total unique STUDENTS to notify: ${uniqueStudentIds.length}`);

    if (uniqueStudentIds.length === 0) {
      console.log('⚠️ No STUDENTS found to notify');
      return;
    }

    // Double-check: Verify all target users are actually students
    const verifiedStudents = await User.find({
      _id: { $in: uniqueStudentIds },
      role: 'student'
    }).select('_id name role');

    const verifiedStudentIds = verifiedStudents.map(s => s._id.toString());

    if (verifiedStudentIds.length !== uniqueStudentIds.length) {
      console.warn('⚠️ Some target users are not students! Filtering...');
      console.log(`✅ After verification: ${verifiedStudentIds.length} actual students`);
    }

    // Get the creator's details
    const creator = await User.findById(createdBy);
    if (!creator) {
      console.error('❌ Assignment creator not found');
      return;
    }

    // Prepare notification data with EXPLICIT student-only targeting
    const notificationData = {
      title: `New Assignment: ${assignment.title}`,
      message: `A new assignment "${assignment.title}" has been created for ${course.name}. Due date: ${new Date(assignment.dueDate).toLocaleDateString()}`,
      type: 'assignment', // 🚨 This is the key that will be filtered out for non-students
      priority: 'high',
      sender: createdBy,
      school: course.school || creator.school,
      targetType: 'specific',
      specificUsers: verifiedStudentIds, // Only student IDs
      assignment: assignment._id,
      course: courseId,
      deliveryMethods: {
        inApp: true,
        push: true,
        email: false
      },
      scheduledFor: null,
      status: 'sent',
      sentAt: new Date(),
      totalRecipients: verifiedStudentIds.length,
      // 🚨 Add explicit metadata to ensure student-only visibility
      metadata: {
        studentOnly: true,
        assignmentId: assignment._id,
        courseId: courseId
      }
    };

    console.log(`🎯 Creating STUDENT-ONLY assignment notification`);

    // Create the notification
    const notification = new Notification({
      ...notificationData,
      totalRecipients: verifiedStudentIds.length
    });

    await notification.save();

    console.log(`✅ Assignment notification created: ${notification._id}`);
    console.log(`📨 Notification sent to ${verifiedStudentIds.length} STUDENTS in course ${course.name}`);

    // Log student details for debugging
    if (sectionStudents.length > 0) {
      console.log('👥 Student details (STUDENTS ONLY):');
      sectionStudents.forEach((student, index) => {
        console.log(`  ${index + 1}. ${student.name} (ID: ${student._id}, Role: ${student.role})`);
      });
    }

    return notification;
  } catch (error) {
    console.error('❌ Error sending assignment notification:', error);
    // Don't throw error to prevent assignment creation from failing
    return null;
  }
};

// Enhanced helper function for grade notifications (to STUDENT only)
const sendGradeNotification = async (submission, gradedBy) => {
  try {
    console.log('🔔 Starting grade notification process (STUDENT ONLY)...');
    console.log(`Submission ID: ${submission._id}`);
    console.log(`Graded by: ${gradedBy}`);

    // Populate all necessary data
    const populatedSubmission = await Submission.findById(submission._id)
      .populate("student", "name email _id userId role school")
      .populate({
        path: "assignment",
        populate: {
          path: "course",
          select: "name code _id"
        }
      })
      .populate("gradedBy", "name email");

    if (!populatedSubmission) {
      console.error('❌ Submission not found for notification');
      return null;
    }
    console.log('✅ Submission populated successfully');

    const student = populatedSubmission.student;
    const assignment = populatedSubmission.assignment;
    const course = assignment.course;
    const grader = populatedSubmission.gradedBy;

    // 🚨 CRITICAL: Only send notification if the user is a student
    if (!student) {
      console.error('❌ Student not found on submission');
      return null;
    }
    console.log(`Student found: ${student.name} (Role: ${student.role})`);

    // 🚨 CRITICAL: Only send notification if the user is a student
    if (student.role !== 'student') {
      console.log(`⚠️ Not sending grade notification to non-student: ${student.name} (${student.role})`);
      return null;
    }

    console.log(`🎯 Preparing grade notification for student: ${student.name}`);
    console.log(`📊 Grade: ${populatedSubmission.marksObtained}/${assignment.maxMarks}`);
    console.log(`📚 Course: ${course.name}`);
    console.log(`📝 Assignment: ${assignment.title}`);

    // Prepare notification message
    const message = `Your submission for "${assignment.title}" in ${course.name} has been graded.${populatedSubmission.feedback ? ` Feedback: ${populatedSubmission.feedback}` : ''}`;

    // Prepare notification data with EXPLICIT student-only targeting
    const notificationData = {
      title: `Assignment Graded: ${assignment.title}`,
      message: message,
      type: 'grade', // Specific type for grade notifications
      priority: 'medium',
      sender: gradedBy,
      school: student.school,
      targetType: 'specific',
      specificUsers: [student._id], // 🚨 ONLY the student who was graded
      assignment: assignment._id,
      course: course._id,
      deliveryMethods: {
        inApp: true,
        push: true,
        email: false
      },
      scheduledFor: null,
      status: 'sent',
      sentAt: new Date(),
      totalRecipients: 1,
      // 🚨 Add explicit metadata to ensure student-only visibility
      metadata: {
        studentOnly: true,
        assignmentId: assignment._id,
        courseId: course._id,
        grade: populatedSubmission.marksObtained,
        maxMarks: assignment.maxMarks,
        gradedBy: grader.name
      }
    };

    console.log(`🎯 Creating STUDENT-ONLY grade notification with data:`, JSON.stringify(notificationData, null, 2));

    // Create the notification
    const notification = new Notification(notificationData);
    await notification.save();

    console.log(`✅ Grade notification created successfully: ${notification._id}`);
    console.log(`📨 Grade notification sent to STUDENT: ${student.name}`);

    return notification;

  } catch (error) {
    console.error('❌ Error sending grade notification:', error);
    // Don't throw error to prevent grading from failing
    return null;
  }
};

// Student-specific notification route
router.get('/notifications/student', auth, roleAuth(['student']), async (req, res) => {
  try {
    const notifications = await Notification.getUserNotifications(
      req.user.id, 
      req.user.school, 
      req.query
    );
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching student notifications:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
});

// Staff-specific notification route (no assignments)
router.get('/notifications/staff', auth, roleAuth(['teacher', 'admin', 'faculty']), async (req, res) => {
  try {
    const notifications = await Notification.getStaffNotifications(
      req.user.id, 
      req.user.school, 
      req.query
    );
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching staff notifications:', error);
    res.status(500).json({ success: false, message: 'Error fetching notifications' });
  }
});

// Student grade notifications route
router.get('/notifications/grades', auth, roleAuth(['student']), async (req, res) => {
  try {
    const { page = 1, limit = 10, unreadOnly } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      school: req.user.school,
      type: 'grade',
      status: 'sent',
      specificUsers: req.user.id,
    };

    if (unreadOnly === 'true') {
      query.readBy = { $not: { $elemMatch: { user: req.user.id } } };
    }

    const notifications = await Notification.find(query)
      .populate('sender', 'name')
      .populate({
        path: 'assignment',
        select: 'title',
        populate: {
          path: 'course',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    // Add isReadByCurrentUser field
    const notificationsWithReadStatus = notifications.map(notification => ({
      ...notification.toObject(),
      isReadByCurrentUser: notification.readBy.some(
        entry => entry.user.toString() === req.user.id.toString()
      )
    }));

    res.json({
      success: true,
      data: notificationsWithReadStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching grade notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching grade notifications'
    });
  }
});

router.post(
  "/",
  auth,
  roleAuth(["teacher", "admin"]),
  uploadAssignment.single("file"),
  async (req, res) => {
    try {
      console.log("📝 Creating new assignment...");

      const { course, title, description, dueDate, maxMarks } = req.body;

      // Validation
      if (!course || !title || !dueDate || !maxMarks) {
        return res.status(400).json({ 
          success: false, 
          message: "Missing required fields: course, title, dueDate, maxMarks" 
        });
      }

      // Create assignment
      const assignment = new Assignment({
        course,
        title,
        description: description || "",
        dueDate,
        maxMarks: parseInt(maxMarks),
        fileUrl: req.file ? `/uploads/assignments/${req.file.filename}` : null,
        createdBy: req.user.id
      });

      await assignment.save();
      
      // Populate the response for better frontend experience
      const populatedAssignment = await Assignment.findById(assignment._id)
        .populate("course", "name")
        .populate("createdBy", "name email");

      // Send notification to STUDENTS ONLY (non-blocking)
      sendAssignmentNotification(assignment, course, req.user.id)
        .then(notification => {
          if (notification) {
            console.log(`✅ Student notification created successfully: ${notification._id}`);
          } else {
            console.log('❌ Student notification creation failed, but assignment was created');
          }
        })
        .catch(err => {
          console.error('❌ Student notification failed but assignment was created:', err.message);
        });

      res.status(201).json({ 
        success: true, 
        message: "Assignment created successfully",
        data: populatedAssignment,
        notificationSent: true
      });

    } catch (error) {
      console.error("❌ Error creating assignment:", error);
      res.status(500).json({ 
        success: false, 
        message: "Server error while creating assignment",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// ✅ Get all assignments for a course
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const assignments = await Assignment.find({ course: courseId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching assignments'
    });
  }
});

// ✅ Get single assignment details
router.get("/:id", auth, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate("course", "name")
      .populate("createdBy", "name email");

    if (!assignment) {
      return res.status(404).json({ 
        success: false, 
        message: "Assignment not found" 
      });
    }

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error("Error fetching assignment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update assignment
router.put(
  "/:id",
  auth,
  roleAuth(["teacher", "admin"]),
  uploadAssignment.single("file"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description, dueDate, maxMarks, course } = req.body;

      // Validate assignment ID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid assignment ID format" 
        });
      }

      // Find the assignment
      const assignment = await Assignment.findById(id);
      if (!assignment) {
        return res.status(404).json({ 
          success: false, 
          message: "Assignment not found" 
        });
      }

      // Check if user has permission to update this assignment
      if (assignment.createdBy.toString() !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ 
          success: false, 
          message: "You can only update your own assignments" 
        });
      }

      // Update assignment fields
      if (title) assignment.title = title;
      if (description !== undefined) assignment.description = description;
      if (dueDate) assignment.dueDate = dueDate;
      if (maxMarks) assignment.maxMarks = parseInt(maxMarks);
      if (course) assignment.course = course;

      // Update file if a new one was uploaded
      if (req.file) {
        assignment.fileUrl = `/uploads/assignments/${req.file.filename}`;
      }

      await assignment.save();
      
      // Populate the response
      const populatedAssignment = await Assignment.findById(assignment._id)
        .populate("course", "name")
        .populate("createdBy", "name email");

      res.json({ 
        success: true, 
        message: "Assignment updated successfully",
        data: populatedAssignment 
      });
    } catch (error) {
      console.error("Error updating assignment:", error);
      res.status(500).json({ 
        success: false, 
        message: "Server error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get assignment submissions
router.get("/:id/submissions", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const submissions = await Submission.find({ assignment: id })
      .populate("student", "name email userId")
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
      message: "Server error"
    });
  }
});

// Grade submission - Fixed version
router.put("/submissions/:submissionId/grade", auth, roleAuth(["teacher", "admin"]), async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { marksObtained, feedback } = req.body;

    // Validate required fields
    if (marksObtained === undefined || marksObtained === null) {
      return res.status(400).json({
        success: false,
        message: "Marks obtained are required"
      });
    }

    const submission = await Submission.findById(submissionId)
      .populate("assignment", "title maxMarks course createdBy")
      .populate("student", "name email _id userId role school");

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found"
      });
    }

    // Validate marks
    if (parseInt(marksObtained) > submission.assignment.maxMarks) {
      return res.status(400).json({
        success: false,
        message: `Marks obtained cannot exceed maximum marks (${submission.assignment.maxMarks})`
      });
    }

    // Update submission
    submission.marksObtained = parseInt(marksObtained);
    submission.feedback = feedback || "";
    submission.gradedAt = new Date();
    submission.gradedBy = req.user.id;

    await submission.save();

    // Send grade notification to student (non-blocking)
    sendGradeNotification(submission, req.user.id)
      .then(notification => {
        if (notification) {
          console.log(`✅ Grade notification sent to student: ${notification._id}`);
        } else {
          console.log('❌ Grade notification failed, but grading was completed');
        }
      })
      .catch(err => {
        console.error('❌ Grade notification error:', err.message);
      });

    // Populate the response
    const populatedSubmission = await Submission.findById(submission._id)
      .populate("student", "name email userId")
      .populate("gradedBy", "name email")
      .populate("assignment", "title maxMarks");

    res.json({
      success: true,
      message: "Submission graded successfully",
      data: populatedSubmission,
      notificationSent: true
    });

  } catch (error) {
    console.error("Error grading submission:", error);
    res.status(500).json({
      success: false,
      message: "Server error while grading submission",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Debug endpoint for grade notifications
router.get('/debug/grade-notification/:submissionId', auth, async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId)
      .populate("student", "name email role")
      .populate("assignment", "title course")
      .populate({
        path: "assignment",
        populate: {
          path: "course",
          select: "name"
        }
      });

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Test notification creation
    const testNotification = await sendGradeNotification(submission, req.user.id);

    res.json({
      success: true,
      data: {
        submission: {
          id: submission._id,
          student: submission.student,
          assignment: submission.assignment,
          marks: submission.marksObtained
        },
        notification: testNotification,
        debug: {
          studentRole: submission.student.role,
          shouldSend: submission.student.role === 'student'
        }
      }
    });

  } catch (error) {
    console.error('Grade notification debug error:', error);
    res.status(500).json({ success: false, message: 'Debug error' });
  }
});

// Debug endpoint to check which users would receive notifications
router.get('/debug/notification-recipients/:courseId', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId)
      .populate({
        path: 'section',
        populate: {
          path: 'students',
          select: 'name email userId role'
        }
      })
      .populate('students', 'name email userId role')
      .populate('teachers', 'name email userId role');

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Filter for students only
    const sectionStudents = course.section?.students?.filter(student => student.role === 'student') || [];
    const courseStudents = course.students?.filter(student => student.role === 'student') || [];
    
    // Combine and deduplicate
    const allStudentIds = [
      ...sectionStudents.map(s => s._id.toString()),
      ...courseStudents.map(s => s._id.toString())
    ];
    const uniqueStudentIds = [...new Set(allStudentIds)];

    // Get non-student users (teachers, admins, faculty) who should NOT receive notifications
    const nonStudents = [
      ...(course.section?.students?.filter(user => user.role !== 'student') || []),
      ...(course.students?.filter(user => user.role !== 'student') || []),
      ...(course.teachers || [])
    ];

    res.json({
      success: true,
      data: {
        course: {
          id: course._id,
          name: course.name,
          section: course.section?.name
        },
        recipients: {
          students: sectionStudents.map(s => ({
            id: s._id,
            name: s.name,
            email: s.email,
            role: s.role,
            source: 'section'
          })),
          totalStudents: uniqueStudentIds.length
        },
        excludedUsers: {
          nonStudents: nonStudents.map(u => ({
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role
          })),
          totalExcluded: nonStudents.length
        },
        summary: {
          totalUsersInSection: course.section?.students?.length || 0,
          totalUsersInCourse: course.students?.length || 0,
          studentsToNotify: uniqueStudentIds.length,
          nonStudentsExcluded: nonStudents.length
        }
      }
    });

  } catch (error) {
    console.error('Notification recipients debug error:', error);
    res.status(500).json({ success: false, message: 'Debug error' });
  }
});

// Debug endpoint to check student relationships
router.get('/debug/student-relationships/:courseId', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId)
      .populate({
        path: 'section',
        populate: {
          path: 'students',
          select: 'name email userId courses sections role'
        }
      })
      .populate('students', 'name email userId courses sections role');

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check student relationships - ONLY STUDENTS
    const studentAnalysis = await Promise.all(
      course.section.students
        .filter(student => student.role === 'student')
        .map(async (student) => {
        const studentWithRelations = await User.findById(student._id)
          .populate('courses', 'name')
          .populate('sections', 'name');

        return {
          student: {
            id: student._id,
            name: student.name,
            email: student.email,
            role: student.role
          },
          inSection: true,
          inCourse: course.students.some(s => 
            s._id.toString() === student._id.toString()
          ),
          hasCourseInProfile: studentWithRelations.courses.some(c => 
            c._id.toString() === course._id.toString()
          ),
          hasSectionInProfile: studentWithRelations.sections.some(s => 
            s._id.toString() === course.section._id.toString()
          ),
          coursesInProfile: studentWithRelations.courses.map(c => c.name),
          sectionsInProfile: studentWithRelations.sections.map(s => s.name)
        };
      })
    );

    res.json({
      success: true,
      data: {
        course: {
          id: course._id,
          name: course.name,
          section: course.section.name
        },
        students: studentAnalysis,
        summary: {
          totalInSection: course.section.students.length,
          studentsInSection: course.section.students.filter(s => s.role === 'student').length,
          totalInCourse: course.students.length,
          studentsInCourse: course.students.filter(s => s.role === 'student').length,
          studentsWithCourseInProfile: studentAnalysis.filter(s => s.hasCourseInProfile).length,
          studentsWithSectionInProfile: studentAnalysis.filter(s => s.hasSectionInProfile).length
        }
      }
    });

  } catch (error) {
    console.error('Student relationships debug error:', error);
    res.status(500).json({ success: false, message: 'Debug error' });
  }
});

// Debug endpoint to check notifications for a specific user
router.get('/debug/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const schoolId = req.user.school;

    console.log(`🔍 Debug: Checking notifications for user ${userId} in school ${schoolId}`);

    // Get user details
    const user = await User.findById(userId)
      .populate('courses', 'name code _id')
      .populate('sections', 'name sectionCode _id');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get all notifications for the school
    const allNotifications = await Notification.find({
      school: schoolId,
      status: 'sent',
      isActive: true
    })
    .populate('courses', 'name code')
    .populate('sections', 'name sectionCode')
    .populate('assignment', 'title')
    .populate('course', 'name')
    .sort({ createdAt: -1 });

    // Get user's notifications using the method
    const userNotifications = await Notification.getUserNotifications(userId, schoolId);

    // Check which notifications should be visible to user
    const visibleNotifications = allNotifications.filter(notification => {
      // 🚨 CRITICAL: If user is not student and notification is assignment or grade, exclude it
      if (user.role !== 'student' && (notification.type === 'assignment' || notification.type === 'grade')) {
        return false;
      }
      
      switch (notification.targetType) {
        case 'all':
          return true;
        
        case 'role':
          return notification.targetRoles?.includes(user.role);
        
        case 'specific':
          return notification.specificUsers?.some(id => id.toString() === userId);
        
        case 'section':
          const userSectionIds = user.sections?.map(s => s._id.toString()) || [];
          const notificationSectionIds = notification.sections?.map(s => s._id.toString()) || [];
          return notificationSectionIds.some(id => userSectionIds.includes(id));
        
        case 'course':
          const userCourseIds = user.courses?.map(c => c._id.toString()) || [];
          const notificationCourseIds = notification.courses?.map(c => c._id.toString()) || [];
          return notificationCourseIds.some(id => userCourseIds.includes(id));
        
        default:
          return false;
      }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          role: user.role,
          courses: user.courses,
          sections: user.sections
        },
        allNotifications: allNotifications.length,
        userNotifications: userNotifications.length,
        visibleNotifications: visibleNotifications.length,
        debug: {
          allNotifications: allNotifications.map(n => ({
            id: n._id,
            title: n.title,
            type: n.type,
            targetType: n.targetType,
            courses: n.courses?.map(c => ({ id: c._id, name: c.name })),
            sections: n.sections?.map(s => ({ id: s._id, name: s.name })),
            targetRoles: n.targetRoles,
            studentOnly: n.metadata?.studentOnly
          })),
          userNotifications: userNotifications.map(n => ({
            id: n._id,
            title: n.title,
            type: n.type,
            targetType: n.targetType
          })),
          visibleNotifications: visibleNotifications.map(n => ({
            id: n._id,
            title: n.title,
            type: n.type,
            targetType: n.targetType
          }))
        }
      }
    });

  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Debug error',
      error: error.message
    });
  }
});

// Debug endpoint to check course students
router.get('/debug/course/:courseId/students', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId)
      .populate('students', 'name email _id userId courses role')
      .populate('teachers', 'name email role');

    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Check if students have the course in their courses array - ONLY STUDENTS
    const studentsWithCourseCheck = await Promise.all(
      course.students
        .filter(student => student.role === 'student')
        .map(async (student) => {
        const studentWithCourses = await User.findById(student._id).populate('courses', 'name');
        const hasCourseInProfile = studentWithCourses.courses.some(c => c._id.toString() === course._id.toString());
        
        return {
          student: {
            id: student._id,
            name: student.name,
            email: student.email,
            role: student.role
          },
          hasCourseInProfile: hasCourseInProfile,
          coursesInProfile: studentWithCourses.courses.map(c => c.name)
        };
      })
    );

    res.json({
      success: true,
      data: {
        course: {
          id: course._id,
          name: course.name,
          studentCount: course.students.filter(s => s.role === 'student').length,
          totalUsers: course.students.length
        },
        students: studentsWithCourseCheck,
        teachers: course.teachers.map(t => ({
          id: t._id,
          name: t.name,
          email: t.email,
          role: t.role
        }))
      }
    });

  } catch (error) {
    console.error('Course debug error:', error);
    res.status(500).json({ success: false, message: 'Debug error' });
  }
});

module.exports = router;
