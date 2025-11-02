const cron = require('node-cron');
const DueDateConfig = require('../Models/DueDateConfig');
const Student = require('../Models/Student');
const Teacher = require('../Models/Teacher');
const Faculty = require('../Models/Faculty');
const Admin = require('../Models/Admin');
const { getDate } = require('date-fns');

// Function to reset payments on due date
async function resetPaymentsOnDueDate() {
  try {
    const config = await DueDateConfig.getConfig();
    const today = new Date();
    const todayDay = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();
    
    // Check if it's the due date and we haven't applied it this month
    if (todayDay === config.dayOfMonth) {
      // Check if we already applied it this month
      if (config.lastApplied) {
        const lastApplied = new Date(config.lastApplied);
        if (lastApplied.getMonth() === todayMonth && 
            lastApplied.getFullYear() === todayYear) {
          console.log('Already reset payments this month');
          return;
        }
      }
      
      console.log(`Resetting payments for due date: Day ${config.dayOfMonth}`);
      
      // Reset student fees to unpaid
      const students = await Student.find().populate('user');
      for (const student of students) {
        student.feesHistory.unshift({
          amount: student.fees || 0,
          date: new Date(),
          status: 'pending'
        });
        await student.save();
      }
      console.log(`Reset fees for ${students.length} students`);
      
      // Reset staff salaries to unpaid (teachers, faculty, admins)
      const teachers = await Teacher.find().populate('user');
      for (const teacher of teachers) {
        teacher.salaryHistory.unshift({
          amount: teacher.salary || 0,
          date: new Date(),
          status: 'pending'
        });
        await teacher.save();
      }
      console.log(`Reset salaries for ${teachers.length} teachers`);
      
      const faculty = await Faculty.find().populate('user');
      for (const facultyMember of faculty) {
        facultyMember.salaryHistory.unshift({
          amount: facultyMember.salary || 0,
          date: new Date(),
          status: 'pending'
        });
        await facultyMember.save();
      }
      console.log(`Reset salaries for ${faculty.length} faculty`);
      
      const admins = await Admin.find().populate('user');
      for (const admin of admins) {
        admin.salaryHistory.unshift({
          amount: admin.salary || 0,
          date: new Date(),
          status: 'pending'
        });
        await admin.save();
      }
      console.log(`Reset salaries for ${admins.length} admins`);
      
      // Update last applied date
      config.lastApplied = new Date();
      await config.save();
      
      console.log('All payments reset to pending status for due date');
    }
  } catch (error) {
    console.error('Error resetting payments:', error);
  }
}

// Schedule the cron job to run daily at midnight
function startCronJobs() {
  // Run every day at 00:00
  cron.schedule('0 0 * * *', () => {
    console.log('Running daily payment reset check...');
    resetPaymentsOnDueDate();
  });
  
  console.log('Cron jobs started');
}

module.exports = { startCronJobs, resetPaymentsOnDueDate };