const { io } = require('../index');

class SocketService {
  // Send notification to specific user
  static async sendNotificationToUser(userId, notification) {
    try {
      if (!io) {
        console.error('Socket.IO not initialized');
        return false;
      }

      // Check if user is connected
      const userRoom = io.sockets.adapter.rooms.get(userId.toString());
      const isConnected = userRoom && userRoom.size > 0;

      if (isConnected) {
        io.to(userId.toString()).emit('newNotification', {
          ...notification,
          deliveredVia: 'socket',
          deliveredAt: new Date()
        });
        console.log(`📤 Notification sent via Socket.IO to user ${userId}`);
        return true;
      } else {
        console.log(`📱 User ${userId} is offline. Notification will be delivered when they come online.`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending notification via Socket.IO:', error);
      return false;
    }
  }

  // Send notification to multiple users
  static async sendNotificationToUsers(userIds, notification) {
    try {
      let deliveredCount = 0;
      const deliveryPromises = userIds.map(async (userId) => {
        const delivered = await this.sendNotificationToUser(userId, notification);
        if (delivered) deliveredCount++;
        return delivered;
      });

      await Promise.all(deliveryPromises);
      console.log(`📤 Notifications delivered to ${deliveredCount}/${userIds.length} users`);
      return deliveredCount;
    } catch (error) {
      console.error('❌ Error sending notifications to users:', error);
      return 0;
    }
  }

  // Broadcast to all connected users
  static broadcastNotification(notification) {
    try {
      if (!io) {
        console.error('Socket.IO not initialized');
        return 0;
      }

      io.emit('newNotification', {
        ...notification,
        isBroadcast: true,
        deliveredVia: 'broadcast',
        deliveredAt: new Date()
      });

      const connectedCount = io.engine.clientsCount;
      console.log(`📢 Broadcast notification to ${connectedCount} connected users`);
      return connectedCount;
    } catch (error) {
      console.error('❌ Error broadcasting notification:', error);
      return 0;
    }
  }

  // Get connected users count
  static getConnectedUsersCount() {
    if (!io) return 0;
    
    // Count unique user rooms (excluding socket ID rooms)
    const rooms = io.sockets.adapter.rooms;
    let userCount = 0;
    
    for (const [roomName, room] of rooms) {
      // Assuming user IDs are 24 character MongoDB ObjectIds
      if (roomName.length === 24 && room.size > 0) {
        userCount++;
      }
    }
    
    return userCount;
  }

  // Check if specific user is connected
  static isUserConnected(userId) {
    if (!io) return false;
    
    const userRoom = io.sockets.adapter.rooms.get(userId.toString());
    return userRoom && userRoom.size > 0;
  }

  // Get user's socket information
  static getUserSockets(userId) {
    if (!io) return [];
    
    const userRoom = io.sockets.adapter.rooms.get(userId.toString());
    if (!userRoom) return [];
    
    return Array.from(userRoom);
  }

  // Force disconnect user (admin function)
  static disconnectUser(userId) {
    if (!io) return 0;
    
    const socketIds = this.getUserSockets(userId);
    socketIds.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    });
    
    console.log(`🔴 Disconnected ${socketIds.length} sockets for user ${userId}`);
    return socketIds.length;
  }
}

module.exports = SocketService;