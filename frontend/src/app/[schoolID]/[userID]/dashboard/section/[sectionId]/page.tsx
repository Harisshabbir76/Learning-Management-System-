'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import AddStudentModal from '../../../../../../component/AddStudentModal';

export default function SectionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { schoolID, userID, sectionId } = params;
  const [section, setSection] = useState(null);
  const [courses, setCourses] = useState([]);
  const [timetable, setTimetable] = useState(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [sessionStatus, setSessionStatus] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    sectionCode: '',
    description: '',
    capacity: 30,
    sessionStartDate: '',
    sessionEndDate: '',
    isActive: true
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  };

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

      if (!hasSectionManagementPermission(user)) {
        setUnauthorized(true);
        setPageLoading(false);
        return;
      }

      if (sectionId) {
        fetchSection();
        fetchSessionStatus();
      }
    } catch (err) {
      console.error('Error fetching user:', err);
      setUnauthorized(true);
      setPageLoading(false);
    }
  };

  const hasSectionManagementPermission = (user) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) return true;
    return false;
  };

  const hasTimetableAccess = (user) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) return true;
    if (user.role === 'faculty' && user.permissions?.includes('course-management')) return true;
    return false;
  };

  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const fetchCourses = async () => {
    try {
      setCoursesLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/courses/section/${sectionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCourses(data.data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
      showNotification('Failed to load courses', 'error');
    } finally {
      setCoursesLoading(false);
    }
  };

  const fetchTimetable = async () => {
    if (!section) return;
    
    try {
      setTimetableLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/section/${encodeURIComponent(section.name)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTimetable(data.data);
        } else {
          setTimetable(null);
        }
      } else if (response.status === 404) {
        setTimetable(null);
      } else {
        setTimetable(null);
      }
    } catch (err) {
      console.error('Error fetching timetable:', err);
      setTimetable(null);
    } finally {
      setTimetableLoading(false);
    }
  };

  const fetchSection = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/sections/${sectionId}`;
      
      const response = await fetch(apiUrl, {
        headers: { 
          Authorization: `Bearer ${token}`,
        },
      });

      const responseText = await response.text();
      
      if (responseText.trim().startsWith('<!DOCTYPE') || responseText.includes('<html')) {
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response from server. Status: ${response.status}`);
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Server error: ${response.status}`);
      }

      if (data.success) {
        setSection(data.data);
        setEditFormData({
          name: data.data.name || '',
          sectionCode: data.data.sectionCode || '',
          description: data.data.description || '',
          capacity: data.data.capacity || 30,
          sessionStartDate: formatDateForInput(data.data.sessionStartDate),
          sessionEndDate: formatDateForInput(data.data.sessionEndDate),
          isActive: data.data.isActive !== undefined ? data.data.isActive : true
        });
        
        // Fetch courses and timetable for this section
        await Promise.all([fetchCourses(), fetchTimetable()]);
      } else {
        throw new Error(data.error || data.message || 'Failed to fetch section data');
      }
    } catch (err) {
      console.error('Error in fetchSection:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const fetchSessionStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections/${sectionId}/session-status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessionStatus(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching session status:', err);
    }
  };

  // Fetch timetable when section changes or when switching to schedule tab
  useEffect(() => {
    if (section && activeTab === 'schedule') {
      fetchTimetable();
    }
  }, [section, activeTab]);

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections/${sectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editFormData,
          sessionStartDate: new Date(editFormData.sessionStartDate).toISOString(),
          sessionEndDate: new Date(editFormData.sessionEndDate).toISOString()
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update section');
      }

      if (data.success) {
        await fetchSection();
        setIsEditing(false);
        setEditError('');
        showNotification('Section updated successfully!', 'success');
      }
    } catch (err) {
      console.error('Error updating section:', err);
      setEditError(err.message);
      showNotification(err.message, 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEndSession = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections/${sectionId}/end-session`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to end session');
      }

      if (data.success) {
        await fetchSection();
        await fetchSessionStatus();
        showNotification('Session ended successfully!', 'success');
      }
    } catch (err) {
      console.error('Error ending session:', err);
      showNotification('Failed to end session: ' + err.message, 'error');
    }
  };

  const openConfirmModal = (studentId, studentName) => {
    setStudentToRemove({ id: studentId, name: studentName });
    setShowConfirmModal(true);
  };

  const closeConfirmModal = () => {
    setShowConfirmModal(false);
    setStudentToRemove(null);
  };

  const handleRemoveStudent = async () => {
    if (!studentToRemove) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections/${sectionId}/students/${studentToRemove.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to remove student');
      }

      if (data.success) {
        await fetchSection();
        closeConfirmModal();
        showNotification('Student removed successfully!', 'success');
      }
    } catch (err) {
      console.error('Error removing student:', err);
      showNotification('Failed to remove student: ' + err.message, 'error');
      closeConfirmModal();
    }
  };

  const handleStudentAdded = async () => {
    await fetchSection();
    showNotification('Student added successfully!', 'success');
  };

  // Helper function to get day name
  const getDayName = (dayIndex) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayIndex] || `Day ${dayIndex + 1}`;
  };

  // Render timetable grid
  const renderTimetableGrid = () => {
    if (!timetable) return null;

    const { days, periodsPerDay, schedule } = timetable;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-300 p-4 font-semibold text-gray-700 text-center min-w-[120px]">
                Time / Day
              </th>
              {Array.from({ length: days }, (_, i) => (
                <th key={i} className="border border-gray-300 p-4 font-semibold text-gray-700 text-center min-w-[150px]">
                  {getDayName(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: periodsPerDay }, (_, periodIdx) => (
              <tr key={periodIdx}>
                <td className="border border-gray-300 p-4 bg-gray-50 font-medium text-gray-700 text-center">
                  Period {periodIdx + 1}
                </td>
                {Array.from({ length: days }, (_, dayIdx) => {
                  const slot = schedule?.find(
                    (s) => s.dayIndex === dayIdx && s.periodIndex === periodIdx
                  );
                  
                  return (
                    <td
                      key={dayIdx}
                      className="border border-gray-300 p-4 text-center"
                    >
                      {slot ? (
                        <div className="space-y-1">
                          <div className="font-semibold text-blue-800">
                            {slot.course?.name || 'Unknown Course'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {slot.teacher?.name || 'No Teacher'}
                          </div>
                          {slot.course?.code && (
                            <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              {slot.course.code}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-gray-400 italic">Free</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>
            <span className="font-semibold">{schedule?.length || 0}</span> out of{' '}
            <span className="font-semibold">{days * periodsPerDay}</span> periods scheduled
          </p>
        </div>
      </div>
    );
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading section details...</p>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have permission to view this section.</p>
          <Link
            href={`/${schoolID}/${userID}/dashboard`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Section</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link
            href={`/${schoolID}/${userID}/dashboard/section`}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Back to Sections
          </Link>
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No section data found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {showAddStudentModal && (
        <AddStudentModal
          sectionId={sectionId}
          onClose={() => setShowAddStudentModal(false)}
          onSuccess={handleStudentAdded}
        />
      )}

      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ease-in-out ${
          notification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}>
          <div className={`rounded-lg shadow-lg p-4 min-w-80 border-l-4 ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-500 text-green-800' 
              : 'bg-red-50 border-red-500 text-red-800'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification({ show: false, message: '', type: '' })}
                className="ml-auto pl-3 -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-green-400 p-1.5 inline-flex h-8 w-8 bg-green-50 hover:bg-green-100 text-green-500"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                Remove Student
              </h3>
              
              <p className="text-gray-600 text-center mb-6">
                Are you sure you want to remove <span className="font-semibold text-gray-900">{studentToRemove?.name || 'this student'}</span> from the section?
              </p>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={closeConfirmModal}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRemoveStudent}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/${schoolID}/${userID}/dashboard/section`}
                className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Sections
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Section Details</h1>
                <p className="text-gray-600 mt-1">{section?.sectionCode}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {sessionStatus?.isActive && (
                <div className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                  Session Active
                </div>
              )}
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                section?.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {section?.isActive ? 'Active' : 'Inactive'}
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Edit Section
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Section Info Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          {isEditing ? (
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Edit Section</h2>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                  >
                    {editLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setEditError('');
                      setEditFormData({
                        name: section?.name || '',
                        sectionCode: section?.sectionCode || '',
                        description: section?.description || '',
                        capacity: section?.capacity || 30,
                        sessionStartDate: formatDateForInput(section?.sessionStartDate),
                        sessionEndDate: formatDateForInput(section?.sessionEndDate),
                        isActive: section?.isActive !== undefined ? section.isActive : true
                      });
                    }}
                    className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium border border-gray-300 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
              
              {editError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 font-medium">{editError}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section Code *
                  </label>
                  <input
                    type="text"
                    name="sectionCode"
                    value={editFormData.sectionCode}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Capacity
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    value={editFormData.capacity}
                    onChange={handleEditChange}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session Start Date *
                  </label>
                  <input
                    type="date"
                    name="sessionStartDate"
                    value={editFormData.sessionStartDate}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Session End Date *
                  </label>
                  <input
                    type="date"
                    name="sessionEndDate"
                    value={editFormData.sessionEndDate}
                    onChange={handleEditChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    required
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={editFormData.description}
                    onChange={handleEditChange}
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                    placeholder="Enter section description..."
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={editFormData.isActive}
                      onChange={handleEditChange}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Active Section</span>
                  </label>
                </div>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{section?.name}</h2>
                  {section?.description && (
                    <p className="text-gray-600 mt-2 text-lg">"{section.description}"</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Created on</p>
                  <p className="font-medium text-gray-900">{formatDate(section?.createdAt)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Students</p>
                      <p className="text-2xl font-bold text-gray-900">
                        <span className={section?.students?.length >= section?.capacity ? 'text-red-600' : 'text-green-600'}>
                          {section?.students?.length || 0}
                        </span>
                        /{section?.capacity}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Session Start</p>
                      <p className="text-lg font-bold text-gray-900">{formatDate(section?.sessionStartDate)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Session End</p>
                      <p className="text-lg font-bold text-gray-900">{formatDate(section?.sessionEndDate)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
          
          <div className="border-t border-gray-200 pt-6">
            
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <nav className="flex space-x-8 px-6 border-b border-gray-200">
            {['overview', 'students', 'courses', 'schedule'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Basic Information</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Section Code</span>
                    <span className="font-semibold text-gray-900">{section?.sectionCode}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Teacher</span>
                    <span className="font-semibold text-gray-900">{section?.teacher?.name || 'Not assigned'}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">School</span>
                    <span className="font-semibold text-gray-900">{section?.school?.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">Created By</span>
                    <span className="font-semibold text-gray-900">{section?.createdBy?.name || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center py-3">
                    <span className="text-gray-600 font-medium">Status</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      section?.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {section?.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Session Timeline</h3>
                <div className="bg-gray-50 rounded-lg p-6">
                  {sessionStatus?.isActive ? (
                    <>
                      <div className="flex items-center mb-6">
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Session Active</h4>
                          <p className="text-sm text-gray-600">
                            Ends on: {formatDate(sessionStatus.sessionEndDate)}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Duration:</span>
                          <span className="font-semibold">
                            {Math.ceil((new Date(sessionStatus.sessionEndDate) - new Date(sessionStatus.sessionStartDate)) / (1000 * 60 * 60 * 24))} days
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start Date:</span>
                          <span className="font-semibold">{formatDate(sessionStatus.sessionStartDate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">End Date:</span>
                          <span className="font-semibold">{formatDate(sessionStatus.sessionEndDate)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">No Active Session</h4>
                      <p className="text-gray-600">
                        No active session is currently running
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'students' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Enrolled Students
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {section?.students?.length || 0} of {section?.capacity} students enrolled
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    section?.students?.length >= section?.capacity 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {section?.students?.length >= section?.capacity ? 'Full' : 'Available'}
                  </span>
                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    disabled={!section || section.students?.length >= section.capacity || !section.isActive}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Add Student
                  </button>
                </div>
              </div>

              {!section?.students || section.students.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg">
                  <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Students Enrolled</h4>
                  <p className="text-gray-600 mb-6">This section doesn't have any students yet</p>
                  <button
                    onClick={() => setShowAddStudentModal(true)}
                    disabled={!section?.isActive}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium transition-colors"
                  >
                    Add First Student
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Student
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact Information
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {section.students.map((student, index) => (
                        <tr key={student._id || index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mr-4">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              </div>
                              <div>
                                <div className="font-semibold text-gray-900">{student.name || 'Unknown'}</div>
                                <div className="text-sm text-gray-500">ID: {student.userId || 'N/A'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="text-sm text-gray-900">{student.email || 'N/A'}</div>
                              <div className="text-xs text-gray-500">
                                {student.phone || 'No phone number'}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => openConfirmModal(student._id, student.name)}
                              className="inline-flex items-center px-3 py-1 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium"
                            >
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'courses' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Linked Courses
                  </h3>
                  <p className="text-gray-600 mt-1">
                    {courses?.length || 0} courses linked to this section
                  </p>
                </div>
                <Link
                  href={`/${schoolID}/${userID}/dashboard/courses/create`}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Create New Course
                </Link>
              </div>

              {coursesLoading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : !courses || courses.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-lg">
                  <svg className="w-20 h-20 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">No Courses Linked</h4>
                  <p className="text-gray-600 mb-6">This section doesn't have any courses yet</p>
                  <Link
                    href={`/${schoolID}/${userID}/dashboard/courses/create`}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Create First Course
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {courses.map((course) => {
                    // Get the student count from the section instead of the course
                    const studentCount = section?.students?.length || 0;
                    
                    return (
                      <div key={course._id} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
                        <div className="flex items-start justify-between mb-4">
                          <h4 className="text-lg font-semibold text-gray-900 truncate">{course.name}</h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            course.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {course.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        {course.description && (
                          <p className="text-gray-600 text-sm mb-4 line-clamp-2">{course.description}</p>
                        )}
                        
                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{course.teachers?.length || 0} teachers</span>
                          </div>
                          
                          <div className="flex items-center text-sm text-gray-500">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span>{studentCount} students</span>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                          <Link
                            href={`/${schoolID}/${userID}/dashboard/courses/${course._id}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
                          >
                            View Details →
                          </Link>
                          <span className="text-xs text-gray-500">
                            Created: {new Date(course.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div>
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Class Timetable</h3>
                  <p className="text-gray-600 mt-1">
                    {timetable ? 'View and manage class schedule' : 'No timetable created yet'}
                  </p>
                </div>
                
                {hasTimetableAccess(currentUser) && (
                  <div className="flex space-x-3">
                    {timetable ? (
                      <Link
                        href={`/${schoolID}/${userID}/dashboard/timetable/edit/${encodeURIComponent(section.name)}`}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Edit Timetable
                      </Link>
                    ) : (
                      <Link
                        href={`/${schoolID}/${userID}/dashboard/timetable/create`}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        Create Timetable
                      </Link>
                    )}
                    <Link
                      href={`/${schoolID}/${userID}/dashboard/timetable`}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                    >
                      View All Timetables
                    </Link>
                  </div>
                )}
              </div>

              {timetableLoading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : timetable ? (
                <div>
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <h4 className="font-semibold text-blue-800">Timetable Available</h4>
                        <p className="text-blue-700 text-sm">
                          {timetable.days} days × {timetable.periodsPerDay} periods
                          {timetable.schedule?.length > 0 && (
                            <span> • {timetable.schedule.length} periods scheduled</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {renderTimetableGrid()}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  
                  <h4 className="text-xl font-semibold text-gray-900 mb-2">
                    {hasTimetableAccess(currentUser) ? 'No Timetable Created' : 'Timetable Not Available'}
                  </h4>
                  
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {hasTimetableAccess(currentUser) 
                      ? 'Create a timetable to organize class schedules and assign courses to specific time slots.'
                      : 'The timetable for this section has not been created yet. Please contact an administrator.'
                    }
                  </p>

                  {hasTimetableAccess(currentUser) ? (
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Link
                        href={`/${schoolID}/${userID}/dashboard/timetable/create`}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                      >
                        Create Timetable
                      </Link>
                      <Link
                        href={`/${schoolID}/${userID}/dashboard/timetable`}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                      >
                        View All Timetables
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <h5 className="font-semibold text-gray-900 mb-1">Session Period</h5>
                        <p className="text-sm text-gray-600">
                          {formatDate(section?.sessionStartDate)} - {formatDate(section?.sessionEndDate)}
                        </p>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <h5 className="font-semibold text-gray-900 mb-1">Enrollment</h5>
                        <p className="text-sm text-gray-600">
                          {section?.students?.length || 0} / {section?.capacity} students
                        </p>
                      </div>
                      
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <h5 className="font-semibold text-gray-900 mb-1">Teacher</h5>
                        <p className="text-sm text-gray-600">
                          {section?.teacher?.name || 'Not assigned'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>  
    </div>
  );
}