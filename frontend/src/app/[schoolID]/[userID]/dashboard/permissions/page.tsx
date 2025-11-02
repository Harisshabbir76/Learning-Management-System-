'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function PermissionsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [permission, setPermission] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'faculty' | 'admin'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const availablePermissions = [
    { label: 'Student Affairs', value: 'student_affairs', color: 'bg-blue-100 text-blue-800' },
    { label: 'Accounts Office', value: 'accounts_office', color: 'bg-green-100 text-green-800' },
  ];

  // Check if current user is admin
  const checkAdminAccess = async () => {
    try {
      if (!token) {
        setAccessDenied(true);
        return;
      }

      const res = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setCurrentUser(res.data.user);

      if (res.data.user?.role !== 'admin') {
        setAccessDenied(true);
        return;
      }

      // If user is admin, fetch permissions data
      fetchUsers();
    } catch (err: any) {
      console.error('Error checking admin access:', err);
      setAccessDenied(true);
    }
  };

  // Fetch users with permissions
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Ensure all users have a permissions array and only show those with permissions
      const usersWithPermissions = res.data.users
        .map((u: any) => ({
          ...u,
          permissions: u.permissions || []
        }))
        .filter((u: any) => u.permissions.length > 0); // Only show users with permissions
      
      setUsers(usersWithPermissions);
    } catch (err: any) {
      console.error('Error fetching permissions:', err);
      setError(err.response?.data?.msg || 'Failed to fetch users');
      toast.error(err.response?.data?.msg || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  // Search for users by name or ID
  const searchUsers = async (query: string) => {
    if (!query || query.length < 2) {
      setUserSuggestions([]);
      return;
    }
    
    try {
      const res = await axios.get(`${API_URL}/api/users/search?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      // Filter out users who already have permissions
      const eligibleUsers = res.data.users.filter((user: any) => 
        user.role !== 'student' && user.role !== 'parent'
      );
      
      setUserSuggestions(eligibleUsers);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Error searching users:', err);
    }
  };

  // Check for existing permission
  const checkExistingPermission = (userId: string, permission: string) => {
    const user = users.find(u => u.userId === parseInt(userId));
    if (user && user.permissions && user.permissions.includes(permission)) {
      return `User ${user.name} (ID: ${userId}) already has the '${permission}' permission`;
    }
    return null;
  };

  // Check admin access on component mount
  useEffect(() => {
    checkAdminAccess();
  }, []);

  // Assign permission
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!userId || !permission) {
      return setError('Please enter user ID and select permission');
    }

    // Check for duplicate permission before making API call
    const duplicateError = checkExistingPermission(userId, permission);
    if (duplicateError) {
      // Show toast notification for duplicate permission
      const permissionLabel = availablePermissions.find(p => p.value === permission)?.label || permission;
      toast.error(`User already has the "${permissionLabel}" permission`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    try {
      const res = await axios.post(
        `${API_URL}/api/permissions`,
        { userId: Number(userId), permission },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess(res.data.msg);
      // Show success toast
      toast.success(res.data.msg, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      fetchUsers(); // Refresh the list
      setUserId('');
      setPermission('');
      setModalOpen(false);
      setSearchQuery('');
      setUserSuggestions([]);
    } catch (err: any) {
      console.error(err);
      
      // Check if it's a duplicate permission error
      if (err.response?.data?.msg?.includes('already has')) {
        setError(err.response.data.msg);
        // Show toast notification for duplicate permission
        const permissionLabel = availablePermissions.find(p => p.value === permission)?.label || permission;
        toast.error(`User already has the "${permissionLabel}" permission`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } else {
        setError(err.response?.data?.msg || 'Failed to assign permission');
        // Show error toast
        toast.error(err.response?.data?.msg || 'Failed to assign permission', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }
    }
  };

  // Remove permission
  const handleRemove = async (userId: number, permission: string, userName: string) => {
    const permissionLabel = availablePermissions.find(p => p.value === permission)?.label || permission;
    
    if (!window.confirm(`Are you sure you want to remove the "${permissionLabel}" permission from ${userName}?`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/api/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { userId, permission },
      });

      setSuccess('Permission removed successfully');
      // Show success toast
      toast.success(`"${permissionLabel}" permission removed from ${userName}`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      
      fetchUsers(); // Refresh the list
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.msg || 'Failed to remove permission');
      // Show error toast
      toast.error(err.response?.data?.msg || 'Failed to remove permission', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  };

  // Filter users by role and search query
  const filteredUsers = users.filter(user => {
    // Role filter
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.userId.toString().includes(query)
      );
    }
    
    return true;
  });

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'teacher': return 'bg-blue-100 text-blue-800';
      case 'faculty': return 'bg-green-100 text-green-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Show access denied if user is not admin
  if (accessDenied) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 mb-6 rounded-lg shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-red-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-red-800">Access Denied</h3>
              <p className="mt-2 text-sm text-red-700">
                Administrator privileges are required to access this page.
              </p>
              <div className="mt-4">
                <Link
                  href={`/${currentUser?.school?._id || 'school'}/${currentUser?.userId || 'user'}/dashboard`}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors shadow-sm"
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
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      
      {/* Header */}
      <div className="md:flex md:justify-between md:items-center mb-6">
        <div className="mb-4 md:mb-0">
          <h1 className="text-2xl font-bold text-gray-900">User Permissions Management</h1>
          <p className="text-gray-600 mt-1">Manage permissions for teachers, faculty, and administrators</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={fetchUsers} 
            className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors shadow-sm text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button 
            onClick={() => setModalOpen(true)} 
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Assign Permission
          </button>
        </div>
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Users</label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                placeholder="Search by name, email, or ID"
                className="w-full p-2 pl-9 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
              <svg className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Role</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium ${roleFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'} hover:bg-gray-200 transition-colors`}
              >
                All Roles
              </button>
              <button
                onClick={() => setRoleFilter('teacher')}
                className={`px-3 py-1 rounded-full text-xs font-medium ${roleFilter === 'teacher' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'} hover:bg-gray-200 transition-colors`}
              >
                Teachers
              </button>
              <button
                onClick={() => setRoleFilter('faculty')}
                className={`px-3 py-1 rounded-full text-xs font-medium ${roleFilter === 'faculty' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} hover:bg-gray-200 transition-colors`}
              >
                Faculty
              </button>
              <button
                onClick={() => setRoleFilter('admin')}
                className={`px-3 py-1 rounded-full text-xs font-medium ${roleFilter === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'} hover:bg-gray-200 transition-colors`}
              >
                Admins
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="rounded-full p-2 bg-blue-100 text-blue-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-xl font-semibold text-gray-900">{users.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="rounded-full p-2 bg-green-100 text-green-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Student Affairs</p>
              <p className="text-xl font-semibold text-gray-900">
                {users.filter(u => u.permissions.includes('student_affairs')).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="rounded-full p-2 bg-yellow-100 text-yellow-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Accounts Office</p>
              <p className="text-xl font-semibold text-gray-900">
                {users.filter(u => u.permissions.includes('accounts_office')).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <div className="rounded-full p-2 bg-purple-100 text-purple-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Admins</p>
              <p className="text-xl font-semibold text-gray-900">
                {users.filter(u => u.role === 'admin').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading user permissions...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No permissions found</h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || roleFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria' 
              : 'Get started by assigning permissions to teachers, faculty, or administrators.'
            }
          </p>
          {(searchQuery || roleFilter !== 'all') ? (
            <button 
              onClick={() => {
                setSearchQuery('');
                setRoleFilter('all');
              }} 
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium shadow-sm"
            >
              Clear Filters
            </button>
          ) : (
            <button 
              onClick={() => setModalOpen(true)} 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
            >
              Assign First Permission
            </button>
          )}
        </div>
      ) : (
        /* Users Table */
        <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map(user => (
                  <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-800 font-medium">
                            {user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">ID: {user.userId}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(user.role)}`}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.permissions && user.permissions.length > 0 ? (
                          user.permissions.map((p: string) => {
                            const permissionInfo = availablePermissions.find(ap => ap.value === p);
                            return (
                              <span 
                                key={p} 
                                className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${permissionInfo?.color || 'bg-gray-100 text-gray-800'}`}
                              >
                                {permissionInfo ? permissionInfo.label : p}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-gray-500 text-sm">No permissions assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex flex-wrap gap-2">
                        {user.permissions && user.permissions.length > 0 ? (
                          user.permissions.map((p: string) => {
                            const permissionInfo = availablePermissions.find(ap => ap.value === p);
                            return (
                              <button
                                key={p}
                                onClick={() => handleRemove(user.userId, p, user.name)}
                                className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Remove {permissionInfo?.label || p}
                              </button>
                            );
                          })
                        ) : (
                          <span className="text-gray-500 text-sm">No actions available</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Permission Modal */}
      {modalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Assign New Permission</h2>
              <button 
                onClick={() => {
                  setModalOpen(false);
                  setUserId('');
                  setPermission('');
                  setSearchQuery('');
                  setUserSuggestions([]);
                }} 
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-gray-600 mb-4 text-sm">
              Search for a user by name or ID, then select a permission to assign.
            </p>

            <form onSubmit={handleAssign} className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select User *</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchUsers(e.target.value);
                    setUserId('');
                  }}
                  className="w-full p-2 pl-9 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Search users by name or ID"
                  required
                />
                <svg className="w-4 h-4 absolute left-2.5 bottom-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                
                {showSuggestions && userSuggestions.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto">
                    {userSuggestions.map(user => (
                      <div
                        key={user.userId}
                        onClick={() => {
                          setUserId(user.userId.toString());
                          setSearchQuery(`${user.name} (ID: ${user.userId})`);
                          setShowSuggestions(false);
                        }}
                        className="p-3 hover:bg-gray-100 cursor-pointer transition-colors"
                      >
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">ID: {user.userId} • {user.email}</div>
                        <div className="text-xs mt-1">
                          <span className={`px-2 py-0.5 rounded-full ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Permission *</label>
                <div className="grid grid-cols-1 gap-2">
                  {availablePermissions.map(p => (
                    <div
                      key={p.value}
                      onClick={() => setPermission(p.value)}
                      className={`p-3 border rounded-md cursor-pointer transition-colors ${
                        permission === p.value 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${
                          permission === p.value 
                            ? 'border-blue-500 bg-blue-500' 
                            : 'border-gray-400'
                        }`}>
                          {permission === p.value && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium">{p.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Show permission status */}
              {userId && permission && (
                <div className={`p-3 rounded-md text-sm ${
                  checkExistingPermission(userId, permission) 
                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200' 
                    : 'bg-green-50 text-green-800 border border-green-200'
                }`}>
                  {checkExistingPermission(userId, permission) 
                    ? "⚠️ This permission is already assigned to this user"
                    : "✓ This permission can be assigned to this user"
                  }
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={() => {
                    setModalOpen(false);
                    setUserId('');
                    setPermission('');
                    setSearchQuery('');
                    setUserSuggestions([]);
                  }} 
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!userId || !permission}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                >
                  Assign Permission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}