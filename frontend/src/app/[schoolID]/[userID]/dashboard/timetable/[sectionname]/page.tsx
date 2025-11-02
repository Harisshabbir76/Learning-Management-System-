'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../../../../context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

const TimetableView = () => {
  const { user, schoolId, permissions } = useAuth();
  const router = useRouter();
  const params = useParams();
  const sectionNameParam = params.sectionname;
  
  const [selectedSection, setSelectedSection] = useState(null);
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sectionExists, setSectionExists] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Check if user has admin or student_affairs permissions
  const hasAccess = user?.role === 'admin' || permissions?.includes('student_affairs') || permissions?.includes('course-management');

  useEffect(() => {
    if (!user) return;
    
    if (!hasAccess) {
      toast.error('Access denied. Admin or Student Affairs privileges required.');
      router.push(`/${schoolId}/${user.userId}/dashboard`);
      return;
    }
    
    if (sectionNameParam) {
      fetchTimetable();
    }
  }, [sectionNameParam, user, hasAccess]);

  const fetchTimetable = async () => {
    if (!sectionNameParam) return;
    
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      const decodedSectionName = decodeURIComponent(sectionNameParam);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/section/${encodeURIComponent(decodedSectionName)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTimetable(data.data);
        setSelectedSection(data.data?.section || { name: decodedSectionName });
        setSectionExists(true);
        setError(null);
      } else if (response.status === 404 || !data.success) {
        await checkSectionExists(decodedSectionName);
        setTimetable(null);
      } else {
        setError(data.msg || 'Failed to fetch timetable');
        setTimetable(null);
      }
    } catch (error) {
      console.error('Error fetching timetable:', error);
      setError('Error fetching timetable');
      setTimetable(null);
    } finally {
      setLoading(false);
    }
  };

  const checkSectionExists = async (sectionName) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/check-section/${encodeURIComponent(sectionName)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setSectionExists(true);
        setError('No timetable found for this section. Would you like to create one?');
        setSelectedSection(data.data);
      } else {
        setSectionExists(false);
        setError('Section not found. Please check the section name.');
      }
    } catch (error) {
      console.error('Error checking section existence:', error);
      setSectionExists(false);
      setError('Error checking section existence');
    }
  };

  const createTimetable = async () => {
    if (!selectedSection) return;
    
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/timetable/create-by-name`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sectionName: selectedSection.name,
            days: 5,
            periodsPerDay: 8,
          }),
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setTimetable(data.data);
        setError(null);
        toast.success(data.msg || 'Timetable created successfully!');
      } else {
        setError(data.msg || 'Failed to create timetable');
        toast.error(data.msg || 'Failed to create timetable');
      }
    } catch (error) {
      console.error('Error creating timetable:', error);
      setError('Error creating timetable');
      toast.error('Error creating timetable');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get day name
  const getDayName = (dayIndex) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayIndex] || `Day ${dayIndex + 1}`;
  };

  // Get current period based on time (for highlighting)
  const getCurrentPeriod = () => {
    const day = currentTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const hour = currentTime.getHours();
    const minute = currentTime.getMinutes();
    
    // Adjust for Monday as day 0 in timetable
    const timetableDay = day === 0 ? 6 : day - 1; // Convert to 0-6 where 0=Monday
    
    // Simple period calculation (adjust based on your school schedule)
    const period = hour >= 8 && hour <= 16 ? hour - 7 : -1;
    
    return { day: timetableDay, period };
  };

  const currentPeriod = getCurrentPeriod();

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You need admin or student affairs privileges to access this page.</p>
          <button
            onClick={() => router.push(`/${schoolId}/${user.userId}/dashboard`)}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-all duration-200 transform hover:-translate-y-0.5 shadow-md"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 bg-blue-500 rounded-full animate-ping"></div>
            </div>
          </div>
          <p className="mt-6 text-gray-600 text-lg font-medium">Loading Timetable...</p>
          <p className="text-gray-400 text-sm mt-2">Fetching the latest schedule data</p>
        </div>
      </div>
    );
  }

  if (error || !timetable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center mb-8">
            <Link 
              href={`/${schoolId}/${user.userId}/dashboard/timetable`}
              className="group mr-4 text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center group-hover:shadow-md transition-shadow">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </div>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Timetable View</h1>
              <p className="text-gray-500">Manage and view class schedules</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-12 h-12 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              {sectionExists ? '📅 Timetable Not Found' : '🔍 Section Not Found'}
            </h2>
            
            <p className="text-gray-600 mb-8 text-lg max-w-md mx-auto leading-relaxed">
              {error}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href={`/${schoolId}/${user.userId}/dashboard/timetable`}
                className="inline-flex items-center justify-center bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:-translate-y-0.5 shadow-md"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                All Timetables
              </Link>
              
              {sectionExists && error?.includes('create') && (
                <button
                  onClick={createTimetable}
                  disabled={loading}
                  className="inline-flex items-center justify-center bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-lg hover:from-green-600 hover:to-green-700 disabled:from-green-300 disabled:to-green-400 transition-all duration-200 transform hover:-translate-y-0.5 shadow-md"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Create Timetable
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={fetchTimetable}
                disabled={loading}
                className="inline-flex items-center justify-center bg-gradient-to-r from-gray-500 to-gray-600 text-white px-6 py-3 rounded-lg hover:from-gray-600 hover:to-gray-700 disabled:from-gray-300 disabled:to-gray-400 transition-all duration-200 transform hover:-translate-y-0.5 shadow-md"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { days, periodsPerDay, schedule, section } = timetable;
  const filledSlots = schedule?.length || 0;
  const totalSlots = days * periodsPerDay;
  const completionPercentage = Math.round((filledSlots / totalSlots) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/60 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href={`/${schoolId}/${user.userId}/dashboard/timetable`}
                className="group flex items-center text-gray-600 hover:text-gray-900 transition-all duration-200"
              >
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center group-hover:shadow-md group-hover:bg-gray-50 transition-all">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </div>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  TimeTable of {section?.name || selectedSection?.name}
                </h1>
                
              </div>
            </div>
            
            
          </div>
        </div>
      </div>
      <br />
      <br />

      {/* Timetable Grid */}
      <div className="container mx-auto px-6 pb-8">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-blue-50">
                  <th className="p-6 font-semibold text-gray-700 text-left min-w-[140px] border-r border-gray-200/60">
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>Day / Period</span>
                    </div>
                  </th>
                  {Array.from({ length: periodsPerDay }, (_, i) => (
                    <th key={i} className="p-6 font-semibold text-gray-700 text-center min-w-[180px] border-r border-gray-200/60 last:border-r-0">
                      <div className="flex flex-col items-center">
                        <span className="text-lg">Period {i + 1}</span>
                        <span className="text-xs text-gray-400 font-normal mt-1">
                          {8 + i}:00 - {8 + i + 1}:00
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: days }, (_, dayIdx) => (
                  <tr key={dayIdx} className="group hover:bg-gray-50/50 transition-all duration-200">
                    <td className={`p-6 font-semibold text-gray-700 sticky left-0 bg-white border-r border-gray-200/60 group-hover:bg-gray-50/80 transition-colors ${
                      currentPeriod.day === dayIdx ? 'bg-blue-50 border-blue-200' : ''
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          currentPeriod.day === dayIdx ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'
                        }`}></div>
                        <div>
                          <div className="text-lg">{getDayName(dayIdx)}</div>
                          <div className="text-sm text-gray-400 font-normal">Day {dayIdx + 1}</div>
                        </div>
                      </div>
                    </td>
                    {Array.from({ length: periodsPerDay }, (_, periodIdx) => {
                      const slot = schedule?.find(
                        (s) => s.dayIndex === dayIdx && s.periodIndex === periodIdx
                      );
                      const isCurrentPeriod = currentPeriod.day === dayIdx && currentPeriod.period === periodIdx + 1;
                      
                      return (
                        <td
                          key={periodIdx}
                          className={`p-6 text-center border-r border-gray-200/60 last:border-r-0 transition-all duration-200 ${
                            isCurrentPeriod 
                              ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-inner' 
                              : 'hover:bg-gray-50/80'
                          }`}
                        >
                          {slot ? (
                            <div className="space-y-3">
                              <div className={`font-bold text-lg ${
                                isCurrentPeriod ? 'text-blue-700' : 'text-gray-800'
                              }`}>
                                {slot.course?.name || 'Unknown Course'}
                              </div>
                              <div className="text-sm text-gray-600 bg-white/80 rounded-lg py-1 px-2 border">
                                {slot.teacher?.name || 'No Teacher'}
                              </div>
                              {slot.course?.code && (
                                <div className="text-xs font-medium text-blue-600 bg-blue-50 rounded-full px-3 py-1 inline-block border border-blue-200">
                                  {slot.course.code}
                                </div>
                              )}
                              {isCurrentPeriod && (
                                <div className="flex items-center justify-center space-x-1 text-xs text-blue-600 font-medium">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                  <span>Current Period</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={`flex flex-col items-center justify-center h-full py-4 ${
                              isCurrentPeriod ? 'text-blue-400' : 'text-gray-400'
                            }`}>
                              <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sm italic">Free Period</span>
                              {isCurrentPeriod && (
                                <div className="flex items-center justify-center space-x-1 text-xs text-blue-600 font-medium mt-2">
                                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                  <span>Current</span>
                                </div>
                              )}
                            </div>
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

        
      </div>
    </div>
  );
};

export default TimetableView;