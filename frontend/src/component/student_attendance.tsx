'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  teacher: {
    name: string;
  };
}

interface AttendanceRecord {
  _id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  recordedBy: {
    name: string;
  };
}

interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

interface SectionAttendance {
  section: Section;
  records: AttendanceRecord[];
  statistics: AttendanceStats;
}

interface UserPermissions {
  role: string;
  userId?: string;
}

export default function StudentAttendancePage() {
  const params = useParams();
  const schoolID = params.schoolID as string;
  const userID = params.userID as string;
  
  const [attendanceData, setAttendanceData] = useState<SectionAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState<{message: string, type: string} | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({role: ''});
  const [dateRange, setDateRange] = useState<{start: string; end: string}>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  // Check if user is student
  const isStudent = () => {
    return userPermissions.role === 'student';
  };

  // Fetch current user role
  const fetchUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        const userData = result.user || result.data;
        setUserPermissions({
          role: userData?.role || '',
          userId: userData?._id || userData?.userId
        });
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  };

  // Fetch student's attendance
  const fetchStudentAttendance = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${API_BASE}/api/attendance/student/${userPermissions.userId}?startDate=${dateRange.start}&endDate=${dateRange.end}`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch attendance');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setAttendanceData(result.data.records || []);
      } else {
        throw new Error(result.message || 'Failed to fetch attendance');
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setAlert({ message: 'Failed to load attendance', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  useEffect(() => {
    if (userPermissions.role && isStudent() && userPermissions.userId) {
      fetchStudentAttendance();
    } else if (userPermissions.role && !isStudent()) {
      setAlert({ message: 'You do not have permission to view this page', type: 'error' });
      setIsLoading(false);
    }
  }, [userPermissions.role, userPermissions.userId, dateRange]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isStudent()) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-8">
              <div className="text-red-600 text-xl font-semibold mb-2">Access Denied</div>
              <p className="text-gray-600 mb-4">
                This page is only accessible to students.
              </p>
              <Link 
                href={`/${schoolID}/${userID}/dashboard`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 inline-block"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link 
              href={`/${schoolID}/${userID}/dashboard`}
              className="text-indigo-600 hover:text-indigo-800 font-medium mb-2 inline-block"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-indigo-600">My Attendance</h1>
            <p className="text-gray-600">View your attendance records across all sections</p>
          </div>
        </div>
        
        {alert && (
          <div className={`p-4 rounded-md mb-6 flex justify-between items-center ${
            alert.type === 'error' 
              ? 'bg-red-100 text-red-700 border-l-4 border-red-500' 
              : 'bg-green-100 text-green-700 border-l-4 border-green-500'
          }`}>
            <div>{alert.message}</div>
            <button 
              className="text-xl"
              onClick={() => setAlert(null)}
            >
              &times;
            </button>
          </div>
        )}

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Filter by Date Range</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input 
                type="date" 
                className="w-full p-2 border border-gray-300 rounded-md"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input 
                type="date" 
                className="w-full p-2 border border-gray-300 rounded-md"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Records</label>
              <div className="p-2 bg-gray-100 rounded-md">
                {attendanceData.reduce((total, sectionData) => total + sectionData.records.length, 0)} records
              </div>
            </div>
          </div>
        </div>

        {/* Attendance Records */}
        {attendanceData.length > 0 ? (
          <div className="space-y-6">
            {attendanceData.map((sectionData) => (
              <div key={sectionData.section._id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-indigo-600">
                      {sectionData.section.name} - {sectionData.section.sectionCode}
                    </h2>
                    <p className="text-gray-600">Teacher: {sectionData.section.teacher.name}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-indigo-600">
                      {sectionData.statistics.attendanceRate}%
                    </div>
                    <div className="text-sm text-gray-600">Attendance Rate</div>
                  </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
                  <div className="bg-green-50 p-3 rounded text-center">
                    <div className="text-lg font-bold text-green-600">
                      {sectionData.statistics.present}
                    </div>
                    <div className="text-xs text-green-800">Present</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded text-center">
                    <div className="text-lg font-bold text-red-600">
                      {sectionData.statistics.absent}
                    </div>
                    <div className="text-xs text-red-800">Absent</div>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded text-center">
                    <div className="text-lg font-bold text-yellow-600">
                      {sectionData.statistics.late}
                    </div>
                    <div className="text-xs text-yellow-800">Late</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded text-center">
                    <div className="text-lg font-bold text-blue-600">
                      {sectionData.statistics.excused}
                    </div>
                    <div className="text-xs text-blue-800">Excused</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded text-center">
                    <div className="text-lg font-bold text-gray-600">
                      {sectionData.records.length}
                    </div>
                    <div className="text-xs text-gray-800">Total</div>
                  </div>
                </div>

                {/* Attendance Records Table */}
                <div className="overflow-x-auto">
                  <table className="w-full table-auto">
                    <thead>
                      <tr className="bg-indigo-100 text-indigo-600">
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Status</th>
                        <th className="p-3 text-left">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectionData.records.map((record) => (
                        <tr key={record._id} className="border-t border-gray-200">
                          <td className="p-3">{new Date(record.date).toLocaleDateString()}</td>
                          <td className="p-3">
                            <span className={`px-3 py-1 rounded-full text-xs ${
                              record.status === 'present' 
                                ? 'bg-green-100 text-green-800' 
                                : record.status === 'absent'
                                ? 'bg-red-100 text-red-800'
                                : record.status === 'late'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {record.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3">{record.recordedBy.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="py-8">
              <div className="text-gray-500 text-lg mb-2">No attendance records found</div>
              <p className="text-gray-400">
                {dateRange.start === new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0] 
                  ? "You don't have any attendance records for the past 30 days."
                  : "You don't have any attendance records for the selected date range."
                }
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}