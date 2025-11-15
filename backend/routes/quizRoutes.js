const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const auth = require('../middleware/auth');
const User = require('../Models/User');
const Course = require('../Models/Course');
const Quiz = require('../Models/Quiz');
const QuizSubmission = require('../Models/QuizSubmission');
const Notification = require('../Models/Notification');
const Student = require('../Models/Student');

// Create a quiz for a course (teacher or admin) - Always published immediately
// POST /api/quizzes/:courseId
router.post('/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // permission: admin or teacher of this course
    if (user.role !== 'admin') {
      // teacher must be in course.teachers
      const isTeacherOfCourse = course.teachers.some(t => t.toString() === user._id.toString());
      if (!isTeacherOfCourse) {
        return res.status(403).json({ success: false, message: 'Only course teachers or admins can create quizzes' });
      }
    }

    const {
      title,
      description,
      questions = [],
      totalMarks,
      durationMinutes,
      visibleUntil,
      maxAttempts = 1,
      retakePolicy = {
        allowRetake: false,
        minScoreToPass: 60,
        daysBetweenAttempts: 1
      }
    } = req.body;

    if (!title || !Array.isArray(questions) || questions.length === 0 || !totalMarks) {
      return res.status(400).json({ success: false, message: 'Title, questions and totalMarks are required' });
    }

    // Validate visibleUntil if provided
    if (visibleUntil) {
      const endDate = new Date(visibleUntil);
      const now = new Date();
      if (endDate <= now) {
        return res.status(400).json({ success: false, message: 'End date must be in the future' });
      }
    }

    // Validate maxAttempts
    if (maxAttempts < 1) {
      return res.status(400).json({ success: false, message: 'Max attempts must be at least 1' });
    }

    // Validate retakePolicy only if retakes are allowed (maxAttempts > 1)
    if (maxAttempts > 1) {
      if (retakePolicy.minScoreToPass < 0 || retakePolicy.minScoreToPass > 100) {
        return res.status(400).json({ success: false, message: 'Minimum pass score must be between 0-100%' });
      }

      if (retakePolicy.daysBetweenAttempts < 0) {
        return res.status(400).json({ success: false, message: 'Days between attempts cannot be negative' });
      }
    }

    // basic validation for questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !Array.isArray(q.options) || q.options.length < 2 || typeof q.correctAnswer !== 'number') {
        return res.status(400).json({ success: false, message: `Invalid question at index ${i}` });
      }
      if (q.correctAnswer < 0 || q.correctAnswer >= q.options.length) {
        return res.status(400).json({ success: false, message: `correctAnswer out of range at question ${i}` });
      }
    }

    // Auto-set retake policy based on max attempts
    const finalRetakePolicy = maxAttempts > 1 ? retakePolicy : {
      allowRetake: false,
      minScoreToPass: 60,
      daysBetweenAttempts: 1
    };

    const quiz = new Quiz({
      course: course._id,
      title,
      description,
      questions,
      totalMarks,
      durationMinutes: durationMinutes || null,
      visibleFrom: new Date(), // Quiz starts immediately
      visibleUntil: visibleUntil ? new Date(visibleUntil) : null,
      maxAttempts,
      retakePolicy: finalRetakePolicy,
      createdBy: user._id,
      school: course.school,
      isPublished: true // Always publish immediately
    });

    await quiz.save();

    // Create notifications for enrolled students using the model method
    try {
      await Notification.createQuizNotification(quiz, course, user._id);
      console.log(`✅ Quiz notifications created successfully for course: ${course.name}`);
    } catch (notifError) {
      console.error('❌ Failed to create quiz notifications:', notifError);
      // Don't fail the whole request if notifications fail
    }

    res.status(201).json({ 
      success: true, 
      data: quiz, 
      message: 'Quiz created and published successfully' 
    });
  } catch (err) {
    console.error('Create quiz error:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      details: err.message 
    });
  }
});

