'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function TeacherDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading]);

  if (loading || !user) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
      <p>Welcome, {user.name} 👋</p>
    </div>
  );
}
