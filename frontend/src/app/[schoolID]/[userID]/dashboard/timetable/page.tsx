'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

const TimetableList = () => {
  const { user, schoolId, permissions, loading: authLoading } = useAuth();
  const router = useRouter();
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [timetableToDelete, setTimetableToDelete] = useState<any | null>(null);

  // Check if user has admin or student_affairs permissions
  const hasAccess = user?.role === 'admin' || permissions?.includes('student_affairs');

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;
    
    if (!user) {
      toast.error('Please login to access this page');
      router.push('/login');
      return;
    }
    
    fetchTimetables();
  }, [user, schoolId, authLoading]);

  const fetchTimetables = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/timetable`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTimetables(data.data || []);
      } else {
        toast.error('Failed to fetch timetables');
      }
    } catch (error) {
      console.error('Error fetching timetables:', error);
      toast.error('Error fetching timetables');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteModal = (timetable: any) => {
    setTimetableToDelete(timetable);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setTimetableToDelete(null);
  };

  const handleDelete = async () => {
    if (!timetableToDelete) return;
    
    try {
      setDeletingId(timetableToDelete._id);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/${timetableToDelete._id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        toast.success('Timetable deleted successfully');
        // Remove the deleted timetable from the list
        setTimetables(timetables.filter(t => t._id !== timetableToDelete._id));
        closeDeleteModal();
      } else {
        const errorData = await response.json();
        toast.error(errorData.msg || 'Failed to delete timetable');
      }
    } catch (error) {
      console.error('Error deleting timetable:', error);
      toast.error('Error deleting timetable');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (timetable: any) => {
    if (!user) return;
    
    // Get the section name and make it URL-friendly
    const sectionName = timetable.section?.name || 'unknown';
    const urlFriendlyName = encodeURIComponent(sectionName.toLowerCase().replace(/\s+/g, '-'));
    
    // Navigate to the edit page with section name in URL
    router.push(`/${schoolId}/${user.userId}/dashboard/timetable/edit/${urlFriendlyName}`);
  };

  const handleView = (timetable: any) => {
    if (!user) return;
    
    // Get the section name and make it URL-friendly
    const sectionName = timetable.section?.name || 'unknown';
    const urlFriendlyName = encodeURIComponent(sectionName.toLowerCase().replace(/\s+/g, '-'));
    
    // Navigate to the view page with section name in URL
    router.push(`/${schoolId}/${user.userId}/dashboard/timetable/${urlFriendlyName}`);
  };

  // Show loading state while auth is being checked
  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Admin and Student Affairs View
  const AdminView = () => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Section
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Days
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Periods Per Day
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Filled Slots
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timetables.map((timetable: any) => {
              const filledSlots = timetable.schedule?.length || 0;
              const totalSlots = timetable.days * timetable.periodsPerDay;
              const completionPercentage = totalSlots > 0 ? (filledSlots / totalSlots) * 100 : 0;
              const isComplete = completionPercentage === 100;
              
              return (
                <tr key={timetable._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      {timetable.section?.name || 'Unknown Section'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Grade: {timetable.section?.grade || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {timetable.days} days
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      {timetable.periodsPerDay} periods
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="h-2.5 rounded-full" 
                          style={{ 
                            width: `${completionPercentage}%`,
                            backgroundColor: isComplete ? '#10B981' : '#3B82F6'
                          }}
                        ></div>
                      </div>
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        {filledSlots}/{totalSlots}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      isComplete 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {isComplete ? 'Complete' : 'In Progress'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleView(timetable)}
                        className="text-blue-600 hover:text-blue-900 flex items-center"
                        title="View Timetable"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(timetable)}
                        className="text-indigo-600 hover:text-indigo-900 flex items-center"
                        title="Edit Timetable"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteModal(timetable)}
                        className="text-red-600 hover:text-red-900 flex items-center"
                        title="Delete Timetable"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Student, Teacher, Parent View
  const TimetableView = ({ timetable }: { timetable: any }) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].slice(0, timetable.days);
    const periods = Array.from({ length: timetable.periodsPerDay }, (_, i) => i);

    const getSlot = (dayIndex: number, periodIndex: number) => {
      return timetable.schedule.find((s: any) => s.dayIndex === dayIndex && s.periodIndex === periodIndex);
    };

    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden mt-4">
        <h2 className="text-xl font-bold p-4">Timetable for {timetable.section.name}</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Day
                </th>
                {periods.map(period => (
                  <th key={period} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Period {period + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {days.map((day, dayIndex) => (
                <tr key={day} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{day}</td>
                  {periods.map(periodIndex => {
                    const slot = getSlot(dayIndex, periodIndex);
                    return (
                      <td key={periodIndex} className="px-6 py-4 whitespace-nowrap">
                        {slot ? (
                          <div>
                            <div className="font-medium text-gray-900">{slot.course?.name || 'N/A'}</div>
                            <div className="text-sm text-gray-500">{slot.teacher?.name || 'N/A'}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">-</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading timetables...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && timetableToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">Delete Timetable</h3>
              </div>
            </div>
            
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete the timetable for{' '}
                <span className="font-semibold text-gray-900">
                  {timetableToDelete.section?.name || 'Unknown Section'}
                </span>? This action cannot be undone.
              </p>
            </div>
            
            <div className="mt-4 flex justify-end space-x-3">
              <button
                type="button"
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                onClick={closeDeleteModal}
                disabled={deletingId === timetableToDelete._id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                onClick={handleDelete}
                disabled={deletingId === timetableToDelete._id}
              >
                {deletingId === timetableToDelete._id ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </div>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Timetable</h1>
        {hasAccess && (
          <Link 
            href={`/${schoolId}/${user.userId}/dashboard/timetable/create`}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create New Timetable
          </Link>
        )}
      </div>
      
      {timetables.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Timetables Found</h2>
          <p className="text-gray-500 mb-4">
            {hasAccess ? 'Get started by creating your first timetable.' : 'No timetable is available for you at the moment.'}
          </p>
          {hasAccess && (
            <Link 
              href={`/${schoolId}/${user.userId}/dashboard/timetable/create`}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md inline-flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Create New Timetable
            </Link>
          )}
        </div>
      ) : (
        hasAccess ? <AdminView /> : timetables.map((t: any) => <TimetableView key={t._id} timetable={t} />)
      )}
    </div>
  );
};

export default TimetableList;
