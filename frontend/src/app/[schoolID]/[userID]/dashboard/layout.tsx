'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';

interface DashboardLayoutProps {
  children: ReactNode;
}

// Helper to get initials from school name
const getInitials = (name: string) => {
  if (!name) return 'S';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout, themeColor, schoolId, loading, permissions, unreadCount, fetchUnreadCount } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  const safeThemeColor = themeColor || '#6366f1';

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user, fetchUnreadCount]);

  useEffect(() => {
    if (!loading && (!user || !user.school)) {
      router.push('/login');
    }
  }, [loading, user, router]);

  const renderRoleSpecificLinks = (base: string) => {
    if (!user?.role) return [];
    
    const linkClass = (path: string) => `
      flex items-center py-3 px-4 rounded-2xl transition-all duration-300 group mb-1 text-sm font-medium
      ${pathname === path 
        ? 'bg-white text-primary shadow-lg shadow-primary/20 scale-[1.02]' 
        : 'text-white/70 hover:bg-white/10 hover:text-white'}
    `;

    const links = [
      { id: 'dashboard', href: base, label: 'Overview', icon: 'fas fa-chart-line' },
      { id: 'settings', href: `${base}/settings`, label: 'Settings', icon: 'fas fa-cog' },
    ];

    if (user.role === 'admin' || (user.role === 'faculty' && permissions?.includes('student_affairs'))) {
      links.splice(1, 0, 
        { id: 'courses', href: `${base}/courses`, label: 'Courses', icon: 'fas fa-book' },
        { id: 'users', href: `${base}/users`, label: 'Users', icon: 'fas fa-users' },
        { id: 'sections', href: `${base}/section`, label: 'Classes', icon: 'fas fa-school' },
        { id: 'timetable', href: `${base}/timetable`, label: 'Timetables', icon: 'fas fa-calendar-alt' }
      );
    }

    if (user.role === 'student') {
      links.splice(1, 0,
        { id: 'my-courses', href: `${base}/my-courses`, label: 'My Courses', icon: 'fas fa-book-open' },
        { id: 'attendance', href: `${base}/attendance`, label: 'Attendance', icon: 'fas fa-calendar-check' },
        { id: 'marks', href: `${base}/marks`, label: 'Academic Record', icon: 'fas fa-award' }
      );
    }

    return links.map(link => (
      <Link key={link.id} href={link.href} className={linkClass(link.href)}>
        <i className={`${link.icon} w-5 mr-3 text-center group-hover:scale-110 transition-transform`}></i>
        <span>{link.label}</span>
      </Link>
    ));
  };

  const schoolName = typeof user?.school === 'object' ? (user.school.displayName || user.school.name) : 'School Platform';

  // Gender-based avatar logic
  const getAvatarIcon = () => {
    if (user?.gender === 'female') return 'fas fa-user-nurse';
    return 'fas fa-user-tie';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary">
            {getInitials(schoolName)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Sidebar */}
      <aside 
        className={`fixed top-4 left-4 bottom-4 w-64 rounded-[2rem] p-6 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-50
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'} md:translate-x-0 overflow-hidden shadow-2xl`}
        style={{ 
          backgroundColor: safeThemeColor,
          backgroundImage: `linear-gradient(165deg, ${safeThemeColor} 0%, ${adjustColor(safeThemeColor, -20)} 100%)`
        }}
      >
        {/* Animated Blobs inside Sidebar */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-blob"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-blob animation-delay-2000"></div>

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo Section */}
          <div className="mb-10 flex items-center space-x-3 px-2">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-lg group">
              <i className="fas fa-graduation-cap text-xl group-hover:scale-110 transition-transform"></i>
            </div>
            <div className="overflow-hidden">
              <h2 className="text-lg font-bold text-white truncate leading-tight">{schoolName}</h2>
              <span className="text-[10px] uppercase tracking-widest text-white/60 font-semibold">Learning Hub</span>
            </div>
          </div>

          {/* User Profile Summary */}
          <div className="mb-8 p-4 glass rounded-2xl bg-white/10 border-white/10">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white/20 border border-white/20 flex items-center justify-center text-white">
                <i className={getAvatarIcon()}></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.name}</p>
                <p className="text-[10px] text-white/70 uppercase tracking-tighter">{user?.role}</p>
              </div>
            </div>
            <Link 
              href={`/${schoolId}/${user?.userId}/dashboard/notifications`}
              className="flex items-center justify-between px-3 py-2 bg-white/10 rounded-xl text-[10px] text-white/90 hover:bg-white/20 transition-colors"
            >
              <span className="flex items-center">
                <i className="fas fa-bell mr-2"></i> Notifications
              </span>
              {unreadCount > 0 && (
                <span className="bg-red-500 px-1.5 py-0.5 rounded-md font-bold">{unreadCount}</span>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
            {renderRoleSpecificLinks(`/${schoolId}/${user?.userId}/dashboard`)}
          </nav>

          {/* Logout */}
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 flex items-center py-3 px-4 rounded-2xl text-white/70 hover:bg-white/10 hover:text-white transition-all duration-300 group text-sm font-medium"
          >
            <i className="fas fa-sign-out-alt w-5 mr-3 text-center group-hover:scale-110 transition-transform"></i>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 min-h-screen transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] 
        ${isSidebarOpen ? 'md:ml-[18rem]' : 'ml-0'} p-4 md:p-8 relative`}>
        
        {/* Top Floating Header - Non-sticky as requested */}
        <header className="z-30 mb-8 glass rounded-[1.5rem] p-4 flex justify-between items-center animate-fade-in-up border-white/20 shadow-xl">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <i className={`fas ${isSidebarOpen ? 'fa-indent' : 'fa-outdent'} text-lg`}></i>
            </button>
            <div className="hidden md:block">
              <h1 className="text-xl font-bold tracking-tight">Welcome, {user?.name}</h1>
              <p className="text-xs text-muted-foreground font-medium">Keep up the great work today</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-purple-500 p-[2px] shadow-lg shadow-primary/20">
                <div className="w-full h-full bg-white dark:bg-black rounded-[9px] flex items-center justify-center font-bold text-primary">
                  <i className={getAvatarIcon()}></i>
                </div>
             </div>
          </div>
        </header>

        {/* Page Content wrapper */}
        <div className="animate-fade-in-up delay-100 min-h-[calc(100vh-10rem)]">
          {children}
        </div>

        {/* Footer */}
        <footer className="mt-12 py-8 text-center border-t border-border/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            © 2024 Antigravity Learning Systems • High-End Educational ERP
          </p>
        </footer>
      </main>

      {/* Logout Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] animate-fade-in">
          <div className="glass-dark p-8 rounded-[2rem] max-w-sm w-full mx-4 shadow-2xl border-white/10 animate-fade-in-up">
            <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl">
              <i className="fas fa-sign-out-alt"></i>
            </div>
            <h3 className="text-xl font-bold text-center text-white mb-2">Ready to Leave?</h3>
            <p className="text-center text-white/60 mb-8 text-sm">We will save your progress for your next session. Hope to see you back soon</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                className="py-3 px-4 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-all text-sm font-bold"
                onClick={() => setShowModal(false)}
              >
                Go Back
              </button>
              <button
                className="py-3 px-4 rounded-xl bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all text-sm font-bold"
                onClick={() => {
                  setShowModal(false);
                  logout();
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS for Sidebar & Icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}

function adjustColor(color: string, amount: number) {
  if (!color || !color.startsWith('#')) return color;
  const num = parseInt(color.slice(1), 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00FF) + amount;
  let b = (num & 0x0000FF) + amount;
  r = Math.min(Math.max(0, r), 255);
  g = Math.min(Math.max(0, g), 255);
  b = Math.min(Math.max(0, b), 255);
  return "#" + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
}