// List quizzes for course
// GET /api/quizzes/:courseId
router.get('/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, message: 'Invalid course ID' });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Allow only users from same school
    if (course.school.toString() !== user.school.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Teachers should see quizzes for their course; students see quizzes for their course
    const filter = { course: course._id, isPublished: true }; // Only published quizzes
    
    if (user.role === 'teacher' || user.role === 'admin') {
      // teachers/admin see all published quizzes
    } else {
      // students see only published and not expired if visibleUntil is set
      const now = new Date();
      filter.$and = [
        { $or: [{ visibleUntil: null }, { visibleUntil: { $gte: now } }] }
      ];
    }

    const quizzes = await Quiz.find(filter)
      .select('-questions.correctAnswer') // remove correctAnswer from list response
      .sort({ createdAt: -1 });

    res.json({ success: true, data: quizzes });
  } catch (err) {
    console.error('List quizzes error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get quiz details (don't throw error for expired quizzes)
// GET /api/quizzes/quiz/:quizId
router.get('/quiz/:quizId', auth, async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(quizId).populate('course', 'name school');
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // ensure same school
    if (quiz.school.toString() !== user.school.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if quiz is published
    if (!quiz.isPublished) {
      return res.status(400).json({ success: false, message: 'This quiz is not published' });
    }

    // Don't throw error if quiz is expired, just return the quiz data
    const now = new Date();
    const isExpired = quiz.visibleUntil && quiz.visibleUntil < now;

    // teacher/admin (who is teacher of course or admin) can see correct answers
    let canSeeAnswers = false;
    if (user.role === 'admin') canSeeAnswers = true;
    if (user.role === 'teacher') {
      const isTeacher = quiz.course && quiz.course._id && (quiz.course.teachers?.includes(user._id) || false);
      // If course.teachers not populated above, fallback to checking Course doc:
      if (!isTeacher) {
        const courseDoc = await Course.findById(quiz.course._id);
        if (courseDoc && courseDoc.teachers.some(t => t.toString() === user._id.toString())) {
          canSeeAnswers = true;
        }
      } else {
        canSeeAnswers = true;
      }
    }

    const responseQuiz = quiz.toObject();
    if (!canSeeAnswers) {
      // remove correctAnswer from each question
      responseQuiz.questions = responseQuiz.questions.map(q => {
        const copy = { ...q };
        delete copy.correctAnswer;
        return copy;
      });
    }

    // Add expired flag for frontend
    responseQuiz.isExpired = isExpired;

    res.json({ success: true, data: responseQuiz });
  } catch (err) {
    console.error('Get quiz error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Submit quiz (student) - Fixed auto-grade with accurate scoring
// POST /api/quizzes/:quizId/submit
router.post('/:quizId/submit', auth, async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    const { quizId } = req.params;
    const { answers } = req.body;

    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({ success: false, message: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(quizId).session(session);
    if (!quiz) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(404).json({ success: false, message: 'Quiz not found' });
    }

    const user = await User.findById(req.user.id).session(session);
    if (!user) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Ensure same school
    if (quiz.school.toString() !== user.school.toString()) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Check if quiz is published
    if (!quiz.isPublished) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({ success: false, message: 'This quiz is not published' });
    }

    if (!Array.isArray(answers)) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({ success: false, message: 'Answers array is required' });
    }

    // Check if quiz is expired
    const now = new Date();
    if (quiz.visibleUntil && quiz.visibleUntil < now) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({ success: false, message: 'Quiz deadline has passed' });
    }

    // Check if quiz has started
    if (quiz.visibleFrom && quiz.visibleFrom > now) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({ success: false, message: 'Quiz has not started yet' });
    }

    // Find latest submission to determine next attempt number
    const latestSubmission = await QuizSubmission.findOne(
      { quiz: quiz._id, student: user._id },
      null,
      { session }
    ).sort({ attemptNumber: -1 });

    const currentAttempt = latestSubmission ? latestSubmission.attemptNumber + 1 : 1;

    // Check if student has reached max attempts
    if (currentAttempt > quiz.maxAttempts) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: `Maximum attempts (${quiz.maxAttempts}) reached for this quiz` 
      });
    }

    // Check if retake is allowed and enforce cooldown period
    if (latestSubmission && quiz.maxAttempts > 1) {
      if (!quiz.retakePolicy.allowRetake) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: 'Retakes are not allowed for this quiz' 
        });
      }

      const daysSinceLastAttempt = (Date.now() - new Date(latestSubmission.submittedAt)) / (1000 * 60 * 60 * 24);
      
      if (daysSinceLastAttempt < quiz.retakePolicy.daysBetweenAttempts) {
        const remainingDays = (quiz.retakePolicy.daysBetweenAttempts - daysSinceLastAttempt).toFixed(1);
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: `Please wait ${remainingDays} more days before attempting again` 
        });
      }

      // Check if student already passed and doesn't need to retake
      const lastScorePercentage = (latestSubmission.score / quiz.totalMarks) * 100;
      if (lastScorePercentage >= quiz.retakePolicy.minScoreToPass) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: `You already passed this quiz with ${lastScorePercentage.toFixed(1)}% score` 
        });
      }
    }

    // Accurate auto-grade logic
    const questions = quiz.questions || [];
    const numQuestions = questions.length;
    if (numQuestions === 0) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({ success: false, message: 'Quiz has no questions' });
    }

    if (answers.length !== numQuestions) {
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: `Expected ${numQuestions} answers, got ${answers.length}` 
      });
    }

    let totalScore = 0;
    const detailedAnswers = [];

    // Calculate score accurately with proper marks per question
    for (let i = 0; i < numQuestions; i++) {
      const question = questions[i];
      const studentAnswer = answers[i];
      
      // Validate student answer
      if (typeof studentAnswer !== 'number' || studentAnswer < 0 || studentAnswer >= question.options.length) {
        await session.abortTransaction();
        await session.endSession();
        return res.status(400).json({ 
          success: false, 
          message: `Invalid answer for question ${i + 1}` 
        });
      }

      const isCorrect = studentAnswer === question.correctAnswer;
      
      // Calculate marks per question - use question.marks if defined, otherwise distribute equally
      const marksPerQuestion = question.marks > 0 ? 
        question.marks : 
        Math.round((quiz.totalMarks / numQuestions) * 100) / 100; // Round to 2 decimal places
      
      const marksAwarded = isCorrect ? marksPerQuestion : 0;
      totalScore += marksAwarded;
      
      detailedAnswers.push({
        questionIndex: i,
        selectedOption: studentAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: isCorrect,
        marksAwarded: marksAwarded,
        questionText: question.question,
        options: question.options,
        questionMarks: marksPerQuestion
      });
    }

    // Ensure score doesn't exceed total marks
    const finalScore = Math.min(totalScore, quiz.totalMarks);
    const percentage = parseFloat(((finalScore / quiz.totalMarks) * 100).toFixed(1));

    const submission = new QuizSubmission({
      quiz: quiz._id,
      course: quiz.course,
      student: user._id,
      answers: detailedAnswers,
      score: finalScore,
      percentage: percentage,
      totalMarks: quiz.totalMarks,
      attemptNumber: currentAttempt,
      submittedAt: new Date()
    });

    await submission.save({ session });
    await session.commitTransaction();
    await session.endSession();

    console.log(`Quiz submitted: Student ${user._id}, Quiz ${quizId}, Score: ${finalScore}/${quiz.totalMarks} (${percentage}%)`);

    res.json({ 
      success: true, 
      data: submission, 
      message: 'Quiz submitted and graded successfully', 
      score: finalScore,
      total: quiz.totalMarks,
      percentage: percentage,
      attemptNumber: currentAttempt,
      maxAttempts: quiz.maxAttempts,
      performance: getPerformanceMessage(percentage)
    });
  } catch (err) {
    await session.abortTransaction();
    await session.endSession();
    
    console.error('Submit quiz error:', err);
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Duplicate submission detected. Please refresh and try again.' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error during submission',
      details: err.message 
    });
  }
});

