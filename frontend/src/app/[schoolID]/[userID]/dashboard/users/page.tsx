'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import UserEditForm from '../../../../../component/UserEditForm';
import Link from 'next/link';

interface User {
  _id: string;
  name: string;
  userId: string | number;
  email: string;
  role: string;
  school: any;
}

interface LoggedInUser {
  _id: string;
  name: string;
  userId: string | number;
  email: string;
  role: string;
  school: any;
  permissions?: string[];
}

interface ApiResponse {
  success: boolean;
  data?: User[];
  message?: string;
}

export default function UsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [users, setUsers] = useState<User[]>([]);
  const [token, setToken] = useState<string>('');
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [successMessage, setSuccessMessage] = useState('');

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
        
        if (!profileRes.ok) {
          throw new Error(`Failed to fetch user profile: ${profileRes.status}`);
        }

        const profileData = await profileRes.json();
        
        if (!profileData.success) {
          throw new Error(profileData.message || 'Failed to fetch user profile');
        }
        
        setLoggedInUser(profileData.user);

        // 2️⃣ Check if user is admin or faculty with student_affairs permission
        const userRole = profileData.user?.role;
        const userPermissions = profileData.user?.permissions || [];
        
        if (userRole !== 'admin' && !(userRole === 'faculty' && userPermissions.includes('student_affairs'))) {
          setUnauthorized(true);
          setLoading(false);
          return;
        }

        // 3️⃣ Fetch all users (only if authorized)
        const usersRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        
        if (!usersRes.ok) {
          throw new Error(`Failed to fetch users: ${usersRes.status}`);
        }

        const usersData: ApiResponse = await usersRes.json();
        
        if (!usersData.success) {
          throw new Error(usersData.message || 'Failed to fetch users');
        }

        setUsers(Array.isArray(usersData.data) ? usersData.data : []);
        
      } catch (err: any) {
        console.error('Error:', err);
        alert(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  // Filter users based on search term and role filter
  const filteredUsers = users.filter(user => {
    // Convert all searchable fields to strings for safe comparison
    const name = String(user.name || '');
    const email = String(user.email || '');
    const userId = String(user.userId || '');
    
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getSafeRouteParts = () => {
    const parts = (pathname || '').split('/').filter(Boolean);
    const pathSchool = parts[0] || '';
    const pathUser = parts[1] || '';
    const userSchool: any = loggedInUser?.school;
    const schoolSegment = typeof userSchool === 'string' ? userSchool : (userSchool?._id || userSchool?.id || pathSchool);
    const userIdSegment = loggedInUser?.userId || pathUser;
    return { schoolSegment, userIdSegment };
  };

  const handleCreate = () => {
    const { schoolSegment, userIdSegment } = getSafeRouteParts();
    if (!schoolSegment || !userIdSegment) return;
    router.push(`/${schoolSegment}/${userIdSegment}/dashboard/users/create`);
  };

  const confirmDelete = (user: User) => {
    setDeletingUser(user);
  };

  const handleDeleteConfirmed = async () => {
    if (!deletingUser || !token) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/${deletingUser._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Delete failed');
      }
      
      const result = await res.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Delete failed');
      }
      
      setUsers(users.filter((u) => u._id !== deletingUser._id));
      setDeletingUser(null);
      setSuccessMessage(`User "${deletingUser.name}" has been successfully deleted.`);
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 5000);
      
      // Show success message
      setTimeout(() => {
        setDeleteLoading(false);
      }, 500);
    } catch (err: any) {
      setDeleteLoading(false);
      alert(err.message || 'Delete failed');
    }
  };

  const handleUserUpdated = (updatedUser: User) => {
    setUsers(users.map(u => u._id === updatedUser._id ? updatedUser : u));
    setEditingUser(null);
    setSuccessMessage(`User "${updatedUser.name}" has been successfully updated.`);
    
    // Auto-hide success message after 5 seconds
    setTimeout(() => {
      setSuccessMessage('');
    }, 5000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="max-w-2xl mx-auto p-6 min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="bg-white rounded-xl shadow-lg p-6 w-full">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
                <p className="mt-2 text-red-700">
                  Administrator or faculty with student affairs privileges are required to access this page.
                </p>
                <div className="mt-4">
                  <Link
                    href={`/${loggedInUser?.school?._id || 'school'}/${loggedInUser?.userId || 'user'}/dashboard`}
                    className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors shadow-sm"
                  >
                    Go to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Success Message Toast */}
        {successMessage && (
          <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md shadow-lg max-w-sm">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">{successMessage}</p>
                </div>
                <div className="ml-auto pl-3">
                  <button
                    onClick={() => setSuccessMessage('')}
                    className="text-green-500 hover:text-green-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-1">Manage all user accounts in the system</p>
          </div>
          <button
            onClick={handleCreate}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-md hover:shadow-lg transition-transform hover:scale-105"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Create New User
          </button>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search Users
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  id="search"
                  placeholder="Search by name, email, or ID"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Role
              </label>
              <select
                id="role-filter"
                className="block w-full pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="faculty">Faculty</option>
                <option value="student">Student</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl font-semibold text-gray-800 mb-2 sm:mb-0">All Users</h2>
            <div className="flex items-center">
              <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                {filteredUsers.length} {filteredUsers.length === 1 ? 'User' : 'Users'} Found
              </span>
              {(searchTerm || roleFilter !== 'all') && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('all');
                  }}
                  className="ml-3 text-sm text-blue-600 hover:text-blue-800 flex items-center"
                >
                  Clear filters
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <div className="overflow-x-auto">
            {filteredUsers.length > 0 ? (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 text-left text-gray-700 uppercase text-sm font-medium">
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">User ID</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold shadow-sm">
                            {user.name?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium text-gray-900">{user.name || 'Unknown'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          {user.userId || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">{user.email || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1.5 inline-flex text-sm leading-5 font-semibold rounded-full
                          ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 
                            user.role === 'faculty' ? 'bg-blue-100 text-blue-800' : 
                            'bg-green-100 text-green-800'}`}
                        >
                          {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Unknown'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors flex items-center"
                            title="Edit user"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => confirmDelete(user)}
                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors flex items-center"
                            title="Delete user"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900">No users found</h3>
                <p className="mt-1 text-gray-500">
                  {searchTerm || roleFilter !== 'all' 
                    ? 'Try adjusting your search or filter criteria.' 
                    : 'Get started by creating a new user.'}
                </p>
                <div className="mt-6">
                  <button
                    onClick={handleCreate}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-transform hover:scale-105"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Create New User
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Delete Confirmation Popup */}
        {deletingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 backdrop-blur-sm transition-opacity duration-300">
            <div 
              className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-95 animate-in fade-in-90 zoom-in-90"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center mb-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mr-4">
                  <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Confirm User Deletion</h2>
              </div>
              
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-5 rounded-md">
                <p className="text-red-700 font-medium">This action cannot be undone.</p>
              </div>
              
              <p className="mb-5 text-gray-600">
                You are about to permanently delete the user account for <span className="font-semibold text-gray-900">{deletingUser.name}</span> ({deletingUser.email}). All associated data will be removed from the system.
              </p>
              
              <div className="flex flex-col sm:flex-row sm:justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                <button
                  onClick={() => setDeletingUser(null)}
                  disabled={deleteLoading}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirmed}
                  disabled={deleteLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium flex items-center justify-center disabled:opacity-50"
                >
                  {deleteLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {editingUser && (
          <UserEditForm
            user={editingUser}
            token={token}
            onClose={() => setEditingUser(null)}
            onUpdate={handleUserUpdated}
            isAdmin={loggedInUser?.role === 'admin'}
          />
        )}
      </div>
    </div>
  );
}