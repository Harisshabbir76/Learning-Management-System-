const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const authRoutes = require('./routes/auth-route');
const userRoutes = require('./routes/userroutes');
const courseRoutes = require('./routes/courseroutes');
const schoolRoutes = require('./routes/schoolRoutes');
const permissionRoutes = require("./routes/permissionRoutes");
const timetableRoutes = require("./routes/timetable");
const sectionRoutes = require('./routes/sections');
const notificationRoutes = require('./routes/notifications');
const attendanceRoutes = require('./routes/attendance');
const assessmentRoutes=require('./routes/assessmentRoutes');
const assignmentRoutes = require("./routes/assignmentRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const quizRoutes = require('./routes/quizRoutes');
const authMiddleware = require('./middleware/auth');
const { startCronJobs } = require('./lib/cronJobs');
const dueDateConfig = require('./routes/dueDateConfig');
require('./sessionChecker');
require('./notificationScheduler');
const path = require('path');

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));


// Add this after mongoose connection is established
mongoose.connection.on('connected', async () => {
  console.log('Connected to MongoDB');
  
  // Validate that no unique indexes exist
  try {
    const collection = mongoose.connection.collection('quizsubmissions');
    const indexes = await collection.indexes();
    
    const uniqueIndexes = indexes.filter(index => 
      index.unique && index.name !== '_id_'
    );
    
    if (uniqueIndexes.length > 0) {
      console.warn('⚠️  WARNING: Unique indexes found on quizsubmissions:', uniqueIndexes.map(i => i.name));
    } else {
      console.log('✅ QuizSubmission indexes are correctly configured (non-unique)');
    }
  } catch (error) {
    console.error('Error checking indexes:', error);
  }
});




const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Start cron jobs
startCronJobs();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/schools', schoolRoutes);
app.use("/api/permissions", permissionRoutes);
app.use('/api/sections', sectionRoutes);
app.use("/api/timetable", timetableRoutes);
app.use('/api/attendance', authMiddleware, attendanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assessments', assessmentRoutes); 
app.use("/api/assignments", assignmentRoutes);
app.use("/api/submissions", submissionRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/due-date-config', dueDateConfig);
app.use('/uploads', express.static('uploads'));
app.use('/uploads/assignments', express.static(path.join(__dirname, 'uploads/assignments')));
app.use('/uploads/submissions', express.static(path.join(__dirname, 'uploads/submissions')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    message: 'LMS backend is running successfully'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});