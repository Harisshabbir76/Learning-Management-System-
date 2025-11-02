'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Student {
  _id: string;
  name: string;
  userId: string;
  email: string;
  role: string;
  school: any;
  sections?: Array<{
    _id: string;
    name: string;
    sectionCode: string;
    grade: string;
    capacity: number;
    isActive: boolean;
  }>;
  roleProfile?: {
    class?: {
      _id: string;
      name: string;
      sectionCode?: string;
      grade?: string;
    };
    fees: number;
  };
  createdAt: string;
}

interface LoggedInUser {
  _id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  school: any;
  permissions?: string[];
}

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  grade: string;
  capacity: number;
  isActive: boolean;
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { schoolID, userID, id: studentId } = params;
  
  const [student, setStudent] = useState<Student | null>(null);
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    sectionId: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Fetch logged-in user info
        const profileRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!profileRes.ok) throw new Error('Failed to fetch user profile');
        const profileData = await profileRes.json();
        setLoggedInUser(profileData.user);

        // Check if user has access
        if (!hasAccess(profileData.user)) {
          setError('Access denied. You need proper permissions to view student details.');
          setLoading(false);
          return;
        }

        // Fetch student details using the numeric student ID (userId)
        const studentRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/student_affairs/students/user-id/${studentId}`, 
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        if (!studentRes.ok) {
          if (studentRes.status === 404) {
            setError(`Student with ID ${studentId} not found`);
          } else {
            const errorData = await studentRes.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to fetch student details');
          }
          setLoading(false);
          return;
        }

        const studentData = await studentRes.json();
        if (studentData.success) {
          const student = studentData.data;
          setStudent(student);
          
          // Initialize form data
          setFormData({
            name: student.name,
            email: student.email,
            sectionId: student.sections?.[0]?._id || student.roleProfile?.class?._id || ''
          });

          // Fetch available sections
          await fetchAvailableSections(token);
        } else {
          throw new Error(studentData.message || 'Failed to fetch student details');
        }
      } catch (err: any) {
        console.error('Error:', err);
        setError(err.message || 'An error occurred while fetching student details');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router, schoolID, userID, studentId]);

  const fetchAvailableSections = async (token: string) => {
    try {
      const sectionsRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/sections`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (sectionsRes.ok) {
        const sectionsData = await sectionsRes.json();
        setAvailableSections(sectionsData.data || []);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
    }
  };

  // Check if user has access to view and edit student details
  const hasAccess = (user: LoggedInUser | null) => {
    if (!user) return false;
    
    // Admin, faculty with student_affairs permission can view and edit
    if (user.role === 'admin') return true;
    if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) return true;
    
    return false;
  };

  const canEdit = () => {
    return hasAccess(loggedInUser);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get student initials for avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // Get student class/section information
  const getStudentClass = (student: Student) => {
    // Check sections first
    if (student.sections && student.sections.length > 0) {
      const section = student.sections[0];
      if (section.name && section.sectionCode) {
        return `${section.name} (${section.sectionCode})`;
      } else if (section.name) {
        return section.name;
      } else if (section.sectionCode) {
        return section.sectionCode;
      }
    }

    // Check roleProfile class as fallback
    if (student.roleProfile?.class) {
      const classData = student.roleProfile.class;
      if (classData.name && classData.sectionCode) {
        return `${classData.name} (${classData.sectionCode})`;
      } else if (classData.name) {
        return classData.name;
      } else if (classData.sectionCode) {
        return classData.sectionCode;
      }
    }

    return 'Not assigned';
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset form data to original values
    if (student) {
      setFormData({
        name: student.name,
        email: student.email,
        sectionId: student.sections?.[0]?._id || student.roleProfile?.class?._id || ''
      });
    }
  };

  const handleSave = async () => {
    if (!student) return;
    
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/${student._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update student');
      }

      const result = await response.json();
      
      if (result.success) {
        // Update section if changed
        if (formData.sectionId !== (student.sections?.[0]?._id || student.roleProfile?.class?._id)) {
          await updateStudentSection(student._id, formData.sectionId, token!);
        } else {
          // Just update the student data
          setStudent(result.data);
          setIsEditing(false);
        }
      } else {
        throw new Error(result.message || 'Failed to update student');
      }
    } catch (err: any) {
      console.error('Error updating student:', err);
      setError(err.message || 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const updateStudentSection = async (studentId: string, sectionId: string, token: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/student_affairs/students/${studentId}/section`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sectionId: sectionId || null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update student section');
      }

      const result = await response.json();
      
      if (result.success) {
        setStudent(result.data);
        setIsEditing(false);
      } else {
        throw new Error(result.message || 'Failed to update student section');
      }
    } catch (err: any) {
      console.error('Error updating student section:', err);
      setError(err.message || 'Failed to update student section');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <div className="mt-4">
                <Link
                  href={`/${schoolID}/${userID}/dashboard/student-affairs`}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Back to Student List
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Student data not available.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with back button */}
        <div className="mb-6 flex justify-between items-center">
          <Link
            href={`/${schoolID}/${userID}/dashboard/student-affairs`}
            className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Student List
          </Link>
          
          {canEdit() && !isEditing && (
            <button
              onClick={handleEdit}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Student
            </button>
          )}
        </div>

        {/* Student Profile Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center mb-4 sm:mb-0">
              <div className="rounded-full bg-blue-100 h-16 w-16 flex items-center justify-center mr-4">
                <span className="text-blue-600 text-lg font-bold">
                  {getInitials(student.name)}
                </span>
              </div>
              <div>
                {isEditing ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="text-2xl font-bold text-gray-900 border border-gray-300 rounded-md px-3 py-2 w-full max-w-md"
                      placeholder="Student Name"
                    />
                    <p className="text-gray-600">Student ID: {student.userId}</p>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
                    <p className="text-gray-600">Student ID: {student.userId}</p>
                  </>
                )}
                <p className="text-gray-500 text-sm">Joined: {formatDate(student.createdAt)}</p>
              </div>
            </div>
            <div className="text-center sm:text-right">
              <p className="text-sm text-gray-500">Current Status</p>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                Active
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Personal Info */}
          <div className="space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 border-b pb-2">Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="text-gray-900 font-medium border border-gray-300 rounded-md px-3 py-2 w-full"
                      placeholder="Email Address"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{student.email}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Role</p>
                  <p className="text-gray-900 font-medium capitalize">{student.role}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">School</p>
                  <p className="text-gray-900 font-medium">{student.school?.name || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Class Information */}
          <div className="space-y-6">
            {/* Class Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 border-b pb-2">Class Information</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Class/Section</p>
                  {isEditing ? (
                    <select
                      name="sectionId"
                      value={formData.sectionId}
                      onChange={handleInputChange}
                      className="text-gray-900 font-medium border border-gray-300 rounded-md px-3 py-2 w-full"
                    >
                      <option value="">Select a section</option>
                      {availableSections.map((section) => (
                        <option key={section._id} value={section._id}>
                          {section.name} ({section.sectionCode}) - {section.grade}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-gray-900 font-medium">{getStudentClass(student)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Edit Actions */}
            {isEditing && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 border-b pb-2">Update Student</h2>
                <div className="flex space-x-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}