// Helper function to get performance message
function getPerformanceMessage(percentage) {
  if (percentage >= 90) return "Excellent!";
  if (percentage >= 80) return "Very Good!";
  if (percentage >= 70) return "Good!";
  if (percentage >= 60) return "Satisfactory";
  if (percentage >= 50) return "Needs Improvement";
  return "Keep Practicing";
}

// Student: get own result for a quiz - FIXED
// GET /api/quizzes/:quizId/my-result
router.get('/:quizId/my-result', auth, async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // Get latest submission for this student and quiz
    const latestSubmission = await QuizSubmission.findOne({ 
      quiz: quiz._id, 
      student: user._id 
    }).sort({ attemptNumber: -1 });

    if (!latestSubmission) {
      return res.json({ success: true, data: null }); // Return null instead of error
    }

    // Ensure score is properly formatted
    const sanitizedSubmission = {
      ...latestSubmission.toObject(),
      score: Number(latestSubmission.score) || 0
    };

    res.json({ success: true, data: sanitizedSubmission });
  } catch (err) {
    console.error('Get my result error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Teacher/Admin: view all submissions for a quiz - Show only latest attempt per student
// GET /api/quizzes/:quizId/submissions
router.get('/:quizId/submissions', auth, async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(quizId).populate('course');
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // permission: admin or teacher of course
    if (user.role !== 'admin') {
      const courseDoc = await Course.findById(quiz.course._id);
      if (!courseDoc.teachers.some(t => t.toString() === user._id.toString())) {
        return res.status(403).json({ success: false, message: 'Only course teachers or admins can view submissions' });
      }
    }

    // Don't check if quiz is expired - allow viewing submissions for expired quizzes

    // Get all submissions sorted by attempt number (highest first)
    const allSubmissions = await QuizSubmission.find({ quiz: quiz._id })
      .populate('student', 'name email userId')
      .sort({ attemptNumber: -1, submittedAt: -1 });

    // Filter to get only the latest attempt per student
    const latestSubmissionsMap = new Map();
    
    allSubmissions.forEach(submission => {
      const studentId = submission.student._id.toString();
      
      if (!latestSubmissionsMap.has(studentId) || 
          submission.attemptNumber > latestSubmissionsMap.get(studentId).attemptNumber) {
        latestSubmissionsMap.set(studentId, submission);
      }
    });

    const latestSubmissions = Array.from(latestSubmissionsMap.values())
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Sanitize submissions to ensure score is properly formatted
    const sanitizedSubmissions = latestSubmissions.map(submission => {
      const submissionObj = submission.toObject();
      
      let calculatedScore = submissionObj.score;
      
      if (isNaN(calculatedScore) || calculatedScore === null || calculatedScore === undefined) {
        calculatedScore = submissionObj.answers.reduce((total, answer) => {
          return total + (answer.marksAwarded || 0);
        }, 0);
      }
      
      return {
        ...submissionObj,
        score: Number(calculatedScore) || 0,
        student: {
          ...submissionObj.student,
          userNumericId: submissionObj.student.userNumericId
        }
      };
    });

    res.json({ success: true, data: sanitizedSubmissions });
  } catch (err) {
    console.error('Get submissions error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get student's remaining attempts for a quiz
// GET /api/quizzes/:quizId/attempts-remaining
router.get('/:quizId/attempts-remaining', auth, async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // ensure same school
    if (quiz.school.toString() !== user.school.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const submissions = await QuizSubmission.find({ 
      quiz: quiz._id, 
      student: user._id 
    });

    const attemptsUsed = submissions.length;
    const attemptsRemaining = Math.max(0, quiz.maxAttempts - attemptsUsed);

    // Check if student can retake based on retake policy (only if maxAttempts > 1)
    let canRetake = attemptsRemaining > 0;
    let retakeMessage = '';

    if (submissions.length > 0 && quiz.maxAttempts > 1 && quiz.retakePolicy.allowRetake) {
      const lastSubmission = submissions.sort((a, b) => 
        new Date(b.submittedAt) - new Date(a.submittedAt)
      )[0];
      
      // Ensure score is a number
      const lastScore = Number(lastSubmission.score) || 0;
      const lastScorePercentage = (lastScore / quiz.totalMarks) * 100;
      const daysSinceLastAttempt = (Date.now() - new Date(lastSubmission.submittedAt)) / (1000 * 60 * 60 * 24);
      
      if (lastScorePercentage >= quiz.retakePolicy.minScoreToPass) {
        canRetake = false;
        retakeMessage = `You already passed with ${lastScorePercentage.toFixed(1)}% score`;
      } else if (daysSinceLastAttempt < quiz.retakePolicy.daysBetweenAttempts) {
        canRetake = false;
        const remainingDays = (quiz.retakePolicy.daysBetweenAttempts - daysSinceLastAttempt).toFixed(1);
        retakeMessage = `Wait ${remainingDays} more days to retake`;
      }
    }

    res.json({
      success: true,
      data: {
        attemptsUsed,
        attemptsRemaining,
        maxAttempts: quiz.maxAttempts,
        canRetake,
        retakeMessage,
        retakePolicy: quiz.retakePolicy
      }
    });
  } catch (err) {
    console.error('Get attempts remaining error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get all attempts for a specific student (for teachers)
// GET /api/quizzes/:quizId/student/:studentId/attempts
router.get('/:quizId/student/:studentId/attempts', auth, async (req, res) => {
  try {
    const { quizId, studentId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quizId) || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid quiz ID or student ID' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // permission: admin or teacher of course
    if (user.role !== 'admin') {
      const courseDoc = await Course.findById(quiz.course);
      if (!courseDoc.teachers.some(t => t.toString() === user._id.toString())) {
        return res.status(403).json({ success: false, message: 'Only course teachers or admins can view student attempts' });
      }
    }

    const submissions = await QuizSubmission.find({
      quiz: quiz._id,
      student: studentId
    })
      .populate('student', 'name email userId')
      .sort({ attemptNumber: 1 });

    // Sanitize submissions to ensure proper score formatting
    const sanitizedSubmissions = submissions.map(submission => {
      const submissionObj = submission.toObject();
      
      let calculatedScore = submissionObj.score;
      
      if (isNaN(calculatedScore) || calculatedScore === null || calculatedScore === undefined) {
        calculatedScore = submissionObj.answers.reduce((total, answer) => {
          return total + (answer.marksAwarded || 0);
        }, 0);
      }
      
      return {
        ...submissionObj,
        score: Number(calculatedScore) || 0,
        student: {
          ...submissionObj.student,
          userNumericId: submissionObj.student.userNumericId
        }
      };
    });

    res.json({ success: true, data: sanitizedSubmissions });
  } catch (err) {
    console.error('Get student attempts error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Export quiz submissions to CSV (for teachers/admins) - UPDATED with separate columns
// GET /api/quizzes/:quizId/export
router.get('/:quizId/export', auth, async (req, res) => {
  try {
    const { quizId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(quizId)) {
      return res.status(400).json({ success: false, message: 'Invalid quiz ID' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    // permission: admin or teacher of course
    if (user.role !== 'admin') {
      const courseDoc = await Course.findById(quiz.course);
      if (!courseDoc.teachers.some(t => t.toString() === user._id.toString())) {
        return res.status(403).json({ success: false, message: 'Only course teachers or admins can export submissions' });
      }
    }

    // Don't check if quiz is expired - allow exporting submissions for expired quizzes

    // Get all submissions sorted by attempt number (highest first)
    const allSubmissions = await QuizSubmission.find({ quiz: quiz._id })
      .populate('student', 'name email userId')
      .sort({ attemptNumber: -1, submittedAt: -1 });

    // Filter to get only the latest attempt per student
    const latestSubmissionsMap = new Map();
    
    allSubmissions.forEach(submission => {
      const studentId = submission.student._id.toString();
      
      if (!latestSubmissionsMap.has(studentId) || 
          submission.attemptNumber > latestSubmissionsMap.get(studentId).attemptNumber) {
        latestSubmissionsMap.set(studentId, submission);
      }
    });

    const latestSubmissions = Array.from(latestSubmissionsMap.values())
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    // Prepare CSV data with separate columns for Obtained Marks and Total Marks
    const headers = ['Student Name', 'Student ID', 'Email', 'Obtained Marks', 'Total Marks', 'Percentage', 'Correct Answers', 'Incorrect Answers', 'Total Questions', 'Submitted At'];
    
    const csvData = latestSubmissions.map(submission => {
      // Ensure score is properly formatted
      const safeScore = Number(submission.score) || submission.answers.reduce((total, answer) => total + (answer.marksAwarded || 0), 0);
      const percentage = quiz.totalMarks > 0 ? ((safeScore / quiz.totalMarks) * 100).toFixed(1) : '0.0';
      
      // Calculate correct/incorrect answers
      const correct = submission.answers.filter(answer => answer.isCorrect).length;
      const incorrect = submission.answers.length - correct;

      return [
        submission.student.name,
        submission.student.userId || submission.student._id,
        submission.student.email || 'N/A',
        safeScore, // Obtained Marks
        quiz.totalMarks, // Total Marks
        `${percentage}%`,
        correct,
        incorrect,
        quiz.questions.length,
        new Date(submission.submittedAt).toLocaleString()
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=quiz-submissions-${quiz.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.csv`);
    res.send(csvContent);

  } catch (err) {
    console.error('Export submissions error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Debug route to test quiz notifications
router.get('/debug/quiz-notifications/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId)
      .populate('students', 'name email role')
      .populate({
        path: 'section',
        populate: {
          path: 'students',
          select: 'name email role'
        }
      });
    
    if (!course) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    // Get all unique students
    let studentIds = [];
    
    // From course students
    if (course.students && course.students.length > 0) {
      const courseStudentIds = course.students
        .filter(student => student.role === 'student')
        .map(student => student._id);
      studentIds = studentIds.concat(courseStudentIds);
    }
    
    // From section students
    if (course.section && course.section.students) {
      const sectionStudentIds = course.section.students
        .filter(student => student.role === 'student')
        .map(student => student._id);
      studentIds = studentIds.concat(sectionStudentIds);
    }
    
    // Remove duplicates
    const uniqueStudentIds = [...new Set(studentIds.map(id => id.toString()))];
    const students = await User.find({ _id: { $in: uniqueStudentIds } }).select('name email role');
    
    res.json({
      success: true,
      data: {
        course: course.name,
        totalStudents: students.length,
        students: students.map(s => ({ name: s.name, email: s.email, role: s.role })),
        courseStudents: course.students?.length || 0,
        sectionStudents: course.section?.students?.length || 0
      }
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;