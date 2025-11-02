'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import UserEditForm from '../../../../../component/UserEditForm';
import Link from 'next/link';

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  grade: string;
  capacity: number;
  students: string[];
  isActive: boolean;
}

interface User {
  _id: string;
  name: string;
  userId: string;
  email: string;
  role: string;
  school: any;
  permissions?: string[];
  roleProfile?: any;
  sections?: Section[];
  createdAt: string;
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

interface PaginationInfo {
  current: number;
  pages: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export default function ManageStudents() {
  const router = useRouter();
  const pathname = usePathname();
  const [users, setUsers] = useState<User[]>([]);
  const [token, setToken] = useState<string>('');
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<PaginationInfo>({
    current: 1,
    pages: 1,
    total: 0,
    hasNext: false,
    hasPrev: false
  });

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

        // 2️⃣ Check access - Only admin or faculty with student_affairs permission
        if (!hasAccess(profileData.user)) {
          setUnauthorized(true);
          setLoading(false);
          return;
        }

        // 3️⃣ Fetch students using the new student_affairs route
        await fetchStudents();
      } catch (err: any) {
        console.error('Error:', err);
        alert(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // Fetch students from student_affairs route
  const fetchStudents = async (page = 1, search = '') => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search })
      });

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/student_affairs/students?${queryParams}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch students');

      const data = await response.json();
      
      if (data.success) {
        setUsers(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      alert('Failed to fetch students');
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents(1, searchTerm);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    fetchStudents(page, searchTerm);
  };

  // ✅ Access control - Only admin or faculty with student_affairs permission
  const hasAccess = (user: LoggedInUser | null) => {
    if (!user) return false;

    // Admin has full access
    if (user.role === 'admin') return true;

    // Faculty need student_affairs permission
    if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) {
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

  // ➕ Create new student
  const handleCreate = () => {
    const { schoolSegment, userIdSegment } = getSafeRouteParts();
    if (!schoolSegment || !userIdSegment) return;
    router.push(`/${schoolSegment}/${userIdSegment}/dashboard/student-affairs/create`);
  };

  // 👁️ View student details
  const handleView = (student: User) => {
    const { schoolSegment, userIdSegment } = getSafeRouteParts();
    if (!schoolSegment || !userIdSegment) return;
    router.push(`/${schoolSegment}/${userIdSegment}/dashboard/student-affairs/${student.userId}`);
  };

  // ❌ Delete
  const confirmDelete = (user: User) => setDeletingUser(user);

  const handleDeleteConfirmed = async () => {
    if (!deletingUser || !token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${deletingUser._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      
      // Refresh the student list
      await fetchStudents(pagination.current, searchTerm);
      setDeletingUser(null);
    } catch (err) {
      alert('Delete failed');
    }
  };

  // ✏️ Update
  const handleUserUpdated = (updatedUser: User) => {
    setUsers(users.map(u => u._id === updatedUser._id ? updatedUser : u));
    setEditingUser(null);
  };

  // Get student class/section information
  const getStudentClass = (user: User) => {
    // Check sections first
    if (user.sections && user.sections.length > 0) {
      const section = user.sections[0];
      if (section.name && section.sectionCode) {
        return `${section.name} (${section.sectionCode})`;
      } else if (section.name) {
        return section.name;
      } else if (section.sectionCode) {
        return section.sectionCode;
      }
    }

    // Check roleProfile class as fallback
    if (user.roleProfile?.class) {
      const classData = user.roleProfile.class;
      if (classData.name && classData.sectionCode) {
        return `${classData.name} (${classData.sectionCode})`;
      } else if (classData.name) {
        return classData.name;
      } else if (classData.sectionCode) {
        return classData.sectionCode;
      }
    }

    return 'Not assigned';
  };

  // Get class status for styling
  const getClassStatus = (user: User) => {
    const hasSection = (user.sections && user.sections.length > 0) || user.roleProfile?.class;
    
    if (!hasSection) {
      return 'text-gray-500 italic';
    }
    return 'text-green-600 font-medium';
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
                You need to be an <strong>admin</strong> or have <strong>student_affairs</strong> permission to access this page.
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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Student Affairs</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage student information, section assignments, and student records.
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Create New Student
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email, or student ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Search
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                fetchStudents(1, '');
              }}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Students Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">All Students ({pagination.total})</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Class/Section</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{user.userId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-600">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${getClassStatus(user)}`}>
                        {getStudentClass(user)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleView(user)}
                        className="text-blue-600 hover:text-blue-900 transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => confirmDelete(user)}
                        className="text-red-600 hover:text-red-900 transition-colors ml-2"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                      </svg>
                      <p className="text-lg font-medium">No students found</p>
                      <p className="text-sm mt-1">Get started by creating your first student.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing page {pagination.current} of {pagination.pages} ({pagination.total} total students)
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.current - 1)}
                  disabled={!pagination.hasPrev}
                  className={`px-3 py-1 rounded border ${
                    pagination.hasPrev
                      ? 'bg-white text-gray-700 hover:bg-gray-50'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.current + 1)}
                  disabled={!pagination.hasNext}
                  className={`px-3 py-1 rounded border ${
                    pagination.hasNext
                      ? 'bg-white text-gray-700 hover:bg-gray-50'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h2 className="text-xl font-bold mb-4 text-red-600">Confirm Deletion</h2>
            <p className="mb-4">
              Are you sure you want to delete student <strong>{deletingUser.name}</strong>?
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

      
    </div>
  );
}