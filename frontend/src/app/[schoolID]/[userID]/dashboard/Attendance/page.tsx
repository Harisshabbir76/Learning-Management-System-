'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AdminFacultyAttendance from '../../../../../component/Admin_attendance';
import TeacherAttendance from '../../../../../component/teacher_attendance';
import StudentAttendance from '../../../../../component/student_attendance';

interface UserPermissions {
  role: string;
  permissions?: string[];
  userId?: string;
}

interface SectionData {
  _id: string;
  name: string;
  students: Array<{
    _id: string;
    name: string;
    email: string;
    userId: string;
  }>;
}

export default function UserManagementSystem() {
  const params = useParams();
  const schoolID = params.schoolID as string;
  const userID = params.userID as string;
  
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({role: ''});
  const [isLoading, setIsLoading] = useState(true);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [filteredSections, setFilteredSections] = useState<SectionData[]>([]);
  const [analytics, setAnalytics] = useState({
    totalSections: 0,
    totalStudents: 0,
    averageStudentsPerSection: 0
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

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

  // Fetch sections data
  const fetchSections = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/schools/${schoolID}/sections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const sectionsData = await response.json();
        setSections(sectionsData);
        
        // Filter out the specific student from each section
        const updatedSections = sectionsData.map((section: SectionData) => ({
          ...section,
          students: section.students.filter(student => 
            student.userId !== "1510" && 
            student.email !== "Haris.1510@gmail.com" &&
            student.name !== "Haris"
          )
        }));
        
        setFilteredSections(updatedSections);
        
        // Calculate analytics
        const totalStudents = updatedSections.reduce((total, section) => total + section.students.length, 0);
        const avgStudents = updatedSections.length > 0 ? totalStudents / updatedSections.length : 0;
        
        setAnalytics({
          totalSections: updatedSections.length,
          totalStudents: totalStudents,
          averageStudentsPerSection: Math.round(avgStudents * 100) / 100
        });
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await fetchUserPermissions();
      await fetchSections();
    };
    
    initializeData();
  }, []);

  // Check if user has section management permission
  const hasSectionManagementPermission = () => {
    return userPermissions.role === 'admin' || 
           (userPermissions.role === 'faculty' && userPermissions.permissions?.includes('student_affairs'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p className="text-indigo-700 font-medium">Loading your attendance portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-indigo-800 mb-2">Attendance Management System</h1>
          <p className="text-indigo-600">
            Welcome, {userPermissions.role.charAt(0).toUpperCase() + userPermissions.role.slice(1)}
          </p>
        </header>
        
        {/* Analytics Section - Moved to top and styled better */}
        {hasSectionManagementPermission() && filteredSections.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl shadow-xl overflow-hidden border border-indigo-100">
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Attendance Analytics</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm p-6 border border-indigo-100 text-center transition-all hover:shadow-md">
                  <div className="text-4xl font-bold text-indigo-700 mb-2">{analytics.totalSections}</div>
                  <div className="text-sm text-indigo-600 font-medium">Total Sections</div>
                  <div className="text-xs text-gray-500 mt-1">Across all classes</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm p-6 border border-indigo-100 text-center transition-all hover:shadow-md">
                  <div className="text-4xl font-bold text-indigo-700 mb-2">{analytics.totalStudents}</div>
                  <div className="text-sm text-indigo-600 font-medium">Total Students</div>
                  <div className="text-xs text-gray-500 mt-1">Enrolled in sections</div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm p-6 border border-indigo-100 text-center transition-all hover:shadow-md">
                  <div className="text-4xl font-bold text-indigo-700 mb-2">{analytics.averageStudentsPerSection}</div>
                  <div className="text-sm text-indigo-600 font-medium">Avg. per Section</div>
                  <div className="text-xs text-gray-500 mt-1">Students per class</div>
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-indigo-800 mb-4">Section Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSections.map((section) => (
                  <div key={section._id} className="bg-white rounded-xl shadow-sm p-4 border border-indigo-100 hover:shadow-md transition-all">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-indigo-700 text-lg">{section.name}</h3>
                      <span className="bg-indigo-100 text-indigo-800 text-xs font-medium px-2.5 py-1 rounded-full">
                        {section.students.length} students
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mb-3">
                      {section.students.length > 0 ? (
                        <div className="max-h-20 overflow-y-auto pr-2">
                          {section.students.map((s, index) => (
                            <div key={s._id} className="py-1 flex items-center">
                              <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs mr-2">
                                {index + 1}
                              </span>
                              <span>{s.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-400 italic">No students in this section</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 border-t pt-2 mt-2">
                      Section ID: {section._id.substring(0, 8)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {hasSectionManagementPermission() && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-indigo-100">
            <div className="bg-gradient-to-r from-indigo-700 to-purple-700 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Admin/Faculty Attendance Dashboard</h2>
            </div>
            <div className="p-6">
              <AdminFacultyAttendance 
                schoolID={schoolID} 
                userID={userPermissions.userId || userID} 
                sections={filteredSections}
              />
            </div>
          </div>
        )}
        
        {userPermissions.role === 'teacher' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-indigo-100">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Teacher Attendance Portal</h2>
            </div>
            <div className="p-6">
              <TeacherAttendance 
                schoolID={schoolID} 
                userID={userPermissions.userId || userID} 
              />
            </div>
          </div>
        )}
        
        {userPermissions.role === 'student' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-indigo-100">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Student Attendance Portal</h2>
            </div>
            <div className="p-6">
              <StudentAttendance 
                schoolID={schoolID} 
                userID={userPermissions.userId || userID} 
              />
            </div>
          </div>
        )}
        
        {!hasSectionManagementPermission() && 
         userPermissions.role !== 'teacher' && 
         userPermissions.role !== 'student' && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-indigo-100 max-w-2xl mx-auto">
            <div className="bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
              <h2 className="text-xl font-semibold text-white">Access Denied</h2>
            </div>
            <div className="p-8 text-center">
              <div className="mx-auto w-16 h-16 flex items-center justify-center bg-red-100 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Permission Required</h3>
              <p className="text-gray-600 mb-6">
                You do not have permission to access the attendance system. Please contact your administrator if you believe this is an error.
              </p>
              <button 
                onClick={() => window.history.back()}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}