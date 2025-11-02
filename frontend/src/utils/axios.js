  // utils/axios.js
  import axios from 'axios';

  const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
  });

  // Request interceptor to add token to headers
  api.interceptors.request.use(
    config => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    },
    error => {
      return Promise.reject(error);
    }
  );

  // Interceptor to catch 401 (JWT expired)
  api.interceptors.response.use(
    response => response,
    error => {
      if (error.response && error.response.status === 401) {
        if (error.response.data.msg === 'Token expired') {
          // Custom event to trigger logout modal
          window.dispatchEvent(new Event('jwt-expired'));
        }
      }
      return Promise.reject(error);
    }
  );

  export default api;
