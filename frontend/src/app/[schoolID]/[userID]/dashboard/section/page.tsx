'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  description?: string;
  capacity: number;
  sessionStartDate: string;
  sessionEndDate: string;
  sessionDuration?: number;
  isActive: boolean;
  students: any[];
  teacher: {
    _id: string;
    name: string;
  };
}

interface CurrentUser {
  role: string;
  permissions?: string[];
  school?: { _id: string };
  userId?: string;
}

interface SessionStatus {
  [key: string]: {
    isActive: boolean;
    timeRemaining: number;
    sessionStatus: string;
  };
}

export default function SectionsPage() {
  const router = useRouter();
  const { schoolID, userID } = useParams();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [sectionToDelete, setSectionToDelete] = useState<Section | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [sessionStatuses, setSessionStatuses] = useState<SessionStatus>({});

  // Define the permission function
  const hasSectionManagementPermission = (user: CurrentUser | null) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) return true;
    return false;
  };

  useEffect(() => {
    fetchSections();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch user profile');
      
      const data = await res.json();
      const user = data.user || data.data;
      setCurrentUser(user);

      // Check if user has section management permission
      if (!hasSectionManagementPermission(user)) {
        setUnauthorized(true);
      }
    } catch (err: any) {
      console.error('Error fetching user:', err);
      setUnauthorized(true);
    }
  };

  const fetchSections = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch sections');

      if (data.success) {
        setSections(data.data || []);
        // Check session status for each section
        checkSessionStatuses(data.data || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkSessionStatuses = async (sectionsToCheck: Section[] = sections) => {
    if (sectionsToCheck.length === 0) return;
    
    const statuses: SessionStatus = {};
    
    for (const section of sectionsToCheck) {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections/${section._id}/session-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data = await response.json();
          statuses[section._id] = data.data;
        }
      } catch (err: any) {
        console.error(`Error checking session status for section ${section._id}:`, err);
        // Set default status if API call fails
        statuses[section._id] = {
          isActive: section.isActive && new Date() >= new Date(section.sessionStartDate) && new Date() <= new Date(section.sessionEndDate),
          timeRemaining: 0,
          sessionStatus: 'unknown'
        };
      }
    }
    
    setSessionStatuses(prev => ({ ...prev, ...statuses }));
  };

  const calculateDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + 
                      (end.getMonth() - start.getMonth());
    return Math.max(0, diffMonths);
  };

  const formatDuration = (months: number) => {
    if (months === 0) return '0 months';
    if (months === 1) return '1 month';
    return `${months} months`;
  };

  const openDeleteModal = (section: Section) => {
    setSectionToDelete(section);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSectionToDelete(null);
  };

  const handleDelete = async () => {
    if (!sectionToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections/${sectionToDelete._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete section');

      // Remove the deleted section from state
      setSections(sections.filter(section => section._id !== sectionToDelete!._id));
      closeDeleteModal();
    } catch (err: any) {
      setError(err.message);
      closeDeleteModal();
    }
  };

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
                {currentUser?.role === 'faculty' 
                  ? 'Faculty members require "student_affairs" permission to access this page.'
                  : 'Administrator privileges or student_affairs permission are required to access this page.'
                }
              </p>
              <div className="mt-4">
                <Link
                  href={`/${currentUser?.school?._id || 'school'}/${currentUser?.userId || 'user'}/dashboard`}
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Delete Section
              </h3>
              
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to delete the section{' '}
                <span className="font-semibold text-gray-900">"{sectionToDelete?.name}"</span>?
                This action cannot be undone.
              </p>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={closeDeleteModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Sections Management</h1>
        {hasSectionManagementPermission(currentUser) && (
          <Link
            href={`/${schoolID}/${userID}/dashboard/section/create`}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Create New Section
          </Link>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">All Sections</h2>
          <p className="text-gray-600">Total: {sections.length} sections</p>
        </div>

        {sections.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">No sections found.</p>
            {hasSectionManagementPermission(currentUser) && (
              <Link
                href={`/${schoolID}/${userID}/dashboard/section/create`}
                className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Create Your First Section
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3">Section Code</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Teacher</th>
                  <th className="p-3">Students</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Status</th>
                  {hasSectionManagementPermission(currentUser) && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => {
                  const sessionInfo = sessionStatuses[section._id] || {};
                  const isSessionActive = sessionInfo.isActive || false;
                  const sessionStatus = sessionInfo.sessionStatus || 'unknown';
                  const duration = calculateDuration(section.sessionStartDate, section.sessionEndDate);
                  
                  return (
                    <tr key={section._id} className="border-t hover:bg-gray-50">
                      <td className="p-3 font-mono">{section.sectionCode}</td>
                      <td className="p-3 font-medium">{section.name}</td>
                      <td className="p-3">{section.teacher?.name || 'Unknown'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          section.students.length >= section.capacity 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {section.students.length} / {section.capacity}
                        </span>
                      </td>
                      <td className="p-3">{formatDuration(duration)}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          sessionStatus === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : sessionStatus === 'upcoming'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
                        </span>
                      </td>
                      {hasSectionManagementPermission(currentUser) && (
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-4">
                            <Link
                              href={`/${schoolID}/${userID}/dashboard/section/${section._id}`}
                              className="text-blue-600 hover:text-blue-800 transition-colors"
                              title="View Section"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                              </svg>
                            </Link>
                            <button
                              onClick={() => openDeleteModal(section)}
                              className="text-red-600 hover:text-red-800 transition-colors"
                              title="Delete Section"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}