'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { notificationAPI } from '../utils/notifications';

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  signup: (userData: any) => Promise<any>;
  logout: () => void;
  refreshUser: (force?: boolean) => Promise<boolean>;
  isAuthenticated: boolean;
  unreadCount: number;
  fetchUnreadCount: () => Promise<void>;
  themeColor: string;
  schoolId: string;
  permissions: string[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  const safeJsonParse = (str: string) => {
    try { return JSON.parse(str); } 
    catch (e) { return null; }
  };

  const validateToken = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/validate-token`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.valid;
      }
      return false;
    } catch (e) { return false; }
  };

  const refreshToken = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) return await res.json();
      return null;
    } catch (e) { return null; }
  };

  const fetchUserData = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return data.success && data.user ? data.user : null;
      }
      return null;
    } catch (e) { return null; }
  };

  const refreshUser = async (force = false) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { if (force) logout(); return false; }

      let valid = await validateToken(token);
      let finalToken = token;

      if (!valid) {
        const refreshData = await refreshToken(token);
        if (refreshData?.success && refreshData.token) {
          finalToken = refreshData.token;
          localStorage.setItem('token', finalToken);
        } else {
          if (force) logout();
          return false;
        }
      }

      const userData = await fetchUserData(finalToken);
      if (userData) {
        setUser(userData);
        localStorage.setItem('userData', JSON.stringify(userData));
        return true;
      }

      if (force) logout();
      return false;
    } catch (error) {
      console.error('Refresh user error:', error);
      if (force) logout();
      return false;
    }
  };

  // FIXED: fetchUnreadCount now properly filters assignment notifications for non-students
  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    
    try {
      // Get all unread notifications first
      const notificationsRes = await notificationAPI.getMyNotifications({
        limit: 100,
        unreadOnly: true
      });
      
      if (notificationsRes.data.success) {
        let unreadNotifications = notificationsRes.data.data || [];
        
        // 🚨 CRITICAL FIX: If user is NOT a student, filter out assignment notifications
        if (user.role !== 'student') {
          unreadNotifications = unreadNotifications.filter(
            (notification: any) => notification.type !== 'assignment'
          );
        }
        
        setUnreadCount(unreadNotifications.length);
      } else {
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to fetch unread count', error);
      setUnreadCount(0);
    }
  }, [user]);

  // Initialize auth - only run once on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      const userDataStr = localStorage.getItem('userData');

      if (token && userDataStr) {
        const userData = safeJsonParse(userDataStr);
        if (userData) {
          setUser(userData);
          await refreshUser();
          // Don't call fetchUnreadCount here to avoid the loop
        }
      }

      setLoading(false);
    };
    initAuth();
  }, []); // Empty dependency array - run only once

  // Separate effect for fetching unread count when user changes
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user, fetchUnreadCount]);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) throw new Error(`Login failed: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        await fetchUnreadCount(); // Update unread count after login
        return { success: true, user: data.user, token: data.token };
      }
      return { success: false, message: data.message || 'Login failed' };
    } catch (e: any) { return { success: false, message: e.message }; }
  };

  const signup = async (userData: any) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      if (!res.ok) throw new Error(`Signup failed: ${res.status}`);
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        setUser(data.user);
        await fetchUnreadCount(); // Update unread count after signup
        return { success: true, user: data.user };
      }
      return { success: false, message: data.message || 'Signup failed' };
    } catch (e: any) { return { success: false, message: e.message }; }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    setUser(null);
    setUnreadCount(0);
    router.push('/login');
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    signup,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    unreadCount,
    fetchUnreadCount,
    themeColor: user?.school?.themeColor,
    schoolId: user?.school?._id,
    permissions: user?.permissions,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}