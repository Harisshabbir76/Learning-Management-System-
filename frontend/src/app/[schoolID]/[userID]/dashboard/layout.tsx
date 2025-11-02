'use client';

import { useState, useEffect, ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { usePathname, useRouter } from 'next/navigation';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, logout, themeColor, schoolId, loading, permissions, unreadCount, fetchUnreadCount } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Safe default for themeColor
  const safeThemeColor = themeColor || '#3b82f6'; // Default to blue-600

  // Get reliable schoolId and userId
  const getCurrentIds = () => {
    const pathParts = pathname.split('/').filter(Boolean);
    const pathSchoolId = pathParts[0];
    const pathUserId = pathParts[1];
    
    return {
      schoolId: pathSchoolId || schoolId,
      userId: pathUserId || user?.userId
    };
  };

  const { schoolId: currentSchoolId, userId } = getCurrentIds();

  // Fetch unread notifications count
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [user, fetchUnreadCount]);

  const getSchoolLogoUrl = () => {
    try {
      if (!user?.school?.logoUrl) return null;
      if (user.school.logoUrl.startsWith('http')) {
        return user.school.logoUrl;
      }
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const cleanPath = user.school.logoUrl.startsWith('/') 
        ? user.school.logoUrl 
        : `/${user.school.logoUrl}`;
      return `${baseUrl}${cleanPath}`;
    } catch (error) {
      console.error('Error constructing logo URL:', error);
      return null;
    }
  };

  useEffect(() => {
    if (!loading && (!currentSchoolId || !userId)) {
      router.push('/login');
    }
  }, [loading, currentSchoolId, userId, router]);

  // ✅ Render role-specific sidebar links
  const renderRoleSpecificLinks = (base: string, linkClass: string) => {
    if (!user?.role) return [];

    const commonLinks = [
      <Link key="dashboard" href={`${base}`} className={linkClass}>
        <i className="w-5 text-center fas fa-chart-pie mr-3"></i> Dashboard
      </Link>,
      <Link key="settings" href={`${base}/settings`} className={linkClass}>
        <i className="w-5 text-center fas fa-cog mr-3"></i> Settings
      </Link>
    ];

    // Safe permissions check - use empty array if permissions is undefined
    const userPermissions = permissions || [];

    switch (user.role) {
      case 'admin':
        return [
          ...commonLinks,
          <Link key="courses" href={`${base}/courses`} className={linkClass}>
            <i className="w-5 text-center fas fa-book mr-3"></i> Courses
          </Link>,
          <Link key="users" href={`${base}/users`} className={linkClass}>
            <i className="w-5 text-center fas fa-users mr-3"></i> Users
          </Link>,
          <Link key="teachers" href={`${base}/manage-teachers`} className={linkClass}>
            <i className="w-5 text-center fas fa-chalkboard-teacher mr-3"></i> Manage Teachers
          </Link>,
          <Link key="student-affairs" href={`${base}/student-affairs`} className={linkClass}>
            <i className="w-5 text-center fas fa-user-graduate mr-3"></i> Student Affairs
          </Link>,
          <Link key="sections" href={`${base}/section`} className={linkClass}>
            <i className="w-5 text-center fas fa-door-open mr-3"></i> Classes
          </Link>,
          <Link key="timetable" href={`${base}/timetable`} className={linkClass}>
            <i className="w-5 text-center fas fa-calendar-alt mr-3"></i> Timetables
          </Link>,
          <Link key="permissions" href={`${base}/permissions`} className={linkClass}>
            <i className="w-5 text-center fas fa-key mr-3"></i> Permissions
          </Link>,
          <Link key="reports" href={`${base}/reports`} className={linkClass}>
            <i className="w-5 text-center fas fa-chart-bar mr-3"></i> Reports
          </Link>
        ];

      case 'teacher':
        const teacherLinks = [
          ...commonLinks,
          <Link key="my-courses" href={`${base}/my-courses`} className={linkClass}>
            <i className="w-5 text-center fas fa-book-open mr-3"></i> My Courses
          </Link>,
          <Link key="students" href={`${base}/students`} className={linkClass}>
            <i className="w-5 text-center fas fa-user-graduate mr-3"></i> Students
          </Link>,
          <Link key="marks" href={`${base}/marks`} className={linkClass}>
            <i className="w-5 text-center fas fa-check-circle mr-3"></i> Marks
          </Link>,
          <Link key="attendance" href={`${base}/attendance`} className={linkClass}>
            <i className="w-5 text-center fas fa-calendar-check mr-3"></i> Attendance
          </Link>,
          <Link key="resources" href={`${base}/resources`} className={linkClass}>
            <i className="w-5 text-center fas fa-folder mr-3"></i> Resources
          </Link>
        ];

        // Add permission-based links for teachers - use userPermissions instead of permissions
        if (userPermissions.includes('student_affairs')) {
          teacherLinks.push(
            <Link key="student-affairs-admin" href={`${base}/student-affairs`} className={linkClass}>
              <i className="w-5 text-center fas fa-user-graduate mr-3"></i> Student Affairs
            </Link>,
            <Link key="courses-admin" href={`${base}/courses`} className={linkClass}>
              <i className="w-5 text-center fas fa-book mr-3"></i> Courses
            </Link>,
            <Link key="teachers-admin" href={`${base}/manage-teachers`} className={linkClass}>
              <i className="w-5 text-center fas fa-chalkboard-teacher mr-3"></i> Manage Teachers
            </Link>,
            <Link key="sections-admin" href={`${base}/section`} className={linkClass}>
              <i className="w-5 text-center fas fa-door-open mr-3"></i> Classes
            </Link>,
            <Link key="timetable-admin" href={`${base}/timetable`} className={linkClass}>
              <i className="w-5 text-center fas fa-calendar-alt mr-3"></i> Timetables
            </Link>
          );
        }
        if (userPermissions.includes('accounts_office')) {
          teacherLinks.push(
            <Link key="accounts-office" href={`${base}/accounts-office`} className={linkClass}>
              <i className="w-5 text-center fas fa-dollar-sign mr-3"></i> Accounts Office
            </Link>
          );
        }
        
        return teacherLinks;

      case 'faculty':
        const facultyLinks = [
          ...commonLinks,
        ];

        // Add permission-based links for faculty - use userPermissions instead of permissions
        if (userPermissions.includes('student_affairs')) {
          facultyLinks.push(
            <Link key="student-affairs-admin" href={`${base}/student-affairs`} className={linkClass}>
              <i className="w-5 text-center fas fa-user-graduate mr-3"></i> Student Affairs
            </Link>,
            <Link key="courses-admin" href={`${base}/courses`} className={linkClass}>
              <i className="w-5 text-center fas fa-book mr-3"></i> Courses
            </Link>,
            <Link key="teachers-admin" href={`${base}/manage-teachers`} className={linkClass}>
              <i className="w-5 text-center fas fa-chalkboard-teacher mr-3"></i> Manage Teachers
            </Link>,
            <Link key="sections-admin" href={`${base}/section`} className={linkClass}>
              <i className="w-5 text-center fas fa-door-open mr-3"></i> Classes
            </Link>,
            <Link key="timetable-admin" href={`${base}/timetable`} className={linkClass}>
              <i className="w-5 text-center fas fa-calendar-alt mr-3"></i> Timetables
            </Link>
          );
        }
        if (userPermissions.includes('accounts_office')) {
          facultyLinks.push(
            <Link key="accounts-office" href={`${base}/accounts-office`} className={linkClass}>
              <i className="w-5 text-center fas fa-dollar-sign mr-3"></i> Accounts Office
            </Link>
          );
        }
        return facultyLinks;

      case 'student':
        return [
          ...commonLinks,
          <Link key="my-courses" href={`${base}/my-courses`} className={linkClass}>
            <i className="w-5 text-center fas fa-book-open mr-3"></i> My Courses
          </Link>,
          <Link key="attendance" href={`${base}/attendance`} className={linkClass}>
            <i className="w-5 text-center fas fa-calendar-check mr-3"></i> Attendance
          </Link>,
          <Link key="marks" href={`${base}/marks`} className={linkClass}>
            <i className="w-5 text-center fas fa-check-circle mr-3"></i> Marks
          </Link>,
          <Link key="resources" href={`${base}/resources`} className={linkClass}>
            <i className="w-5 text-center fas fa-folder mr-3"></i> Resources
          </Link>,
          <Link key="schedule" href={`${base}/schedule`} className={linkClass}>
            <i className="w-5 text-center fas fa-calendar-alt mr-3"></i> Schedule
          </Link>,
          <Link key="fees" href={`${base}/fees`} className={linkClass}>
            <i className="w-5 text-center fas fa-credit-card mr-3"></i> Fees
          </Link>
        ];

      default:
        return commonLinks;
    }
  };

  const displaySchoolName = typeof user?.school === 'object' 
    ? user.school.displayName || user.school.name
    : user?.school;

  if (loading || !currentSchoolId || !userId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const logoUrl = getSchoolLogoUrl();
  const schoolInitial = user?.school?.displayName?.charAt(0)?.toUpperCase() || 
                      user?.school?.name?.charAt(0)?.toUpperCase() || 'S';
  
  // Safe permissions for display
  const userPermissions = permissions || [];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile Menu Button */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md"
        style={{ color: safeThemeColor }}
      >
        <i className={`fas ${isSidebarOpen ? 'fa-times' : 'fa-bars'}`}></i>
      </button>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside 
        className={`w-64 text-white p-4 flex flex-col fixed h-full shadow-lg z-40 transition-transform duration-300 ease-in-out
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ 
          backgroundColor: safeThemeColor,
          backgroundImage: `linear-gradient(135deg, ${adjustColor(safeThemeColor, -30)} 0%, ${safeThemeColor} 100%)`
        }}
      >
        {/* Logo and School Name - Reduced size */}
        <div className="mb-3 pt-2 flex flex-col items-center">
          <div className="flex items-center justify-center mb-2">
            <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white/20 flex items-center justify-center border-2 border-white/30 shadow-lg mr-2">
              {logoUrl ? (
                <>
                  <img 
                    src={`${logoUrl}?${new Date().getTime()}`} 
                    alt="School Logo"
                    className="w-full h-full object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div
                    className="absolute inset-0 bg-white/20 flex items-center justify-center text-white font-bold text-xl"
                    style={{ display: 'none' }}
                  >
                    {schoolInitial}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">
                  {schoolInitial}
                </div>
              )}
            </div>
            {displaySchoolName && (
              <h2 className="text-sm font-bold text-white max-w-[120px]">
                {displaySchoolName}
              </h2>
            )}
          </div>
        </div>

        {/* User Info - Reduced size */}
        <div className="mb-4 text-center p-3 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
          <h2 className="text-sm font-semibold text-white truncate">{user?.name || 'User'}</h2>
          <p className="text-xs text-white/80 mt-1">ID: {user?.userId || 'N/A'}</p>
          <p className="text-xs text-white/80 mt-1 capitalize bg-white/20 px-2 py-0.5 rounded-full inline-block">
            {user?.role}
          </p>
          
          {/* Display permissions if user has any */}
          {userPermissions && userPermissions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-white/80 mb-1">Permissions:</p>
              <div className="flex flex-wrap justify-center gap-1">
                {userPermissions
                  .filter(permission => 
                    permission === 'student_affairs' || permission === 'accounts_office'
                  )
                  .map((permission: string, index: number) => (
                    <span
                      key={index}
                      className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full"
                    >
                      {permission.replace('_', ' ')}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Icon at the top */}
        <div className="mb-4 flex justify-center">
          <Link 
            href={`/${currentSchoolId}/${userId}/dashboard/notifications`}
            className="relative p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors duration-200 group"
          >
            <i className="fas fa-bell text-white text-lg group-hover:scale-110 transition-transform"></i>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1 overflow-y-auto py-2">
          <Link 
            href="/" 
            className="flex items-center py-2 px-3 rounded-xl hover:bg-white/10 transition-all duration-200 mb-1 group text-sm"
          >
            <i className="w-4 text-center fas fa-home mr-2 group-hover:scale-110 transition-transform"></i> 
            <span>Home</span>
          </Link>
          {renderRoleSpecificLinks(
            `/${currentSchoolId}/${userId}/dashboard`, 
            "flex items-center py-2 px-3 rounded-xl hover:bg-white/10 transition-all duration-200 group text-sm"
          )}
        </nav>

        {/* Logout Button */}
        <button
          onClick={() => setShowModal(true)}
          className="mt-auto flex items-center py-2 px-3 rounded-xl hover:bg-white/10 transition-all duration-200 group text-sm"
        >
          <i className="w-4 text-center fas fa-sign-out-alt mr-2 group-hover:scale-110 transition-transform"></i> 
          <span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 p-6 transition-all duration-300 ${isSidebarOpen ? 'md:ml-64' : 'ml-0'} overflow-auto`}>
        <div className="bg-white rounded-xl shadow-sm p-6 min-h-full border border-gray-100">
          {children}
        </div>
      </main>

      {/* Logout Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-xl max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <i className="fas fa-sign-out-alt text-red-500 mr-2"></i> Confirm Logout
            </h3>
            <p className="mb-6 text-gray-600">Are you sure you want to logout?</p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center"
                onClick={() => {
                  setShowModal(false);
                  logout();
                }}
              >
                <i className="fas fa-sign-out-alt mr-2"></i> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Font Awesome for icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
    </div>
  );
}

// Updated adjustColor function with safety checks
function adjustColor(color, amount) {
  if (!color) return '#3b82f6'; // Return default color if undefined
  
  let usePound = false;
  if (color.startsWith('#')) {
    color = color.slice(1);
    usePound = true;
  }

  // Handle named colors or invalid colors
  if (color.length !== 3 && color.length !== 6) {
    return usePound ? '#' + color : color;
  }

  try {
    const num = parseInt(color, 16);
    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;

    r = Math.min(Math.max(0, r), 255);
    g = Math.min(Math.max(0, g), 255);
    b = Math.min(Math.max(0, b), 255);

    return (usePound ? "#" : "") + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
  } catch (error) {
    console.error('Error adjusting color:', error);
    return usePound ? '#' + color : color;
  }
}
