'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '../../../../component/ProtectedRoute';
import Link from 'next/link';

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();

  const schoolId = params.schoolId;
  const userIdParam = params.userId;

  const [authorized, setAuthorized] = useState(false);
  const [stats, setStats] = useState({ students: 0, teachers: 0, courses: 0, classes: 0 });
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

      const urluserId = parseInt(userIdParam as string);
      const userschoolId = typeof user.school === 'string' ? user.school : user.school._id;

      if (user.userId === urluserId && userschoolId === schoolId) {
        setAuthorized(true);
        
        try {
          const statsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/schools/${schoolId}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (statsResponse.ok) {
            const statsResult = await statsResponse.json();
            setStats({
              students: statsResult.data.students,
              teachers: statsResult.data.teachers,
              courses: statsResult.data.courses,
              classes: statsResult.data.sections
            });
          }
        } catch (error) {
          console.error('Error fetching stats:', error);
        }
      } else {
        router.push(`/${userschoolId}/${user.userId}/dashboard`);
      }

      setCheckingAuth(false);
    };

    checkAuth();
  }, [loading, user, userIdParam, schoolId, router, refreshUser]);

  if (loading || checkingAuth) return (
    <div className="flex flex-col justify-center items-center h-[60vh]">
      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
      <p className="mt-4 text-muted-foreground font-medium animate-pulse">Preparing your workspace...</p>
    </div>
  );

  if (!authorized) return (
    <div className="flex flex-col justify-center items-center h-[60vh]">
      <div className="w-20 h-20 bg-destructive/10 text-destructive rounded-3xl flex items-center justify-center text-3xl mb-4">
        <i className="fas fa-lock"></i>
      </div>
      <h2 className="text-2xl font-bold">Access Denied</h2>
      <p className="text-muted-foreground mt-2">You don't have permission to view this dashboard.</p>
      <button onClick={() => router.push('/login')} className="mt-6 px-6 py-2 bg-primary text-white rounded-xl font-bold">Return to Login</button>
    </div>
  );

  const schoolName = typeof user.school === 'object' ? (user.school.displayName || user.school.name) : 'Your School';

  return (
    <ProtectedRoute>
      <div className="space-y-8 pb-10">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary to-purple-600 p-8 md:p-12 text-white shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider mb-4 backdrop-blur-sm">System Update v2.4.0</span>
              <h1 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight leading-tight">
                Welcome to {schoolName}
              </h1>
              <p className="text-white/80 text-lg md:text-xl font-medium max-w-lg">
                Manage your institution with ease. Check your latest insights and upcoming tasks below.
              </p>
            </div>
          </div>
          
          <div className="mt-10 flex flex-wrap gap-3 relative z-10">
            <Link href={`/${schoolId}/${user.userId}/dashboard/courses`} className="px-6 py-3 bg-white/20 backdrop-blur-md text-white rounded-2xl font-bold text-sm border border-white/20 hover:bg-white/30 transition-all active:scale-95 shadow-xl">
              Browse Courses
            </Link>
            <Link href={`/${schoolId}/${user.userId}/dashboard/settings`} className="px-6 py-3 bg-white/10 backdrop-blur-md text-white rounded-2xl font-bold text-sm border border-white/10 hover:bg-white/20 transition-all active:scale-95">
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Total Students" value={stats.students} icon="fas fa-user-graduate" color="bg-blue-500" />
          <StatCard label="Faculty Members" value={stats.teachers} icon="fas fa-chalkboard-teacher" color="bg-purple-500" />
          <StatCard label="Active Courses" value={stats.courses} icon="fas fa-book-bookmark" color="bg-orange-500" />
          <StatCard label="Live Classes" value={stats.classes} icon="fas fa-video" color="bg-emerald-500" />
        </div>

        {/* Main Content Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <section>
              <h3 className="text-xl font-bold mb-6 flex items-center">
                <span className="w-2 h-8 bg-primary rounded-full mr-3"></span>
                Quick Actions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ActionCard title="Manage Users" desc="Add or edit student and teacher profiles" icon="fas fa-users-gear" />
                <ActionCard title="Schedule" desc="View and update school timetables" icon="fas fa-calendar-lines" />
                <ActionCard title="Course Builder" desc="Create new learning modules" icon="fas fa-layer-group" />
                <ActionCard title="Financials" desc="Track school revenue and fees" icon="fas fa-file-invoice-dollar" />
              </div>
            </section>
          </div>

          {/* Activity Feed */}
          <section className="glass rounded-[2rem] p-6 border-border shadow-xl">
             <h3 className="text-xl font-bold mb-6 flex items-center">
                <i className="fas fa-bolt text-yellow-500 mr-3"></i>
                Recent Activity
             </h3>
             <div className="space-y-6">
                <ActivityItem title="New enrollment" time="2 hours ago" type="student" />
                <ActivityItem title="Course updated" time="5 hours ago" type="course" />
                <ActivityItem title="Payment received" time="1 day ago" type="finance" />
                <ActivityItem title="New teacher joined" time="2 days ago" type="teacher" />
             </div>
             <button className="w-full mt-8 py-3 rounded-2xl border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground hover:bg-secondary transition-colors">
                View All Activity
             </button>
          </section>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function StatCard({ label, value, icon, color }: { label: string, value: number, icon: string, color: string }) {
  return (
    <div className="group glass p-6 rounded-[2rem] border-border shadow-xl card-hover relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-24 h-24 ${color} opacity-[0.03] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700`}></div>
      <div className="flex items-center justify-between relative z-10">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
          <h4 className="text-3xl font-black">{value}</h4>
        </div>
        <div className={`w-12 h-12 ${color} text-white rounded-2xl flex items-center justify-center text-xl shadow-lg shadow-black/5`}>
          <i className={icon}></i>
        </div>
      </div>
      <div className="mt-4 flex items-center text-[10px] text-green-500 font-bold">
        <i className="fas fa-arrow-up mr-1"></i>
        <span>12% increase this month</span>
      </div>
    </div>
  );
}

function ActionCard({ title, desc, icon }: { title: string, desc: string, icon: string }) {
  return (
    <div className="glass p-5 rounded-2xl border-border shadow-lg card-hover cursor-pointer group flex items-start space-x-4 bg-white/50">
      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-xl text-primary group-hover:bg-primary group-hover:text-white transition-all">
        <i className={icon}></i>
      </div>
      <div>
        <h4 className="font-bold group-hover:text-primary transition-colors">{title}</h4>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function ActivityItem({ title, time, type }: { title: string, time: string, type: string }) {
  return (
    <div className="flex items-center space-x-4 group cursor-pointer">
      <div className="w-2 h-2 rounded-full bg-primary/40 group-hover:bg-primary transition-colors"></div>
      <div className="flex-1">
        <p className="text-sm font-bold group-hover:text-primary transition-colors">{title}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{time} • <span className="uppercase tracking-tighter">{type}</span></p>
      </div>
      <i className="fas fa-chevron-right text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-all translate-x-[-10px] group-hover:translate-x-0"></i>
    </div>
  );
}
