'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  students: number;
  isActive: boolean;
}

interface UserPermissions {
  role: string;
  userId?: string;
}

export default function TeacherAttendancePage() {
  const params = useParams();
  const router = useRouter();
  const schoolID = params.schoolID as string;
  const userID = params.userID as string;
  
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alert, setAlert] = useState<{message: string, type: string} | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermissions>({role: ''});

  const API_BASE = process.env.NEXT_PUBLIC_API_URL;

  // Check if user is teacher
  const isTeacher = () => {
    return userPermissions.role === 'teacher';
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

  // Fetch teacher's sections
  const fetchTeacherSections = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE}/api/sections/teacher/${userPermissions.userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch sections');
      }
      
      const result = await response.json();
      
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

  useEffect(() => {
    fetchUserPermissions();
  }, []);

  useEffect(() => {
    if (userPermissions.role && isTeacher()) {
      fetchTeacherSections();
    } else if (userPermissions.role && !isTeacher()) {
      setAlert({ message: 'You do not have permission to view this page', type: 'error' });
      setIsLoading(false);
    }
  }, [userPermissions.role, userPermissions.userId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isTeacher()) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-8">
              <div className="text-red-600 text-xl font-semibold mb-2">Access Denied</div>
              <p className="text-gray-600 mb-4">
                This page is only accessible to teachers.
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
            <h1 className="text-3xl font-bold text-indigo-600">My Teaching Sections</h1>
            <p className="text-gray-600">Manage attendance for your assigned sections</p>
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

        {/* Sections List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {sections.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full table-auto">
                <thead>
                  <tr className="bg-indigo-100 text-indigo-600">
                    <th className="p-4 text-left">Section Code</th>
                    <th className="p-4 text-left">Section Name</th>
                    <th className="p-4 text-left">Students</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((section) => (
                    <tr key={section._id} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="p-4 font-mono">{section.sectionCode}</td>
                      <td className="p-4 font-medium">{section.name}</td>
                      <td className="p-4">{section.students} students</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs ${
                          section.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {section.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/${schoolID}/${userID}/dashboard/attendance/${section._id}`}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                        >
                          Manage Attendance
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-500 text-lg mb-2">
                You are not assigned to any sections yet
              </div>
              <p className="text-gray-400">
                Please contact your administrator to be assigned to teaching sections.
              </p>
            </div>
          )}
        </div>

        {/* Statistics Summary */}
        {sections.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600">{sections.length}</div>
              <div className="text-sm text-gray-600">Total Sections</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {sections.filter(s => s.isActive).length}
              </div>
              <div className="text-sm text-gray-600">Active Sections</div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {sections.reduce((total, section) => total + section.students, 0)}
              </div>
              <div className="text-sm text-gray-600">Total Students</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}