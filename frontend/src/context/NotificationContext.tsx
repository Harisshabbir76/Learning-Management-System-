"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '@/utils/notifications';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [newNotification, setNewNotification] = useState(null);
  const [socket, setSocket] = useState(null);
  const { user, isAuthenticated } = useAuth();

  // Fetch notifications with pagination and filters
  const fetchNotifications = useCallback(async (params = {}) => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    try {
      const response = await notificationAPI.getMyNotifications(params);
      if (response.data.success) {
        setNotifications(response.data.data);
        setUnreadCount(response.data.unreadCount);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      const response = await notificationAPI.markAsRead(notificationId);
      if (response.data.success) {
        setNotifications(prev =>
          prev.map(notification =>
            notification._id === notificationId
              ? { ...notification, isRead: true, readBy: [...notification.readBy, { user: user.id }] }
              : notification
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Emit via socket if available
        if (socket) {
          socket.emit('markNotificationRead', {
            notificationId,
            userId: user.id
          });
        }
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      const response = await notificationAPI.markAllRead();
      if (response.data.success) {
        setNotifications(prev =>
          prev.map(notification => ({
            ...notification,
            isRead: true,
            readBy: notification.readBy.some(read => read.user === user.id) 
              ? notification.readBy 
              : [...notification.readBy, { user: user.id }]
          }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Get notification statistics
  const getStats = async () => {
    try {
      const response = await notificationAPI.getStats();
      return response.data;
    } catch (error) {
      console.error('Failed to fetch notification stats:', error);
      return null;
    }
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const initializeSocket = () => {
      try {
        const socketIo = require('socket.io-client');
        const newSocket = socketIo(process.env.NEXT_PUBLIC_API_URL, {
          transports: ['websocket', 'polling']
        });

        newSocket.on('connect', () => {
          console.log('Socket connected');
          // Register user for targeted notifications
          newSocket.emit('register', user.id);
        });

        newSocket.on('newNotification', (notification) => {
          console.log('New notification received:', notification);
          setNotifications(prev => [notification, ...prev]);
          setUnreadCount(prev => prev + 1);
          setNewNotification(notification);
          setShowPopup(true);
          
          // Auto-hide popup after 5 seconds
          setTimeout(() => {
            setShowPopup(false);
          }, 5000);
        });

        newSocket.on('notificationRead', (data) => {
          console.log('Notification read confirmed:', data);
        });

        newSocket.on('disconnect', () => {
          console.log('Socket disconnected');
        });

        newSocket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
        });

        setSocket(newSocket);
      } catch (error) {
        console.error('Failed to initialize socket:', error);
      }
    };

    initializeSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isAuthenticated, user]);

  // Fetch initial notifications
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated, fetchNotifications]);

  const value = {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    getStats,
    showPopup,
    setShowPopup,
    newNotification,
    socket
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};