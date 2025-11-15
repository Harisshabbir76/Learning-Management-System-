// Create a file called notificationScheduler.js
const cron = require('node-cron');
const Notification = require('./Models/Notification');
const { processAndSendNotification } = require('./routes/notifications');
const mongoose = require('mongoose');

const checkScheduledNotifications = async () => {
  try {
    const now = new Date();
    const notifications = await Notification.find({
      status: 'scheduled',
      scheduledFor: { $lte: now }
    });

    for (const notification of notifications) {
      await processAndSendNotification(notification);
    }
  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
  }
};

// Run every minute
cron.schedule('* * * * *', checkScheduledNotifications);

module.exports = checkScheduledNotifications;
