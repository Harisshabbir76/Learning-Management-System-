// Create a file called notificationScheduler.js
const cron = require('node-cron');
const Notification = require('./Models/Notification');
const mongoose = require('mongoose');

const checkScheduledNotifications = async () => {
  try {
    const now = new Date();
    const notifications = await Notification.find({
      status: 'scheduled',
      scheduledFor: { $lte: now }
    });

    for (const notification of notifications) {
      notification.status = 'sent';
      notification.sentAt = now;
      await notification.save();
      console.log(`Sent scheduled notification: ${notification.title}`);
    }
  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
  }
};

// Run every minute
cron.schedule('* * * * *', checkScheduledNotifications);

module.exports = checkScheduledNotifications;