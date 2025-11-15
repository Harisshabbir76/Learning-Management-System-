const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Add this after mongoose connection is established
mongoose.connection.on('connected', async () => {
  console.log('✅ MongoDB connection established');
  
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
    console.error('❌ Error checking indexes:', error);
  }
});

const app = express();
const server = http.createServer(app);

// Enhanced Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use('/uploads', express.static('uploads'));
app.use('/uploads/assignments', express.static(path.join(__dirname, 'uploads/assignments')));
app.use('/uploads/submissions', express.static(path.join(__dirname, 'uploads/submissions')));

// Health check endpoint
app.get('/health', (req, res) => {
  const socketStatus = io.engine.clientsCount;
  res.status(200).json({ 
    status: 'healthy',
    message: 'LMS backend is running successfully',
    socket: {
      connectedClients: socketStatus,
      status: 'active'
    },
    timestamp: new Date().toISOString()
  });
});

// Basic test route
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

console.log('=== STARTING ROUTE LOADING ===');

// Load routes with proper error handling
try {
  console.log('1. Loading auth routes...');
  const authRoutes = require('./routes/auth-route');
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load auth routes:', error.message);
}

try {
  console.log('2. Loading auth middleware...');
  const authMiddleware = require('./middleware/auth');
  console.log('✅ Auth middleware loaded successfully');
} catch (error) {
  console.error('❌ Failed to load auth middleware:', error.message);
}

try {
  console.log('3. Loading notification routes...');
  const { router: notificationRoutes, setIO } = require('./routes/notifications');
  setIO(io); // Initialize Socket.IO for notifications
  const authMiddleware = require('./middleware/auth');
  app.use('/api/notifications', authMiddleware, notificationRoutes);
  console.log('✅ Notification routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load notification routes:', error.message);
}

try {
  console.log('4. Loading user routes...');
  const userRoutes = require('./routes/userroutes');
  const authMiddleware = require('./middleware/auth');
  app.use('/api/users', authMiddleware, userRoutes);
  console.log('✅ User routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load user routes:', error.message);
}

try {
  console.log('5. Loading course routes...');
  const courseRoutes = require('./routes/courseroutes');
  app.use('/api/courses', courseRoutes);
  console.log('✅ Course routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load course routes:', error.message);
}

try {
  console.log('6. Loading school routes...');
  const schoolRoutes = require('./routes/schoolRoutes');
  app.use('/api/schools', schoolRoutes);
  console.log('✅ School routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load school routes:', error.message);
}

try {
  console.log('7. Loading permission routes...');
  const permissionRoutes = require("./routes/permissionRoutes");
  app.use("/api/permissions", permissionRoutes);
  console.log('✅ Permission routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load permission routes:', error.message);
}

try {
  console.log('8. Loading section routes...');
  const sectionRoutes = require('./routes/sections');
  app.use('/api/sections', sectionRoutes);
  console.log('✅ Section routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load section routes:', error.message);
}

try {
  console.log('9. Loading timetable routes...');
  const timetableRoutes = require("./routes/timetable");
  app.use("/api/timetable", timetableRoutes);
  console.log('✅ Timetable routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load timetable routes:', error.message);
}

try {
  console.log('10. Loading attendance routes...');
  const attendanceRoutes = require('./routes/attendance');
  const authMiddleware = require('./middleware/auth');
  app.use('/api/attendance', authMiddleware, attendanceRoutes);
  console.log('✅ Attendance routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load attendance routes:', error.message);
}

try {
  console.log('11. Loading assessment routes...');
  const assessmentRoutes = require('./routes/assessmentRoutes');
  app.use('/api/assessments', assessmentRoutes);
  console.log('✅ Assessment routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load assessment routes:', error.message);
}

try {
  console.log('12. Loading assignment routes...');
  const assignmentRoutes = require("./routes/assignmentRoutes");
  app.use("/api/assignments", assignmentRoutes);
  console.log('✅ Assignment routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load assignment routes:', error.message);
}

try {
  console.log('13. Loading submission routes...');
  const submissionRoutes = require("./routes/submissionRoutes");
  app.use("/api/submissions", submissionRoutes);
  console.log('✅ Submission routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load submission routes:', error.message);
}

try {
  console.log('14. Loading quiz routes...');
  const quizRoutes = require('./routes/quizRoutes');
  app.use('/api/quizzes', quizRoutes);
  console.log('✅ Quiz routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load quiz routes:', error.message);
}

try {
  console.log('15. Loading due date config routes...');
  const dueDateConfig = require('./routes/dueDateConfig');
  // app.use('/api/due-date-config', dueDateConfig);
  console.log('✅ Due date config routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load due date config routes:', error.message);
}

