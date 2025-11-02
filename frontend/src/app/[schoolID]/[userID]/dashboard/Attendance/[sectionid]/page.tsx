'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface User {
  _id: string;
  name: string;
  userId: number;
}

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  teacher: {
    _id: string;
    name: string;
    userId: number;
  };
  students: User[];
}

interface AttendanceRecord {
  _id?: string;
  student: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  date?: string;
  recordedBy?: {
    name: string;
  };
}

interface AttendanceData {
  sectionId: string;
  date: string;
  attendanceData: any[];
}

interface UserPermissions {
  role: string;
  permissions?: string[];
  userId?: string;
}

interface StudentAttendance {
  student: User;
  records: AttendanceRecord[];
  statistics: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  };
}

interface StudentStatistics {
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

export default function SectionAttendanceDetail() {
  const params = useParams();
  const router = useRouter();
  const schoolID = params.schoolID as string;
  const userID = params.userID as string;
  const sectionID = params.sectionid as string;
  
  const [section, setSection] = useState<Section | null>(null);
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [alert, setAlert] = useState<{message: string, type: string} | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({role: ''});
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  const [studentAttendance, setStudentAttendance] = useState<Record<string, StudentAttendance>>({});
  const [viewMode, setViewMode] = useState<'mark' | 'view'>('mark');
  const [dateRange, setDateRange] = useState<{start: string; end: string}>({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [sectionStatistics, setSectionStatistics] = useState<Record<string, StudentStatistics>>({});

  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  // Check if user has section management permission
  const hasSectionManagementPermission = () => {
    return userPermissions.role === 'admin' || 
           (userPermissions.role === 'faculty' && userPermissions.permissions?.includes('student_affairs'));
  };

  // Check if user is teacher
  const isTeacher = () => {
    return userPermissions.role === 'teacher';
  };

  // Check if user is student
  const isStudent = () => {
    return userPermissions.role === 'student';
  };

  // Check if user can edit attendance
  const canEditAttendance = () => {
    return isTeacher() || hasSectionManagementPermission();
  };

  // Ensure date is in range
  const ensureDateInRange = (date: string) => {
    const markedDate = new Date(date);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    
    if (markedDate < startDate || markedDate > endDate) {
      setDateRange({
        start: markedDate < startDate ? date : dateRange.start,
        end: markedDate > endDate ? date : dateRange.end
      });
    }
  };

  // Fetch current user role and permissions
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
          permissions: userData?.permissions || [],
          userId: userData?._id || userData?.userId
        });
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error);
    }
  };

  // Fetch section details
  const fetchSection = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/sections/${sectionID}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch section details');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        setSection(result.data);
        
        // Initialize attendance records if user can edit
        if (canEditAttendance()) {
          const records: AttendanceRecord[] = result.data.students.map((student: User) => ({
            student: student._id,
            status: 'present'
          }));
          setAttendanceRecords(records);
        }
      } else {
        throw new Error(result.message || 'Failed to fetch section details');
      }
    } catch (error) {
      console.error('Error fetching section:', error);
      setAlert({ message: 'Failed to load section details', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch attendance for the section on a specific date
  const fetchSectionAttendance = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/attendance/section/${sectionID}?date=${attendanceDate}`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          if (result.data.records && result.data.records.length > 0) {
            setAttendanceRecords(result.data.records);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching section attendance:', error);
    }
  };

  // Fetch student attendance details
  const fetchStudentAttendanceDetails = async (studentId: string) => {
    try {
      setIsLoadingStats(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/attendance/student/${studentId}/section/${sectionID}?startDate=${dateRange.start}&endDate=${dateRange.end}`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setStudentAttendance(prev => ({
            ...prev,
            [studentId]: result.data
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching student attendance details:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Fetch statistics for all students in the section
  const fetchAllStudentStatistics = async () => {
    try {
      setIsLoadingStats(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${API_BASE}/api/attendance/section/${sectionID}/statistics?startDate=${dateRange.start}&endDate=${dateRange.end}`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data && result.data.statistics) {
          const stats: Record<string, StudentStatistics> = {};
          result.data.statistics.forEach((stat: any) => {
            stats[stat.student._id] = {
              present: stat.present || 0,
              absent: stat.absent || 0,
              late: stat.late || 0,
              excused: stat.excused || 0,
              attendanceRate: stat.attendanceRate || 0
            };
          });
          setSectionStatistics(stats);
        }
      } else {
        console.error('Failed to fetch section statistics');
        const emptyStats: Record<string, StudentStatistics> = {};
        section?.students.forEach(student => {
          emptyStats[student._id] = {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            attendanceRate: 0
          };
        });
        setSectionStatistics(emptyStats);
      }
    } catch (error) {
      console.error('Error fetching all student statistics:', error);
      const emptyStats: Record<string, StudentStatistics> = {};
      section?.students.forEach(student => {
        emptyStats[student._id] = {
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          attendanceRate: 0
        };
      });
      setSectionStatistics(emptyStats);
    } finally {
      setIsLoadingStats(false);
    }
  };

  // Toggle student details view
  const toggleStudentDetails = (studentId: string) => {
    setExpandedStudents(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
    
    if (!studentAttendance[studentId] && !expandedStudents[studentId]) {
      fetchStudentAttendanceDetails(studentId);
    }
  };

  // Mark attendance
  const markAttendance = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      // Format data for backend
      const formattedAttendanceData = attendanceRecords.map(record => ({
        studentId: record.student,
        status: record.status,
        notes: record.notes || ''
      }));
      
      const attendanceData = {
        sectionId: sectionID,
        date: attendanceDate,
        attendanceData: formattedAttendanceData
      };
      
      // Ensure the marked date is included in the view range
      ensureDateInRange(attendanceDate);
      
      const response = await fetch(`${API_BASE}/api/attendance/mark`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(attendanceData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAlert({ message: 'Attendance marked successfully', type: 'success' });
        
        // Refresh the statistics after marking attendance
        await fetchAllStudentStatistics();
        
        // Switch to view mode to see the updated records
        setViewMode('view');
      } else {
        throw new Error(result.message || 'Failed to mark attendance');
      }
    } catch (error) {
      console.error('Error marking attendance:', error);
      setAlert({ message: 'Failed to mark attendance', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Update attendance status
  const updateAttendanceStatus = (studentId: string, status: AttendanceRecord['status']) => {
    setAttendanceRecords(prev => 
      prev.map(record => 
        record.student === studentId ? { ...record, status } : record
      )
    );
  };

  // Update attendance notes
  const updateAttendanceNotes = (studentId: string, notes: string) => {
    setAttendanceRecords(prev => 
      prev.map(record => 
        record.student === studentId ? { ...record, notes } : record
      )
    );
  };

  // Handle date change - fetch attendance for the new date
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setAttendanceDate(newDate);
    
    // If section is loaded and user can edit, fetch attendance for the new date
    if (section && canEditAttendance()) {
      fetchSectionAttendanceForDate(newDate);
    }
  };

  // Fetch attendance for specific date
  const fetchSectionAttendanceForDate = async (date: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/attendance/section/${sectionID}?date=${date}`, 
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // If attendance exists for this date, load it
          if (result.data.records && result.data.records.length > 0) {
            setAttendanceRecords(result.data.records);
          } else {
            // If no attendance exists, reset to default (present)
            const defaultRecords: AttendanceRecord[] = section!.students.map((student: User) => ({
              student: student._id,
              status: 'present'
            }));
            setAttendanceRecords(defaultRecords);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching section attendance:', error);
    }
  };

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  useEffect(() => {
    if (userPermissions.role && sectionID) {
      fetchSection();
    }
  }, [userPermissions.role, sectionID]);

  useEffect(() => {
    if (section && canEditAttendance()) {
      fetchSectionAttendanceForDate(attendanceDate);
    }
  }, [attendanceDate, section]);

  useEffect(() => {
    if (viewMode === 'view' && section) {
      fetchAllStudentStatistics();
    }
  }, [viewMode, dateRange, section, attendanceDate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-8 text-gray-500">
              Section not found or you don't have access to view it.
            </div>
            <div className="flex justify-center">
              <Link 
                href={`/${schoolID}/${userID}/dashboard/attendance`}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Back to Attendance
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link 
              href={`/${schoolID}/${userID}/dashboard/Attendance`}
              className="text-indigo-600 hover:text-indigo-800 font-medium mb-2 inline-block"
            >
              ← Back to Attendance
            </Link>
            <h1 className="text-3xl font-bold text-indigo-600">
              {section.name} - {section.sectionCode}
            </h1>
            <p className="text-gray-600">
              Teacher: {section.teacher.name} | Students: {section.students.length}
            </p>
          </div>
          
          {canEditAttendance() && (
            <div className="flex gap-2">
              <button
                className={`px-4 py-2 rounded-md ${
                  viewMode === 'mark' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white text-indigo-600 border border-indigo-600'
                }`}
                onClick={() => setViewMode('mark')}
              >
                Mark Attendance
              </button>
              <button
                className={`px-4 py-2 rounded-md ${
                  viewMode === 'view' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-white text-indigo-600 border border-indigo-600'
                }`}
                onClick={() => setViewMode('view')}
              >
                View Records
              </button>
            </div>
          )}
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

        {/* Mark Attendance View */}
        {canEditAttendance() && viewMode === 'mark' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Mark Attendance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input 
                  type="date" 
                  className="w-full p-2 border border-gray-300 rounded-md"
                  value={attendanceDate}
                  onChange={handleDateChange}
                />
              </div>
              <div className="flex items-end">
                <button
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  onClick={() => fetchSectionAttendanceForDate(attendanceDate)}
                >
                  Load Attendance
                </button>
              </div>
            </div>
            
            {attendanceRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full table-auto">
                  <thead>
                    <tr className="bg-indigo-100 text-indigo-600">
                      <th className="p-3 text-left">Student ID</th>
                      <th className="p-3 text-left">Name</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Notes</th>
                      <th className="p-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((record) => {
                      const student = section.students.find(s => s._id === record.student);
                      return (
                        <React.Fragment key={record.student}>
                          <tr className="border-t border-gray-200 hover:bg-gray-50">
                            <td className="p-3 font-medium">{student?.userId || 'N/A'}</td>
                            <td className="p-3 font-medium">{student?.name || 'Unknown Student'}</td>
                            <td className="p-3">
                              <select 
                                className="p-2 border border-gray-300 rounded-md w-full"
                                value={record.status}
                                onChange={(e) => updateAttendanceStatus(record.student, e.target.value as AttendanceRecord['status'])}
                              >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="late">Late</option>
                                <option value="excused">Excused</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <input 
                                type="text" 
                                className="w-full p-2 border border-gray-300 rounded-md"
                                placeholder="Notes (optional)"
                                value={record.notes || ''}
                                onChange={(e) => updateAttendanceNotes(record.student, e.target.value)}
                              />
                            </td>
                            <td className="p-3">
                              <button 
                                className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 text-sm"
                                onClick={() => toggleStudentDetails(record.student)}
                              >
                                {expandedStudents[record.student] ? 'Hide' : 'History'}
                              </button>
                            </td>
                          </tr>
                          {expandedStudents[record.student] && studentAttendance[record.student] && (
                            <tr className="bg-gray-50">
                              <td colSpan={5} className="p-4">
                                <h4 className="font-medium mb-2 text-indigo-600">Attendance History for {student?.name}</h4>
                                <div className="mb-4 grid grid-cols-2 gap-4">
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
                                </div>
                                {studentAttendance[record.student].records.length > 0 ? (
                                  <>
                                    <div className="overflow-x-auto mb-4">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="bg-gray-100">
                                            <th className="p-2 text-left">Date</th>
                                            <th className="p-2 text-left">Status</th>
                                            <th className="p-2 text-left">Recorded By</th>
                                            <th className="p-2 text-left">Notes</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {studentAttendance[record.student].records.map((attendance: any) => (
                                            <tr key={attendance._id} className="border-b">
                                              <td className="p-2">{new Date(attendance.date).toLocaleDateString()}</td>
                                              <td className="p-2">
                                                <span className={`px-2 py-1 rounded-full text-xs ${
                                                  attendance.status === 'present' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : attendance.status === 'absent'
                                                    ? 'bg-red-100 text-red-800'
                                                    : attendance.status === 'late'
                                                    ? 'bg-yellow-100 text-yellow-800'
                                                    : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                  {attendance.status.toUpperCase()}
                                                </span>
                                              </td>
                                              <td className="p-2">{attendance.recordedBy?.name || 'System'}</td>
                                              <td className="p-2 text-sm text-gray-600">{attendance.notes || '-'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                      <div className="bg-green-50 p-3 rounded text-center border border-green-200">
                                        <div className="text-lg font-bold text-green-600">
                                          {studentAttendance[record.student].statistics.present}
                                        </div>
                                        <div className="text-xs text-green-800 font-medium">Present</div>
                                      </div>
                                      <div className="bg-red-50 p-3 rounded text-center border border-red-200">
                                        <div className="text-lg font-bold text-red-600">
                                          {studentAttendance[record.student].statistics.absent}
                                        </div>
                                        <div className="text-xs text-red-800 font-medium">Absent</div>
                                      </div>
                                      <div className="bg-yellow-50 p-3 rounded text-center border border-yellow-200">
                                        <div className="text-lg font-bold text-yellow-600">
                                          {studentAttendance[record.student].statistics.late}
                                        </div>
                                        <div className="text-xs text-yellow-800 font-medium">Late</div>
                                      </div>
                                      <div className="bg-blue-50 p-3 rounded text-center border border-blue-200">
                                        <div className="text-lg font-bold text-blue-600">
                                          {studentAttendance[record.student].statistics.excused}
                                        </div>
                                        <div className="text-xs text-blue-800 font-medium">Excused</div>
                                      </div>
                                      <div className="bg-indigo-50 p-3 rounded text-center border border-indigo-200">
                                        <div className="text-lg font-bold text-indigo-600">
                                          {studentAttendance[record.student].statistics.attendanceRate}%
                                        </div>
                                        <div className="text-xs text-indigo-800 font-medium">Rate</div>
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-center py-4 text-gray-500">
                                    No attendance records found for this period.
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No students found in this section.
              </div>
            )}
            
            <div className="mt-6 flex gap-4">
              <button 
                className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                onClick={markAttendance}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Submitting...
                  </span>
                ) : (
                  'Submit Attendance'
                )}
              </button>
              <button 
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                onClick={() => setViewMode('view')}
              >
                View Records
              </button>
            </div>
          </div>
        )}

        {/* View Records */}
        {(viewMode === 'view' || isStudent()) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Attendance Records</h2>
            
            {!isStudent() && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actions</label>
                  <button
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    onClick={fetchAllStudentStatistics}
                    disabled={isLoadingStats}
                  >
                    {isLoadingStats ? 'Refreshing...' : 'Refresh Data'}
                  </button>
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-indigo-100 text-indigo-600">
                    <th className="p-3 text-left">Student ID</th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Present</th>
                    <th className="p-3 text-left">Absent</th>
                    <th className="p-3 text-left">Late</th>
                    <th className="p-3 text-left">Excused</th>
                    <th className="p-3 text-left">Attendance Rate</th>
                    {!isStudent() && <th className="p-3 text-left">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {isLoadingStats ? (
                    <tr>
                      <td colSpan={isStudent() ? 7 : 8} className="p-4 text-center">
                        <div className="flex justify-center items-center">
                          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mr-2"></div>
                          Loading attendance data...
                        </div>
                      </td>
                    </tr>
                  ) : (
                    section.students.map((student) => {
                      const stats = sectionStatistics[student._id];
                      return (
                        <tr key={student._id} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="p-3 font-medium">{student.userId}</td>
                          <td className="p-3 font-medium">{student.name}</td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              stats && stats.present > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {stats ? stats.present : '0'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              stats && stats.absent > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {stats ? stats.absent : '0'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              stats && stats.late > 0 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {stats ? stats.late : '0'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              stats && stats.excused > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {stats ? stats.excused : '0'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              stats && stats.attendanceRate >= 80 
                                ? 'bg-green-100 text-green-800' 
                                : stats && stats.attendanceRate >= 60
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {stats ? `${stats.attendanceRate}%` : '0%'}
                            </span>
                          </td>
                          {!isStudent() && (
                            <td className="p-3">
                              <button 
                                className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200 text-sm"
                                onClick={() => toggleStudentDetails(student._id)}
                              >
                                {expandedStudents[student._id] ? 'Hide' : 'Details'}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}