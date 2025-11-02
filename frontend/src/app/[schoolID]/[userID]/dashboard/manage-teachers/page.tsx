'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import UserEditForm from '../../../../../component/UserEditForm';
import Link from 'next/link';

interface User {
  _id: string;
  name: string;
  userId: string;
  email: string;
  role: string;
  school: any;
  permissions?: string[];
  roleProfile?: any; // Teacher profile data
}

interface LoggedInUser {
  _id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  school: any;
  permissions?: string[];
}

interface TeacherProfile {
  _id: string;
  user: string;
  courses: string[];
  salary: number;
  permissions: string[];
}

export default function ManageTeachers() {
  const router = useRouter();
  const pathname = usePathname();
  const [users, setUsers] = useState<User[]>([]);
  const [token, setToken] = useState<string>('');
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [includeRoleData, setIncludeRoleData] = useState(true); // Include teacher profile data

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);

    const fetchData = async () => {
      try {
        // 1️⃣ Get logged-in user profile
        const profileRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (!profileRes.ok) throw new Error('Failed to fetch user profile');

        const profileData = await profileRes.json();
        setLoggedInUser(profileData.user);

        // 2️⃣ Check access - Only teachers/faculty with student_affairs permission or admin
        if (!hasAccess(profileData.user)) {
          setUnauthorized(true);
          setLoading(false);
          return;
        }

        // 3️⃣ Fetch all teachers with their role data
        const usersRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users?role=teacher&includeRoleData=true`, 
          {
            headers: { Authorization: `Bearer ${storedToken}` },
          }
        );
        if (!usersRes.ok) throw new Error('Failed to fetch teachers');

        const usersData = await usersRes.json();
        const filteredUsers = Array.isArray(usersData.data) ? usersData.data : [];
        
        setUsers(filteredUsers);
      } catch (err: any) {
        console.error('Error:', err);
        alert(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // ✅ Access control - Only teachers/faculty with student_affairs permission or admin
  const hasAccess = (user: LoggedInUser | null) => {
    if (!user) return false;

    // Admin has full access
    if (user.role === 'admin') return true;

    // Teachers and faculty need student_affairs permission
    if ((user.role === 'teacher' || user.role === 'faculty') && 
        user.permissions?.includes('student_affairs')) {
      return true;
    }

    return false;
  };

  // Safe route parts
  const getSafeRouteParts = () => {
    const parts = (pathname || '').split('/').filter(Boolean);
    const pathSchool = parts[0] || '';
    const pathUser = parts[1] || '';
    const userSchool: any = loggedInUser?.school;
    const schoolSegment = typeof userSchool === 'string'
      ? userSchool
      : (userSchool?._id || userSchool?.id || pathSchool);
    const userIdSegment = loggedInUser?.userId || pathUser;
    return { schoolSegment, userIdSegment };
  };

  // ➕ Create new teacher
  const handleCreate = () => {
    const { schoolSegment, userIdSegment } = getSafeRouteParts();
    if (!schoolSegment || !userIdSegment) return;
    router.push(`/${schoolSegment}/${userIdSegment}/dashboard/manage-teachers/create`);
  };

  // 👁️ View teacher details
  const handleView = (teacher: User) => {
    const { schoolSegment, userIdSegment } = getSafeRouteParts();
    if (!schoolSegment || !userIdSegment) return;
    router.push(`/${schoolSegment}/${userIdSegment}/dashboard/manage-teachers/${teacher.userId}`);
  };

  // ❌ Delete teacher
  const confirmDelete = (user: User) => setDeletingUser(user);

  const handleDeleteConfirmed = async () => {
    if (!deletingUser || !token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${deletingUser._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setUsers(users.filter((u) => u._id !== deletingUser._id));
      setDeletingUser(null);
    } catch (err) {
      alert('Delete failed');
    }
  };

  // ✏️ Update teacher
  const handleUserUpdated = (updatedUser: User) => {
    setUsers(users.map(u => u._id === updatedUser._id ? updatedUser : u));
    setEditingUser(null);
  };

  // ✅ Permission: create
  const canCreateUsers = () => {
    if (!loggedInUser) return false;
    return hasAccess(loggedInUser);
  };

  // ✅ Permission: view
  const canViewUser = (user: User) => {
    if (!loggedInUser) return false;
    return hasAccess(loggedInUser);
  };

  // ✅ Permission: edit
  const canEditUser = (user: User) => {
    if (!loggedInUser) return false;
    if (loggedInUser.role === 'admin') return true;
    if ((loggedInUser.role === 'faculty' || loggedInUser.role === 'teacher') &&
        loggedInUser.permissions?.includes('student_affairs') &&
        user.role === 'teacher') {
      return true;
    }
    return false;
  };

  // ✅ Permission: delete
  const canDeleteUser = (user: User) => {
    if (!loggedInUser) return false;
    if (user._id === loggedInUser._id) return false; // prevent self-delete
    if (loggedInUser.role === 'admin') return true;
    if ((loggedInUser.role === 'faculty' || loggedInUser.role === 'teacher') &&
        loggedInUser.permissions?.includes('student_affairs') &&
        user.role === 'teacher') {
      return true;
    }
    return false;
  };

  // Format salary for display
  const formatSalary = (salary: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(salary);
  };

  // Get teacher-specific permissions
  const getTeacherPermissions = (user: User) => {
    if (!user.roleProfile) return 'None';
    return user.roleProfile.permissions?.join(', ') || 'None';
  };

  // Get number of courses assigned to teacher
  const getCourseCount = (user: User) => {
    if (!user.roleProfile) return 0;
    return user.roleProfile.courses?.length || 0;
  };

  // =================== UI ===================
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <p className="mt-1 text-sm text-red-700">
                You need <strong>student_affairs</strong> permission to access this page.
              </p>
              <div className="mt-4">
                <Link
                  href={`/${loggedInUser?.school?._id || 'school'}/${loggedInUser?.userId || 'user'}/dashboard`}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Teacher Management</h1>
        {canCreateUsers() && (
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Create New Teacher
          </button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <h2 className="text-xl font-semibold p-4 border-b">
          {loggedInUser?.role === 'admin' ? 'All Teachers' : 'Teachers'}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3">Name</th>
                <th className="p-3">User ID</th>
                <th className="p-3">Email</th>
                <th className="p-3">Courses</th>
                <th className="p-3">Salary</th>
                <th className="p-3">Permissions</th>
                {canCreateUsers() && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user._id} className="border-t hover:bg-gray-50">
                    <td className="p-3">{user.name}</td>
                    <td className="p-3">{user.userId}</td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">{getCourseCount(user)}</td>
                    <td className="p-3">{user.roleProfile?.salary ? formatSalary(user.roleProfile.salary) : 'N/A'}</td>
                    <td className="p-3 text-sm">{getTeacherPermissions(user)}</td>
                    {canCreateUsers() && (
                      <td className="p-3 text-right space-x-2">
                        {canViewUser(user) && (
                          <button
                            onClick={() => handleView(user)}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                          >
                            View
                          </button>
                        )}
                        {canEditUser(user) && (
                          <button
                            onClick={() => setEditingUser(user)}
                            className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {canDeleteUser(user) && (
                          <button
                            onClick={() => confirmDelete(user)}
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={canCreateUsers() ? 7 : 6}>
                    No teachers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h2 className="text-xl font-bold mb-4 text-red-600">Confirm Deletion</h2>
            <p className="mb-4">
              Are you sure you want to delete teacher <strong>{deletingUser.name}</strong>?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingUser && (
        <UserEditForm
          user={editingUser}
          token={token}
          onClose={() => setEditingUser(null)}
          onUpdate={handleUserUpdated}
          isAdmin={loggedInUser?.role === 'admin'}
          canEditRole={loggedInUser?.role === 'admin'}
          includeRoleData={includeRoleData}
        />
      )}
    </div>
  );
}