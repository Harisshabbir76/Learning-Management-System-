'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../../../../context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

const TimetableManager = () => {
  const { user, schoolId, permissions } = useAuth();
  const router = useRouter();
  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState('');
  const [days, setDays] = useState(5);
  const [periodsPerDay, setPeriodsPerDay] = useState(8);
  const [timetable, setTimetable] = useState(null);
  const [courses, setCourses] = useState([]);
  const [sectionCourses, setSectionCourses] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState({ dayIndex: null, periodIndex: null });
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [teachers, setTeachers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExistingTimetableModal, setShowExistingTimetableModal] = useState(false);
  const [existingTimetable, setExistingTimetable] = useState(null);
  const [timetableWarning, setTimetableWarning] = useState({ show: false, message: '', timetable: null });
  const [teacherAvailability, setTeacherAvailability] = useState({ available: true, conflict: null });

  const hasAccess = user && (user.role === 'admin' || permissions.includes('student_affairs') || permissions.includes('course-management'));

  useEffect(() => {
    if (!user) return;
    
    if (!hasAccess) {
      toast.error('Access denied. Admin or Student Affairs privileges required.');
      router.push(`/${schoolId}/${user.userId}/dashboard`);
      return;
    }
    
    fetchSections();
    setIsLoading(false);
  }, [user, schoolId]);

  useEffect(() => {
    if (selectedSection) {
      fetchSectionCourses(selectedSection);
    } else {
      setSectionCourses([]);
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

  // New function to check teacher availability
  const checkTeacherAvailability = async (teacherId, dayIndex, periodIndex) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/check-teacher-availability`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            teacherId,
            dayIndex,
            periodIndex,
            sectionId: selectedSection,
            timetableId: timetable?._id // Include current timetable ID to exclude current assignment
          }),
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setTeacherAvailability({
          available: data.available,
          conflict: data.conflict
        });
        
        if (!data.available) {
          toast.error(`Teacher is already assigned to ${data.conflict?.section?.name} at this time`);
        }
        
        return data.available;
      } else {
        // If API fails, assume teacher is available
        setTeacherAvailability({ available: true, conflict: null });
        return true;
      }
    } catch (error) {
      console.error('Error checking teacher availability:', error);
      // If there's an error, assume teacher is available
      setTeacherAvailability({ available: true, conflict: null });
      return true;
    }
  };

  const checkTimetableExists = async () => {
    if (!selectedSection) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/check/${selectedSection}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.exists) {
          setExistingTimetable(data.data);
          setShowExistingTimetableModal(true);
          setIsCreating(false);
        } else {
          setIsCreating(true);
        }
      }
    } catch (error) {
      console.error('Error checking timetable:', error);
    }
  };

  const loadExistingTimetable = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/${selectedSection}`,
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
        setShowExistingTimetableModal(false);
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
            sectionId: selectedSection,
            days,
            periodsPerDay,
          }),
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        setTimetable(data.data);
        setIsCreating(false);
        toast.success(data.msg || 'Timetable created successfully');
      } else {
        if (response.status === 400 && data.data) {
          setExistingTimetable(data.data);
          setShowExistingTimetableModal(true);
        } else {
          toast.error(data.msg || 'Failed to create timetable');
        }
      }
    } catch (error) {
      console.error('Error creating timetable:', error);
      toast.error('Error creating timetable');
    }
  };

  const openSlotModal = (dayIndex, periodIndex) => {
    setSelectedSlot({ dayIndex, periodIndex });
    setTeacherAvailability({ available: true, conflict: null });
    
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
    setTeacherAvailability({ available: true, conflict: null });
    
    if (courseId) {
      fetchTeachersForCourse(courseId);
    } else {
      setTeachers([]);
    }
  };

  const handleTeacherChange = async (e) => {
    const teacherId = e.target.value;
    setSelectedTeacher(teacherId);
    
    if (teacherId && selectedSlot.dayIndex !== null && selectedSlot.periodIndex !== null) {
      await checkTeacherAvailability(teacherId, selectedSlot.dayIndex, selectedSlot.periodIndex);
    } else {
      setTeacherAvailability({ available: true, conflict: null });
    }
  };

  const assignCourseToSlot = async () => {
    if (!selectedCourse || !selectedTeacher) {
      toast.error('Please select both a course and a teacher');
      return;
    }
    
    // Check teacher availability before assigning
    const isAvailable = await checkTeacherAvailability(selectedTeacher, selectedSlot.dayIndex, selectedSlot.periodIndex);
    
    if (!isAvailable) {
      toast.error(`Cannot assign teacher: Already assigned to ${teacherAvailability.conflict?.section?.name} at this time`);
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
      
      if (response.ok) {
        setTimetable(data.data);
        setShowModal(false);
        setTeacherAvailability({ available: true, conflict: null });
        toast.success(data.msg || 'Course assigned successfully');
      } else {
        if (response.status === 409) {
          // Teacher conflict error from backend
          toast.error(data.msg || 'Teacher is already assigned to another section at this time');
        } else {
          toast.error(data.msg || 'Failed to assign course');
        }
      }
    } catch (error) {
      console.error('Error assigning course:', error);
      toast.error('Error assigning course');
    }
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
      
      if (response.ok) {
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

  const handleDaysChange = (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= 7) {
      setDays(value);
    }
  };

  const handlePeriodsChange = (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= 12) {
      setPeriodsPerDay(value);
    }
  };

  const handleViewExistingTimetable = () => {
    loadExistingTimetable();
  };

  const handleCreateNewAnyway = () => {
    setShowExistingTimetableModal(false);
    setIsCreating(true);
  };

  const handleCancelCreate = () => {
    setShowExistingTimetableModal(false);
    setSelectedSection('');
    setTimetable(null);
    setIsCreating(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Timetable Management</h1>
      
      {/* Section Selection */}
      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Section</h2>
        <select
          className="w-full p-2 border rounded-md"
          value={selectedSection}
          onChange={(e) => {
            setSelectedSection(e.target.value);
            setTimetable(null);
            setIsCreating(false);
            setSectionCourses([]);
          }}
        >
          <option value="">Select a section</option>
          {sections.map((section) => (
            <option key={section._id} value={section._id}>
              {section.name} - {section.grade}
            </option>
          ))}
        </select>
        
        {selectedSection && (
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
            onClick={checkTimetableExists}
          >
            {timetable ? 'View Timetable' : 'Check Timetable'}
          </button>
        )}
      </div>
      
      {/* Timetable Setup */}
      {!timetable && selectedSection && isCreating && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Timetable</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block mb-2">Number of Days (1-7)</label>
              <input
                type="number"
                min="1"
                max="7"
                value={days}
                onChange={handleDaysChange}
                className="w-full p-2 border rounded-md"
              />
              <p className="text-sm text-gray-500 mt-1">Minimum: 1 day, Maximum: 7 days</p>
            </div>
            <div>
              <label className="block mb-2">Periods Per Day (1-12)</label>
              <input
                type="number"
                min="1"
                max="12"
                value={periodsPerDay}
                onChange={handlePeriodsChange}
                className="w-full p-2 border rounded-md"
              />
              <p className="text-sm text-gray-500 mt-1">Minimum: 1 period, Maximum: 12 periods</p>
            </div>
          </div>
          <button
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
            onClick={createTimetable}
          >
            Create Timetable Grid
          </button>
        </div>
      )}
      
      {/* Timetable Grid */}
      {timetable && (
        <div className="bg-white p-4 rounded-lg shadow-md mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              Timetable for {timetable.section?.name || sections.find(s => s._id === selectedSection)?.name}
              <span className="text-sm text-gray-600 ml-2">
                ({days} days × {periodsPerDay} periods)
              </span>
            </h2>
            <div className="flex gap-2">
              <button
                className="bg-yellow-500 text-white px-4 py-2 rounded-md hover:bg-yellow-600"
                onClick={() => {
                  setTimetable(null);
                  setIsCreating(true);
                }}
              >
                Modify Structure
              </button>
              <button
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
                onClick={saveTimetable}
              >
                Save Timetable
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr>
                  <th className="border p-2 bg-gray-100 font-semibold">Time/Day</th>
                  {Array.from({ length: days }, (_, i) => (
                    <th key={i} className="border p-2 bg-gray-100 font-semibold">
                      Day {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: periodsPerDay }, (_, periodIdx) => (
                  <tr key={periodIdx}>
                    <td className="border p-2 bg-gray-100 font-medium text-center">
                      Period {periodIdx + 1}
                    </td>
                    {Array.from({ length: days }, (_, dayIdx) => {
                      const slot = timetable.schedule?.find(
                        (s) => s.dayIndex === dayIdx && s.periodIndex === periodIdx
                      );
                      
                      return (
                        <td
                          key={dayIdx}
                          className="border p-2 min-w-[200px] hover:bg-gray-50 transition-colors"
                        >
                          {slot ? (
                            <div className="relative group">
                              <div 
                                className="cursor-pointer p-2 rounded bg-blue-50 border border-blue-200"
                                onClick={() => openSlotModal(dayIdx, periodIdx)}
                              >
                                <div className="font-semibold text-blue-800">
                                  {slot.course?.name || 'Loading...'}
                                </div>
                                <div className="text-sm text-blue-600">
                                  {slot.teacher?.name || 'Teacher'}
                                </div>
                                {slot.course?.code && (
                                  <div className="text-xs text-blue-500 mt-1">
                                    Code: {slot.course.code}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearSlot(dayIdx, periodIdx);
                                }}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                title="Clear slot"
                              >
                                ×
                              </button>
                            </div>
                          ) : (
                            <button
                              className="w-full h-full p-4 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded border-2 border-dashed border-gray-300 transition-colors flex items-center justify-center"
                              onClick={() => openSlotModal(dayIdx, periodIdx)}
                            >
                              + Add Course
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
        </div>
      )}
      
      {/* Existing Timetable Popup Modal */}
      {showExistingTimetableModal && existingTimetable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Timetable Already Exists</h2>
                <p className="text-gray-600 mt-1">
                  A timetable already exists for <strong>{existingTimetable.section?.name}</strong>
                </p>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
              <p className="text-yellow-800 text-sm">
                {existingTimetable.schedule?.length || 0} out of {existingTimetable.days * existingTimetable.periodsPerDay} slots are filled.
              </p>
            </div>
            
            <div className="flex flex-col space-y-3">
              <button
                className="w-full bg-blue-500 text-white px-4 py-3 rounded-md hover:bg-blue-600 transition-colors font-medium"
                onClick={handleViewExistingTimetable}
              >
                View Existing Timetable
              </button>
              
              <button
                className="w-full bg-yellow-500 text-white px-4 py-3 rounded-md hover:bg-yellow-600 transition-colors font-medium"
                onClick={handleCreateNewAnyway}
              >
                Create New Anyway (Replace)
              </button>
              
              <button
                className="w-full bg-gray-300 text-gray-700 px-4 py-3 rounded-md hover:bg-gray-400 transition-colors"
                onClick={handleCancelCreate}
              >
                Cancel
              </button>
            </div>
            
            <p className="text-xs text-gray-500 mt-4 text-center">
              Note: Creating a new timetable will replace the existing one.
            </p>
          </div>
        </div>
      )}
      
      {/* Course Assignment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {selectedCourse ? 'Edit' : 'Assign'} Course to Day {selectedSlot.dayIndex + 1}, Period {selectedSlot.periodIndex + 1}
            </h2>
            
            <div className="mb-4">
              <label className="block mb-2 font-medium">Select Course</label>
              <select
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={selectedCourse}
                onChange={handleCourseChange}
              >
                <option value="">Select a course</option>
                {sectionCourses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.name} {course.code ? `(${course.code})` : ''}
                  </option>
                ))}
              </select>
              {sectionCourses.length === 0 && (
                <p className="text-sm text-yellow-600 mt-1">
                  No courses available for this section. Please create courses first.
                </p>
              )}
            </div>
            
            <div className="mb-4">
              <label className="block mb-2 font-medium">Select Teacher</label>
              <select
                className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                value={selectedTeacher}
                onChange={handleTeacherChange}
                disabled={!selectedCourse || teachers.length === 0}
              >
                <option value="">
                  {!selectedCourse ? 'Select a course first' : teachers.length === 0 ? 'No teachers available for this course' : 'Select a teacher'}
                </option>
                {teachers.map((teacher) => (
                  <option key={teacher._id} value={teacher._id}>
                    {teacher.name} ({teacher.email})
                  </option>
                ))}
              </select>
              {selectedCourse && teachers.length === 0 && (
                <p className="text-sm text-red-500 mt-1">
                  No teachers assigned to this course. Please assign teachers to the course first.
                </p>
              )}
            </div>

            {/* Teacher Availability Status */}
            {selectedTeacher && (
              <div className={`p-3 rounded-md mb-4 ${
                teacherAvailability.available 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center">
                  {teacherAvailability.available ? (
                    <>
                      <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-green-700 font-medium">Teacher is available at this time</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <div>
                        <span className="text-red-700 font-medium">Teacher is not available</span>
                        {teacherAvailability.conflict && (
                          <p className="text-red-600 text-sm mt-1">
                            Already assigned to <strong>{teacherAvailability.conflict.section?.name}</strong> at this time
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <button
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                onClick={assignCourseToSlot}
                disabled={!selectedCourse || !selectedTeacher || !teacherAvailability.available}
              >
                {selectedCourse ? 'Update' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableManager;