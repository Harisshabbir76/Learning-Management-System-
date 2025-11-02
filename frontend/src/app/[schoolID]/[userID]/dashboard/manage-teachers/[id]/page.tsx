'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Teacher {
  _id: string;
  name: string;
  userId: string;
  email: string;
  role: string;
  school: any;
  permissions?: string[];
  roleProfile?: TeacherProfile;
}

interface TeacherProfile {
  _id: string;
  user: string;
  courses: any[];
  salary: number;
  permissions: string[];
}

interface Course {
  _id: string;
  name: string;
  code: string;
  description?: string;
}

export default function TeacherDetail() {
  const router = useRouter();
  const params = useParams();
  
  // Extract userId from params
  const teacherUserId = params.userId as string || 
                       params.id as string || 
                       (params as any).teacherId as string;
  
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    userId: '',
    salary: '',
    permissions: [] as string[],
    courses: [] as string[]
  });
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check if teacherUserId is valid before proceeding
    if (!teacherUserId || teacherUserId === 'undefined') {
      setError('Invalid teacher ID');
      setLoading(false);
      return;
    }

    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    const fetchTeacherData = async () => {
      try {
        setLoading(true);
        
        // Fetch teacher by userId with role data included
        const teacherRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/user-id/${teacherUserId}?includeRoleData=true`, 
          {
            headers: { Authorization: `Bearer ${storedToken}` },
          }
        );
        
        if (!teacherRes.ok) {
          const errorData = await teacherRes.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch teacher data: ${teacherRes.status}`);
        }
        
        const teacherData = await teacherRes.json();
        
        // Debug: Check API response structure
        console.log('API Response:', teacherData);
        console.log('Salary value:', teacherData.data.roleProfile?.salary);
        console.log('Salary type:', typeof teacherData.data.roleProfile?.salary);
        
        if (!teacherData.success || !teacherData.data) {
          throw new Error('Teacher not found');
        }
        
        setTeacher(teacherData.data);
        
        // Debug: Check teacher data after setting
        console.log('Teacher data after set:', teacherData.data);
        console.log('Role profile structure:', teacherData.data.roleProfile);
        console.log('Role profile type:', typeof teacherData.data.roleProfile);
        if (teacherData.data.roleProfile) {
          console.log('Role profile keys:', Object.keys(teacherData.data.roleProfile));
        }
        
        // Set form data for editing
        setFormData({
          name: teacherData.data.name,
          email: teacherData.data.email,
          userId: teacherData.data.userId,
          salary: teacherData.data.roleProfile?.salary?.toString() || '',
          permissions: teacherData.data.roleProfile?.permissions || [],
          courses: teacherData.data.roleProfile?.courses || []
        });
        
        // If teacher has courses, fetch course details
        if (teacherData.data.roleProfile?.courses?.length > 0) {
          const courseIds = teacherData.data.roleProfile.courses;
          
          // Fetch all courses
          const coursesRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/courses?ids=${courseIds.join(',')}`, 
            {
              headers: { Authorization: `Bearer ${storedToken}` },
            }
          );
          
          if (coursesRes.ok) {
            const coursesData = await coursesRes.json();
            if (coursesData.success) {
              setCourses(coursesData.data);
            }
          }
        }
        
        // Fetch available permissions and courses for the form
        await fetchAvailablePermissions(storedToken);
        await fetchAvailableCourses(storedToken);
      } catch (err: any) {
        console.error('Error fetching teacher:', err);
        setError(err.message || 'Failed to load teacher data');
      } finally {
        setLoading(false);
      }
    };

    const fetchAvailablePermissions = async (token: string) => {
      try {
        // This would typically come from your API
        const permissions = [
          'student_affairs',
          'course_management',
          'attendance_tracking',
          'grade_management',
          'financial_operations'
        ];
        setAvailablePermissions(permissions);
      } catch (err) {
        console.error('Error fetching permissions:', err);
      }
    };

    const fetchAvailableCourses = async (token: string) => {
      try {
        const coursesRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/courses`, 
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json();
          if (coursesData.success) {
            setAvailableCourses(coursesData.data);
          }
        }
      } catch (err) {
        console.error('Error fetching courses:', err);
      }
    };

    fetchTeacherData();
  }, [router, teacherUserId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePermissionChange = (permission: string) => {
    setFormData(prev => {
      if (prev.permissions.includes(permission)) {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => p !== permission)
        };
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, permission]
        };
      }
    });
  };

  const handleCourseChange = (courseId: string) => {
    setFormData(prev => {
      if (prev.courses.includes(courseId)) {
        return {
          ...prev,
          courses: prev.courses.filter(id => id !== courseId)
        };
      } else {
        return {
          ...prev,
          courses: [...prev.courses, courseId]
        };
      }
    });
  };

  const handleSave = async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    try {
      setSaving(true);
      
      // Update the teacher data
      const updateRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/${teacher?._id}`, 
        {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${storedToken}` 
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            userId: formData.userId,
            salary: parseFloat(formData.salary as string),
            permissions: formData.permissions,
            courses: formData.courses
          })
        }
      );
      
      if (!updateRes.ok) {
        const errorData = await updateRes.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update teacher: ${updateRes.status}`);
      }
      
      const updateData = await updateRes.json();
      
      if (!updateData.success) {
        throw new Error(updateData.message || 'Failed to update teacher');
      }
      
      // Refresh the teacher data
      const teacherRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/user-id/${teacherUserId}?includeRoleData=true`, 
        {
          headers: { Authorization: `Bearer ${storedToken}` },
        }
      );
      
      if (teacherRes.ok) {
        const teacherData = await teacherRes.json();
        if (teacherData.success && teacherData.data) {
          setTeacher(teacherData.data);
        }
      }
      
      setIsEditing(false);
      setSaving(false);
      
    } catch (err: any) {
      console.error('Error updating teacher:', err);
      setError(err.message || 'Failed to update teacher data');
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    if (teacher) {
      setFormData({
        name: teacher.name,
        email: teacher.email,
        userId: teacher.userId,
        salary: teacher.roleProfile?.salary?.toString() || '',
        permissions: teacher.roleProfile?.permissions || [],
        courses: teacher.roleProfile?.courses || []
      });
    }
    setIsEditing(false);
  };

  // Format salary for display
  const renderSalary = () => {
    // Debug: Check what we actually have
    console.log('Teacher roleProfile:', teacher?.roleProfile);
    console.log('Salary value:', teacher?.roleProfile?.salary);
    
    const salaryValue = teacher?.roleProfile?.salary;
    
    // Check if salary exists and is a valid number
    if (salaryValue !== null && salaryValue !== undefined && !isNaN(Number(salaryValue))) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(Number(salaryValue));
    }
    
    return "Not specified";
  };

  // Get safe route parts for navigation
  const getSafeRouteParts = () => {
    if (typeof window === 'undefined') return { schoolSegment: '', userSegment: '' };
    
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const schoolSegment = pathParts[0] || '';
    const userSegment = pathParts[1] || '';
    return { schoolSegment, userSegment };
  };

  const handleBack = () => {
    const { schoolSegment, userSegment } = getSafeRouteParts();
    router.push(`/${schoolSegment}/${userSegment}/dashboard/manage-teachers`);
  };

  // Check for invalid teacher ID before rendering
  if (!teacherUserId || teacherUserId === 'undefined') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Invalid Teacher ID</h3>
              <p className="mt-1 text-sm text-red-700">
                The teacher ID could not be found in the URL. Please check the link or go back to the teachers list.
              </p>
              <div className="mt-4">
                <button
                  onClick={handleBack}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Back to Teachers List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4 text-gray-600">Loading teacher data...</p>
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
              <h3 className="text-sm font-medium text-red-800">Error Loading Teacher</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <div className="mt-4">
                <button
                  onClick={handleBack}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Back to Teachers List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400 mt-0.5" viewBox="0 0 20 20" fill="CurrentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Teacher Not Found</h3>
              <p className="mt-1 text-sm text-yellow-700">
                The teacher you're looking for doesn't exist or you don't have permission to view it.
              </p>
              <div className="mt-4">
                <button
                  onClick={handleBack}
                  className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 transition-colors"
                >
                  Back to Teachers List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { schoolSegment, userSegment } = getSafeRouteParts();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header with Edit Button at Top */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button
            onClick={handleBack}
            className="mr-4 p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold">Teacher Profile</h1>
        </div>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Teacher
          </button>
        )}
      </div>

      {isEditing ? (
        // EDIT FORM
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Personal Information</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                  <input
                    type="text"
                    name="userId"
                    value={formData.userId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <p className="py-2 capitalize text-gray-900">{teacher.role}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Employment Information</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
                  <input
                    type="number"
                    name="salary"
                    value={formData.salary}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Courses</label>
                  <p className="py-2 text-gray-900">{formData.courses.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Permissions</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availablePermissions.map((permission) => (
                  <div key={permission} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`permission-${permission}`}
                      checked={formData.permissions.includes(permission)}
                      onChange={() => handlePermissionChange(permission)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`permission-${permission}`} className="ml-2 block text-sm text-gray-700 capitalize">
                      {permission.replace('_', ' ')}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Assigned Courses</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableCourses.map((course) => (
                  <div key={course._id} className="flex items-center">
                    <input
                      type="checkbox"
                      id={`course-${course._id}`}
                      checked={formData.courses.includes(course._id)}
                      onChange={() => handleCourseChange(course._id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`course-${course._id}`} className="ml-2 block text-sm text-gray-700">
                      {course.code} - {course.name}
                    </label>
                  </div>
                ))}
              </div>
              {availableCourses.length === 0 && (
                <p className="text-gray-500">No courses available</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
              disabled={saving}
            >
              {saving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      ) : (
        // READ-ONLY VIEW
        <>
          <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Personal Information</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Full Name</label>
                  <p className="text-lg">{teacher.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">User ID</label>
                  <p className="text-lg">{teacher.userId}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Email Address</label>
                  <p className="text-lg">{teacher.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Role</label>
                  <p className="text-lg capitalize">{teacher.role}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
            <div className="px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Employment Information</h2>
            </div>
            <div className="px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Salary</label>
                  <p className="text-lg">
                    {renderSalary()}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Number of Courses</label>
                  <p className="text-lg">{teacher.roleProfile?.courses?.length || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {teacher.roleProfile?.permissions && teacher.roleProfile.permissions.length > 0 && (
            <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Permissions</h2>
              </div>
              <div className="px-6 py-4">
                <div className="flex flex-wrap gap-2">
                  {teacher.roleProfile.permissions.map((permission, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {courses.length > 0 && (
            <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Assigned Courses</h2>
              </div>
              <div className="px-6 py-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="p-3">Course Code</th>
                        <th className="p-3">Course Name</th>
                        <th className="p-3">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((course) => (
                        <tr key={course._id} className="border-t hover:bg-gray-50">
                          <td className="p-3">{course.code}</td>
                          <td className="p-3">{course.name}</td>
                          <td className="p-3">{course.description || 'No description'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {teacher.roleProfile?.courses?.length > 0 && courses.length === 0 && (
            <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
              <div className="px-6 py-4 border-b">
                <h2 className="text-xl font-semibold">Assigned Courses</h2>
              </div>
              <div className="px-6 py-4">
                <p className="text-gray-500">
                  This teacher is assigned to {teacher.roleProfile.courses.length} course(s), 
                  but detailed information is not available at the moment.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-4 mt-6">
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
            >
              Back to List
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Edit Teacher
            </button>
          </div>
        </>
      )}
    </div>
  );
}