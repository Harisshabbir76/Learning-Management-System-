'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  teacher?: any;
  students: any[]; // Changed from number to array to handle actual student data
  isActive: boolean;
}

interface AdminFacultyAttendanceProps {
  schoolID: string;
  userID: string;
}

interface UserData {
  _id: string;
  userId?: string;
  name: string;
  role: string;
  permissions?: string[];
}

export default function AdminFacultyAttendance({ schoolID, userID }: AdminFacultyAttendanceProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState<{message: string, type: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  // Helper function to safely get teacher name
  const getTeacherName = (teacher: any): string => {
    if (!teacher) return 'Unassigned';
    if (typeof teacher === 'string') return teacher;
    if (typeof teacher === 'object' && teacher !== null) {
      return teacher.name || teacher.email || teacher.userId || 'Unassigned';
    }
    return 'Unassigned';
  };

  // Helper function to safely render any value as string
  const safeRender = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number') return value.toString();
    if (typeof value === 'object') {
      // Try to extract meaningful string representation
      if (value.name) return value.name;
      if (value.email) return value.email;
      if (value.userId) return value.userId;
      if (value._id) return value._id;
      return ''; // Return empty string instead of JSON to avoid [object Object]
    }
    return String(value);
  };

  // Helper function to count students (handles both array and number)
  const countStudents = (students: any): number => {
    if (Array.isArray(students)) return students.length;
    if (typeof students === 'number') return students;
    return 0;
  };

  // Fetch current user data to get numeric user ID
  const fetchCurrentUser = async () => {
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
        
        // Handle different response structures
        let userData;
        if (result.user) {
          userData = result.user;
        } else if (result.data) {
          userData = result.data;
        } else {
          userData = result;
        }
        
        setCurrentUser(userData);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  // Fetch all sections
  const fetchSections = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/sections`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sections');
      }
      
      const result = await response.json();
      
      console.log('Sections API response:', result); // Debug log
      
      if (result.success && result.data) {
        setSections(result.data);
      } else {
        throw new Error(result.message || 'Failed to fetch sections');
      }
    } catch (error) {
      console.error('Error fetching sections:', error);
      setAlert({ message: 'Failed to load sections', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to get user ID safely
  const getUserId = (): string => {
    if (currentUser) {
      return currentUser.userId || currentUser._id || userID;
    }
    return userID;
  };

  // Filter sections based on search term and active status
  const filteredSections = sections.filter(section => {
    const teacherName = getTeacherName(section.teacher);
    const matchesSearch = section.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         section.sectionCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         teacherName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesActive = filterActive === 'all' || 
                         (filterActive === 'active' && section.isActive) ||
                         (filterActive === 'inactive' && !section.isActive);
    
    return matchesSearch && matchesActive;
  });

  // Calculate total students across all sections
  const totalStudents = sections.reduce((total, section) => {
    return total + countStudents(section.students);
  }, 0);

  useEffect(() => {
    fetchCurrentUser();
    fetchSections();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link 
              href={`/${schoolID}/${getUserId()}/dashboard`}
              className="text-indigo-600 hover:text-indigo-800 font-medium mb-2 inline-flex items-center"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold text-indigo-800">Attendance Sections</h1>
            <p className="text-gray-600 mt-1">Manage and view attendance for all sections</p>
          </div>
        </div>
        
        {alert && (
          <div className={`p-4 rounded-md mb-6 flex justify-between items-center ${
            alert.type === 'error' 
              ? 'bg-red-100 text-red-700 border-l-4 border-red-500' 
              : 'bg-green-100 text-green-700 border-l-4 border-green-500'
          }`}>
            <div className="flex items-center">
              {alert.type === 'error' ? (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {alert.message}
            </div>
            <button 
              className="text-xl hover:text-gray-800"
              onClick={() => setAlert(null)}
            >
              &times;
            </button>
          </div>
        )}

        {/* Statistics Summary - Moved to top */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 text-center border border-indigo-100">
            <div className="text-2xl font-bold text-indigo-600">{sections.length}</div>
            <div className="text-sm text-gray-600">Total Sections</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center border border-green-100">
            <div className="text-2xl font-bold text-green-600">
              {sections.filter(s => s.isActive).length}
            </div>
            <div className="text-sm text-gray-600">Active Sections</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center border border-red-100">
            <div className="text-2xl font-bold text-red-600">
              {sections.filter(s => !s.isActive).length}
            </div>
            <div className="text-sm text-gray-600">Inactive Sections</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 text-center border border-blue-100">
            <div className="text-2xl font-bold text-blue-600">
              {totalStudents}
            </div>
            <div className="text-sm text-gray-600">Total Students</div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Sections</label>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Search by name, code, or teacher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status Filter</label>
              <select 
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
              >
                <option value="all">All Sections</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Filtered Results</label>
              <div className="p-2 bg-gray-50 rounded-md border border-gray-200">
                <span className="font-medium text-indigo-600">{filteredSections.length}</span> of <span className="font-medium">{sections.length}</span> sections
              </div>
            </div>
          </div>
        </div>

        {/* Sections List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          {filteredSections.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-indigo-50 text-indigo-700">
                    <th className="p-4 text-left font-semibold">Section Code</th>
                    <th className="p-4 text-left font-semibold">Section Name</th>
                    <th className="p-4 text-left font-semibold">Teacher</th>
                    <th className="p-4 text-left font-semibold">Students</th>
                    <th className="p-4 text-left font-semibold">Status</th>
                    <th className="p-4 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSections.map((section, index) => (
                    <tr key={section._id} className={`border-t border-gray-200 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-indigo-50 transition-colors`}>
                      <td className="p-4 font-mono text-sm text-gray-700">{safeRender(section.sectionCode)}</td>
                      <td className="p-4 font-medium text-gray-900">{safeRender(section.name)}</td>
                      <td className="p-4 text-gray-700">{safeRender(getTeacherName(section.teacher))}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {countStudents(section.students)} students
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          section.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {section.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/${schoolID}/${getUserId()}/dashboard/Attendance/${section._id}`}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                        >
                          View Attendance
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-gray-500 text-lg font-medium mb-2">
                {sections.length === 0 ? 'No sections found' : 'No sections match your search criteria'}
              </div>
              {sections.length === 0 && (
                <p className="text-gray-400 text-sm">
                  There are no sections available in the system yet.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}