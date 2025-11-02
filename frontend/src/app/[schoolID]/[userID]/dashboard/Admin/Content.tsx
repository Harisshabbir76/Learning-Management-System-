'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/login');
    }
  }, [user, loading]);

  if (loading || !user) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
      <p>Welcome, {user.username} 👋</p>
      <div className="mt-6 space-y-4">
        <button onClick={() => router.push('/admin/courses')} className="btn">Manage Courses</button>
        <button onClick={() => router.push('/admin/users')} className="btn">Manage Users</button>
      </div>
    </div>
  );
}