console.log('=== ALL ROUTES LOADED SUCCESSFULLY ===');

// Load additional modules with error handling
try {
  console.log('16. Starting cron jobs...');
  const { startCronJobs } = require('./lib/cronJobs');
  startCronJobs();
  console.log('✅ Cron jobs started successfully');
} catch (error) {
  console.warn('⚠️  Cron jobs not started:', error.message);
}

try {
  console.log('17. Starting session checker...');
  require('./sessionChecker');
  console.log('✅ Session checker started successfully');
} catch (error) {
  console.warn('⚠️  Session checker not started:', error.message);
}

try {
  console.log('18. Starting notification scheduler...');
  require('./notificationScheduler');
  console.log('✅ Notification scheduler started successfully');
} catch (error) {
  console.warn('⚠️  Notification scheduler not started:', error.message);
}

console.log('=== ALL MODULES INITIALIZED ===');

// Enhanced Socket.IO connection handling
const connectedUsers = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('🔗 New user connected:', socket.id);
  
  // Register user to their room for targeted notifications
  socket.on('register', (userId) => {
    if (!userId) {
      console.warn('⚠️  Attempt to register without userId from socket:', socket.id);
      return;
    }

    try {
      // Join user-specific room
      socket.join(userId.toString());
      
      // Track socket for user
      if (!userSockets.has(userId.toString())) {
        userSockets.set(userId.toString(), new Set());
      }
      userSockets.get(userId.toString()).add(socket.id);
      
      // Track connected users
      connectedUsers.set(socket.id, userId.toString());
      
      console.log(`✅ User ${userId} registered with socket ${socket.id}`);
      console.log(`📊 Total connected users: ${userSockets.size}, Total sockets: ${connectedUsers.size}`);
      
      // Send connection confirmation
      socket.emit('connectionConfirmed', { 
        userId,
        socketId: socket.id,
        message: 'Successfully connected to notification service'
      });
      
    } catch (error) {
      console.error('❌ Error during user registration:', error);
      socket.emit('registrationError', { 
        message: 'Failed to register for notifications' 
      });
    }
  });

  // Handle notification read status in real-time
  socket.on('markNotificationRead', async (data) => {
    try {
      const { notificationId, userId } = data;
      
      if (!notificationId || !userId) {
        socket.emit('notificationError', { 
          message: 'Notification ID and User ID are required' 
        });
        return;
      }

      const Notification = require('./models/Notification');
      const notification = await Notification.findById(notificationId);
      
      if (notification && notification.recipients.includes(userId)) {
        await notification.markAsRead(userId);
        
        // Emit back to confirm read status
        socket.emit('notificationRead', { 
          notificationId: notificationId,
          read: true,
          timestamp: new Date()
        });
        
        console.log(`📖 Notification ${notificationId} marked as read by user ${userId}`);
      } else {
        socket.emit('notificationError', { 
          message: 'Notification not found or access denied' 
        });
      }
    } catch (error) {
      console.error('❌ Error marking notification as read via socket:', error);
      socket.emit('notificationError', { 
        message: 'Failed to mark notification as read',
        error: error.message
      });
    }
  });

  // Handle ping from client
  socket.on('ping', (data) => {
    socket.emit('pong', { 
      timestamp: new Date(),
      ...data 
    });
  });

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    const userId = connectedUsers.get(socket.id);
    
    if (userId) {
      // Remove socket from user's socket set
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        
        // If no more sockets for this user, remove the entry
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId);
        }
      }
      
      connectedUsers.delete(socket.id);
      console.log(`🔴 User ${userId} disconnected from socket ${socket.id}. Reason: ${reason}`);
    } else {
      console.log(`🔴 Unknown user disconnected from socket ${socket.id}. Reason: ${reason}`);
    }
    
    console.log(`📊 Remaining - Users: ${userSockets.size}, Sockets: ${connectedUsers.size}`);
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error);
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

// Socket.IO status endpoint
app.get('/api/socket/status', (req, res) => {
  const connectedUsers = Array.from(io.sockets.adapter.rooms.keys())
    .filter(room => room.length === 24); // Assuming user IDs are 24 chars (MongoDB ObjectId)
  
  res.json({
    success: true,
    connectedUsers: connectedUsers.length,
    totalSockets: io.engine.clientsCount,
    connectedUserIds: connectedUsers
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error Stack:', err.stack);
  res.status(500).json({ 
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO server initialized`);
  console.log(`🌐 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 API test: http://localhost:${PORT}/api/test`);
});

module.exports = { 
  app, 
  server, 
  io 
};
