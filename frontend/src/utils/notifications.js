// utils/notifications.js
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const notificationAPI = {
  // Create notification
  create: (data) => apiClient.post('/api/notifications', data),
  
  // Get user's notifications - ADD /api/ prefix here
  getMyNotifications: (params) => apiClient.get('/api/notifications/my-notifications', { params }),
  
  // Get all notifications (for admin/faculty)
  getAllNotifications: (params) => apiClient.get('/api/notifications', { params }),
  
  // Mark notification as read
  markAsRead: (id) => apiClient.post(`/api/notifications/${id}/read`),
  
  // Mark all notifications as read
  markAllRead: () => apiClient.post('/api/notifications/mark-all-read'),
  
  // Get notification statistics
  getStats: () => apiClient.get('/api/notifications/stats'),
  
  // Delete notification
  delete: (id) => apiClient.delete(`/api/notifications/${id}`),
  
  // Get unread count only
  getUnreadCount: () => apiClient.get('/api/notifications/my-notifications', {
    params: { limit: 1, page: 1 }
  }),
  
  // Get grade-specific notifications for students
  getGradeNotifications: (params) => apiClient.get('/api/assignments/notifications/grades', { params })
};

export default notificationAPI;
