'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../../../../../context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

const TimetableEdit = () => {
  const { user, schoolId, permissions } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sectionNameParam = params.sectionname;
  
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [days, setDays] = useState(5);
  const [periodsPerDay, setPeriodsPerDay] = useState(8);
  const [timetable, setTimetable] = useState(null);
  const [courses, setCourses] = useState([]);
  const [sectionCourses, setSectionCourses] = useState([]); // Courses for selected section
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState({ dayIndex: null, periodIndex: null });
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Check if user has admin or student_affairs permissions
  const hasAccess = user?.role === 'admin' || permissions?.includes('student_affairs') || permissions?.includes('course-management');

  useEffect(() => {
    if (!user) return;
    
    if (!hasAccess) {
      toast.error('Access denied. Admin or Student Affairs privileges required.');
      router.push(`/${schoolId}/${user.userId}/dashboard`);
      return;
    }
    
    fetchSections();
  }, [user, schoolId, hasAccess]);

  useEffect(() => {
    if (sectionNameParam && sections.length > 0) {
      const decodedSectionName = decodeURIComponent(sectionNameParam);
      console.log('Looking for section:', decodedSectionName);
      
      const section = sections.find(s => 
        s.name.toLowerCase() === decodedSectionName.toLowerCase()
      );
      
      if (section) {
        setSelectedSection(section);
        checkTimetableExists(section._id);
      } else {
        console.error(`Section "${decodedSectionName}" not found`);
        toast.error(`Section "${decodedSectionName}" not found`);
        setLoading(false);
      }
    }
  }, [sectionNameParam, sections]);

  // Fetch courses for the selected section when it changes
  useEffect(() => {
    if (selectedSection) {
      fetchSectionCourses(selectedSection._id);
    }
  }, [selectedSection]);

  const fetchSections = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSections(data.data || []);
      } else {
        toast.error('Failed to fetch sections');
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
      toast.error('Error fetching sections');
    }
  };

  // Fetch courses specifically for the selected section
  const fetchSectionCourses = async (sectionId) => {
    try {
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
        setSectionCourses(data.data || []);
      } else {
        console.error('Failed to fetch section courses');
        setSectionCourses([]);
      }
    } catch (error) {
      console.error('Error fetching section courses:', error);
      setSectionCourses([]);
    }
  };

  // Fetch teachers for the selected course
  const fetchTeachersForCourse = async (courseId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}/teachers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTeachers(data.data || []);
      } else {
        toast.error('Failed to fetch teachers for this course');
        setTeachers([]);
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
      toast.error('Error fetching teachers');
      setTeachers([]);
    }
  };

  const checkTimetableExists = async (sectionId) => {
    if (!sectionId) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/check/${sectionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.exists) {
        // Load the full timetable data
        await loadTimetable(sectionId);
        setEditMode(false);
      } else {
        setTimetable(null);
        setIsCreating(true);
        setEditMode(true);
      }
    } catch (error) {
      console.error('Error checking timetable:', error);
      toast.error('Error checking timetable');
    } finally {
      setLoading(false);
    }
  };

  const loadTimetable = async (sectionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/${sectionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTimetable(data.data);
        setDays(data.data.days);
        setPeriodsPerDay(data.data.periodsPerDay);
      }
    } catch (error) {
      console.error('Error loading timetable:', error);
      toast.error('Error loading timetable');
    }
  };

  const createTimetable = async () => {
    if (!selectedSection) {
      toast.error('Please select a section first');
      return;
    }
    
    if (days < 1 || days > 7) {
      toast.error('Days must be between 1 and 7');
      return;
    }
    
    if (periodsPerDay < 1 || periodsPerDay > 12) {
      toast.error('Periods per day must be between 1 and 12');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sectionId: selectedSection._id,
            days,
            periodsPerDay,
          }),
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTimetable(data.data);
        setIsCreating(false);
        setEditMode(false);
        toast.success(data.msg || 'Timetable created successfully');
      } else {
        toast.error(data.msg || 'Failed to create timetable');
      }
    } catch (error) {
      console.error('Error creating timetable:', error);
      toast.error('Error creating timetable');
    }
  };

  const updateTimetableStructure = async () => {
    if (!timetable || !selectedSection) {
      toast.error('No timetable to update');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/${timetable._id}/structure`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            days,
            periodsPerDay,
          }),
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTimetable(data.data);
        setEditMode(false);
        toast.success(data.msg || 'Timetable structure updated successfully');
      } else {
        toast.error(data.msg || 'Failed to update timetable structure');
      }
    } catch (error) {
      console.error('Error updating timetable structure:', error);
      toast.error('Error updating timetable structure');
    }
  };

  const openSlotModal = (dayIndex, periodIndex) => {
    setSelectedSlot({ dayIndex, periodIndex });
    
    const existingSlot = timetable?.schedule?.find(
      (s) => s.dayIndex === dayIndex && s.periodIndex === periodIndex
    );
    
    if (existingSlot) {
      setSelectedCourse(existingSlot.course?._id || existingSlot.course);
      setSelectedTeacher(existingSlot.teacher?._id || existingSlot.teacher);
      
      if (existingSlot.course) {
        fetchTeachersForCourse(existingSlot.course._id || existingSlot.course);
      }
    } else {
      setSelectedCourse('');
      setSelectedTeacher('');
      setTeachers([]);
    }
    
    setShowModal(true);
  };

  const handleCourseChange = (e) => {
    const courseId = e.target.value;
    setSelectedCourse(courseId);
    setSelectedTeacher('');
    
    if (courseId) {
      fetchTeachersForCourse(courseId);
    } else {
      setTeachers([]);
    }
  };

  const assignCourseToSlot = async () => {
    if (!selectedCourse || !selectedTeacher) {
      toast.error('Please select both a course and a teacher');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            timetableId: timetable._id,
            dayIndex: selectedSlot.dayIndex,
            periodIndex: selectedSlot.periodIndex,
            courseId: selectedCourse,
            teacherId: selectedTeacher,
          }),
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTimetable(data.data);
        setShowModal(false);
        toast.success(data.msg || 'Course assigned successfully');
      } else {
        toast.error(data.msg || 'Failed to assign course');
      }
    } catch (error) {
      console.error('Error assigning course:', error);
      toast.error('Error assigning course');
    }
  };

  const saveTimetable = () => {
    const totalSlots = days * periodsPerDay;
    const filledSlots = timetable?.schedule?.length || 0;
    
    if (filledSlots < totalSlots) {
      toast.error(`Please fill all ${totalSlots} slots before saving. Currently ${filledSlots}/${totalSlots} filled.`);
      return;
    }
    
    toast.success('Timetable saved successfully!');
    router.push(`/${schoolId}/${user.userId}/dashboard/timetable`);
  };

  const clearSlot = async (dayIndex, periodIndex) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/clear-slot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            timetableId: timetable._id,
            dayIndex,
            periodIndex,
          }),
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTimetable(data.data);
        toast.success(data.msg || 'Slot cleared successfully');
      } else {
        toast.error(data.msg || 'Failed to clear slot');
      }
    } catch (error) {
      console.error('Error clearing slot:', error);
      toast.error('Error clearing slot');
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Access Denied</h2>
          <p className="text-gray-500">You need admin or student affairs privileges to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading timetable...</p>
        </div>
      </div>
    );
  }

  if (!selectedSection) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Section Not Found</h2>
          <p className="text-gray-500">The requested section could not be found.</p>
          <Link 
            href={`/${schoolId}/${user.userId}/dashboard/timetable`}
            className="mt-4 inline-block bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            Back to Timetable List
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <Link 
          href={`/${schoolId}/${user.userId}/dashboard/timetable`}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">
          {timetable ? 'Edit' : 'Create'} Timetable - {selectedSection.name}
        </h1>
      </div>

      {/* Available Courses Info */}
      {selectedSection && sectionCourses.length > 0 && (
        <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-2">
            📚 Available Courses for {selectedSection.name}:
          </h3>
          <div className="flex flex-wrap gap-2">
            {sectionCourses.map(course => (
              <span key={course._id} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {course.name} {course.code && `(${course.code})`}
              </span>
            ))}
          </div>
          <p className="text-sm text-blue-600 mt-2">
            Only courses assigned to this section are available for timetable scheduling.
          </p>
        </div>
      )}

      {selectedSection && sectionCourses.length === 0 && (
        <div className="bg-yellow-50 p-4 rounded-lg mb-4 border border-yellow-200">
          <h3 className="font-semibold text-yellow-800 mb-2">
            ⚠️ No Courses Available
          </h3>
          <p className="text-yellow-700">
            No courses are currently assigned to {selectedSection.name}. 
            Please create courses for this section first.
          </p>
          <button
            className="mt-2 bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600 text-sm"
            onClick={() => router.push(`/${schoolId}/${user.userId}/dashboard/courses/create`)}
          >
            Create Courses
          </button>
        </div>
      )}
      
      {/* Timetable Configuration */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Timetable Configuration</h2>
          {timetable && (
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                editMode 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? 'Save Configuration' : 'Edit Configuration'}
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block mb-2 font-medium">Number of Days (1-7)</label>
            <input
              type="number"
              min="1"
              max="7"
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value) || 1)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!editMode && !!timetable}
            />
            <p className="text-sm text-gray-500 mt-1">Number of working days per week</p>
          </div>
          <div>
            <label className="block mb-2 font-medium">Periods Per Day (1-12)</label>
            <input
              type="number"
              min="1"
              max="12"
              value={periodsPerDay}
              onChange={(e) => setPeriodsPerDay(parseInt(e.target.value) || 1)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!editMode && !!timetable}
            />
            <p className="text-sm text-gray-500 mt-1">Number of periods per day</p>
          </div>
        </div>
        
        {editMode && timetable && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-yellow-800 font-medium">Structure Change Warning</p>
                <p className="text-yellow-700 text-sm mt-1">
                  Changing the timetable structure will clear all existing course assignments.
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {!timetable ? (
          <div className="flex space-x-3">
            <button
              className="bg-green-500 text-white px-6 py-3 rounded-md hover:bg-green-600 transition-colors font-medium"
              onClick={createTimetable}
            >
              Create Timetable Grid
            </button>
            <button
              className="bg-gray-500 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors"
              onClick={() => router.push(`/${schoolId}/${user.userId}/dashboard/timetable`)}
            >
              Cancel
            </button>
          </div>
        ) : editMode && (
          <div className="flex space-x-3">
            <button
              className="bg-green-500 text-white px-6 py-3 rounded-md hover:bg-green-600 transition-colors font-medium"
              onClick={updateTimetableStructure}
            >
              Update Structure
            </button>
            <button
              className="bg-gray-500 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors"
              onClick={() => {
                setEditMode(false);
                setDays(timetable.days);
                setPeriodsPerDay(timetable.periodsPerDay);
              }}
            >
              Cancel Changes
            </button>
          </div>
        )}
      </div>
      
      {/* Timetable Grid */}
      {timetable && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-semibold">
                Timetable Schedule - {selectedSection.name}
              </h2>
              <p className="text-gray-600 text-sm mt-1">
                Click on any slot to assign or modify courses
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
                onClick={() => {
                  setDays(timetable.days);
                  setPeriodsPerDay(timetable.periodsPerDay);
                }}
              >
                Reset View
              </button>
              <button
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors font-medium"
                onClick={saveTimetable}
              >
                Save Timetable
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-200">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-300 p-4 font-semibold text-gray-700 text-center min-w-[120px]">
                    Time / Day
                  </th>
                  {Array.from({ length: days }, (_, i) => (
                    <th key={i} className="border border-gray-300 p-4 font-semibold text-gray-700 text-center min-w-[150px]">
                      Day {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: periodsPerDay }, (_, periodIdx) => (
                  <tr key={periodIdx} className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-300 p-4 bg-gray-50 font-medium text-gray-700 text-center">
                      Period {periodIdx + 1}
                    </td>
                    {Array.from({ length: days }, (_, dayIdx) => {
                      const slot = timetable.schedule?.find(
                        (s) => s.dayIndex === dayIdx && s.periodIndex === periodIdx
                      );
                      
                      return (
                        <td
                          key={dayIdx}
                          className="border border-gray-300 p-4 min-w-[200px] hover:bg-gray-50 transition-colors relative group"
                        >
                          {slot ? (
                            <div className="relative">
                              <div 
                                className="cursor-pointer p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                                onClick={() => openSlotModal(dayIdx, periodIdx)}
                              >
                                <div className="font-semibold text-blue-800">
                                  {slot.course?.name || 'Unknown Course'}
                                </div>
                                <div className="text-sm text-blue-600 mt-1">
                                  {slot.teacher?.name || 'No Teacher'}
                                </div>
                                {slot.course?.code && (
                                  <div className="text-xs text-blue-500 mt-2 bg-blue-100 px-2 py-1 rounded">
                                    Code: {slot.course.code}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearSlot(dayIdx, periodIdx);
                                }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                                title="Clear slot"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              className="w-full h-full p-6 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 transition-all duration-200 flex flex-col items-center justify-center group-hover:border-gray-400"
                              onClick={() => openSlotModal(dayIdx, periodIdx)}
                            >
                              <svg className="w-8 h-8 mb-2 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span className="text-sm">Add Course</span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{timetable.schedule?.length || 0}</span> out of <span className="font-semibold">{days * periodsPerDay}</span> periods scheduled
                ({Math.round(((timetable.schedule?.length || 0) / (days * periodsPerDay)) * 100)}% complete)
              </div>
              
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-gray-600">Scheduled</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-200 rounded border border-gray-300"></div>
                  <span className="text-gray-600">Available</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Course Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                {selectedCourse ? 'Edit' : 'Assign'} Course
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
              <span className="font-medium">Slot:</span> Day {selectedSlot.dayIndex + 1}, Period {selectedSlot.periodIndex + 1}
            </div>
            
            <div className="mb-6">
              <label className="block mb-3 font-medium text-gray-700">Select Course</label>
              <select
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                value={selectedCourse}
                onChange={handleCourseChange}
              >
                <option value="">Choose a course...</option>
                {sectionCourses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.name} {course.code ? `(${course.code})` : ''}
                  </option>
                ))}
              </select>
              {sectionCourses.length === 0 && (
                <p className="text-sm text-yellow-600 mt-2">
                  No courses available for this section. Please create courses first.
                </p>
              )}
            </div>
            
            <div className="mb-6">
              <label className="block mb-3 font-medium text-gray-700">Select Teacher</label>
              <select
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
                value={selectedTeacher}
                onChange={(e) => setSelectedTeacher(e.target.value)}
                disabled={!selectedCourse || teachers.length === 0}
              >
                <option value="">
                  {!selectedCourse ? 'Select a course first' : teachers.length === 0 ? 'No teachers available for this course' : 'Choose a teacher...'}
                </option>
                {teachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))}
              </select>
              {selectedCourse && teachers.length === 0 && (
                <p className="text-sm text-red-500 mt-2">
                  No teachers assigned to this course. Please assign teachers to the course first.
                </p>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                onClick={assignCourseToSlot}
                disabled={!selectedCourse || !selectedTeacher}
              >
                {selectedCourse ? 'Update Assignment' : 'Assign Course'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableEdit;