const Section = require('./Models/section');
const cron = require('node-cron');

// Check for expired sessions every minute
cron.schedule('* * * * *', async () => {
  try {
    await Section.checkExpiredSessions();
  } catch (error) {
    console.error('Error checking expired sessions:', error);
  }
});

console.log('Session expiration checker started');

module.exports = cron;