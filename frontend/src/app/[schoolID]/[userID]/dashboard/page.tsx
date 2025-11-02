'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '../../../../component/ProtectedRoute';

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();

  const schoolId = params.schoolID;
  const userIdParam = params.userID;

  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState({ students: 0, teachers: 0, courses: 0, announcements: 0 });
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (loading) return;

      const token = localStorage.getItem('token');
      if (!token) return router.push('/login');

      if (!user) {
        const refreshed = await refreshUser(true);
        if (!refreshed) return;
      }

      const urlUserId = parseInt(userIdParam);
      const userSchoolId = typeof user.school === 'string' ? user.school : user.school._id;

      if (user.userId === urlUserId && userSchoolId === schoolId) {
        setAuthorized(true);
        setStats({ students: 124, teachers: 18, courses: 24, announcements: 5 }); // Replace with API
      } else {
        router.push(`/${userSchoolId}/${user.userId}/dashboard`);
      }

      setCheckingAuth(false);
    };

    checkAuth();
  }, [loading, user, userIdParam, schoolId, router, refreshUser]);

  if (loading || checkingAuth) return (
    <div className="flex justify-center items-center h-screen">
      <div className="animate-spin w-16 h-16 border-4 border-blue-600 rounded-full"></div>
      <span className="ml-4">Loading dashboard...</span>
    </div>
  );

  if (!authorized) return (
    <div className="flex justify-center items-center h-screen">
      <p className="text-red-600 text-lg">Access Denied</p>
    </div>
  );

  const schoolName = typeof user.school === 'object' ? user.school.name : user.school;
  const schoolThemeColor = typeof user.school === 'object' ? user.school.themeColor || '#3b82f6' : '#3b82f6';

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b p-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">{schoolName} Dashboard</h1>
            <p className="text-gray-500">Welcome back, {user.name}</p>
          </div>
          <button onClick={() => router.push('/login')} className="bg-red-500 text-white px-4 py-2 rounded-lg">Sign Out</button>
        </header>

        {/* Stats */}
        <main className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-gray-500">Students</p>
              <p className="text-2xl font-bold">{stats.students}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-gray-500">Teachers</p>
              <p className="text-2xl font-bold">{stats.teachers}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-gray-500">Courses</p>
              <p className="text-2xl font-bold">{stats.courses}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <p className="text-gray-500">Announcements</p>
              <p className="text-2xl font-bold">{stats.announcements}</p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white p-4 border-t mt-12 text-center text-gray-500">
          © 2024 School Management System. Logged in as {user.name} ({user.role})
        </footer>
      </div>
    </ProtectedRoute>
  );
}
