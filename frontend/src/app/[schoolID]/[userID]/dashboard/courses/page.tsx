'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { FiEdit2, FiTrash2, FiPlus, FiEye, FiBook, FiUsers, FiUser, FiClock } from 'react-icons/fi';

interface Student {
  _id: string;
  name: string;
  email?: string;
  userId?: number;
}

interface Section {
  _id: string;
  name: string;
  sectionCode?: string;
  students?: Student[];
}

interface Teacher {
  _id: string;
  name: string;
  email?: string;
  userId?: number;
}

interface Course {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  teachers: (string | Teacher)[];
  students: (string | Student)[];
  school: string | { _id: string; name: string };
  section: string | Section;
  createdAt?: string;
  isActive?: boolean;
}

interface LoggedInUser {
  _id: string;
  name: string;
  userId: string;
  email: string;
  role: string;
  school: any;
  permissions?: string[];
}

interface ApiResponse {
  success: boolean;
  data?: Course[];
  message?: string;
}

export default function CoursesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [courses, setCourses] = useState<Course[]>([]);
  const [token, setToken] = useState<string>('');
  const [loggedInUser, setLoggedInUser] = useState<LoggedInUser | null>(null);
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }
    setToken(storedToken);

    const fetchData = async () => {
      try {
        setError('');
        // 1️⃣ Get logged-in user profile
        const profileRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        
        console.log('Profile response status:', profileRes.status);
        
        if (!profileRes.ok) {
          const errorText = await profileRes.text();
          throw new Error(`Failed to fetch user profile: ${profileRes.status} - ${errorText}`);
        }

        const profileData = await profileRes.json();
        console.log('Profile data:', profileData);
        
        if (!profileData.success) {
          throw new Error(profileData.message || 'Failed to fetch user profile');
        }
        
        setLoggedInUser(profileData.user);

        // 2️⃣ Check if user has permission to view courses
        const userRole = profileData.user?.role;
        const userPermissions = profileData.user?.permissions || [];
        
        // Allow admin, faculty, and teachers to view courses
        const allowedRoles = ['admin', 'faculty', 'teacher'];
        if (!allowedRoles.includes(userRole) && !userPermissions.includes('course_management')) {
          setUnauthorized(true);
          setLoading(false);
          return;
        }

        // 3️⃣ Fetch all courses with section and students populated
        console.log('Fetching courses from:', `${process.env.NEXT_PUBLIC_API_URL}/api/courses`);
        const coursesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses?populate=teachers&populate=students&populate=school&populate=section.students`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        
        console.log('Courses API response status:', coursesRes.status);
        
        if (!coursesRes.ok) {
          const errorText = await coursesRes.text();
          console.error('Courses API error response:', errorText);
          throw new Error(`Failed to fetch courses: ${coursesRes.status} - ${errorText}`);
        }

        const coursesData: ApiResponse = await coursesRes.json();
        console.log('Courses API success response:', coursesData);
        
        if (!coursesData.success) {
          throw new Error(coursesData.message || 'Failed to fetch courses');
        }

        // Filter courses by user's school
        const userSchoolId = typeof profileData.user.school === 'string' 
          ? profileData.user.school 
          : profileData.user.school?._id;
        
        const filteredCourses = (Array.isArray(coursesData.data) ? coursesData.data : [])
          .filter(course => {
            const courseSchoolId = typeof course.school === 'string' ? course.school : course.school?._id;
            return courseSchoolId === userSchoolId;
          });

        setCourses(filteredCourses);
        
      } catch (err: any) {
        console.error('Detailed Error:', err);
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const getSafeRouteParts = () => {
    const parts = (pathname || '').split('/').filter(Boolean);
    const pathSchool = parts[0] || '';
    const pathUser = parts[1] || '';
    const userSchool: any = loggedInUser?.school;
    const schoolSegment = typeof userSchool === 'string' ? userSchool : (userSchool?._id || userSchool?.id || pathSchool);
    const userIdSegment = loggedInUser?.userId || pathUser;
    return { schoolSegment, userIdSegment };
  };

  const handleCreate = () => {
    const { schoolSegment, userIdSegment } = getSafeRouteParts();
    if (!schoolSegment || !userIdSegment) return;
    router.push(`/${schoolSegment}/${userIdSegment}/dashboard/courses/create`);
  };

  const confirmDelete = (course: Course) => {
    setDeletingCourse(course);
  };

  const handleDeleteConfirmed = async () => {
    if (!deletingCourse || !token) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${deletingCourse._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Delete failed');
      }
      
      const result = await res.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Delete failed');
      }
      
      setCourses(courses.filter((c) => c._id !== deletingCourse._id));
      setDeletingCourse(null);
      alert('Course deleted successfully');
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    }
  };

  const canManageCourses = () => {
    const userRole = loggedInUser?.role;
    const userPermissions = loggedInUser?.permissions || [];
    return userRole === 'admin' || userPermissions.includes('course_management');
  };

  const canEditCourse = (course: Course) => {
    if (loggedInUser?.role === 'admin') return true;
    if (canManageCourses()) return true;
    
    // Teachers can only edit their own courses
    if (loggedInUser?.role === 'teacher') {
      const teacherIds = course.teachers.map(t => typeof t === 'string' ? t : t._id);
      return teacherIds.includes(loggedInUser._id);
    }
    
    return false;
  };

  const canDeleteCourse = (course: Course) => {
    // Only admins can delete courses
    return loggedInUser?.role === 'admin';
  };

  const getTeacherNames = (course: Course): string => {
    if (!course.teachers || course.teachers.length === 0) return 'Not assigned';
    return course.teachers.map((t) => {
      if (typeof t === 'object' && 'name' in t) return t.name;
      return 'Loading...';
    }).join(', ');
  };

  const getStudentCount = (course: Course): number => {
    // Check if section is populated and has students
    if (course.section && typeof course.section === 'object' && 'students' in course.section) {
      return Array.isArray(course.section.students) ? course.section.students.length : 0;
    }
    
    // Fallback to course.students if section is not populated
    return Array.isArray(course.students) ? course.students.length : 0;
  };

  const getSectionName = (course: Course): string => {
    if (!course.section) return 'No section';
    
    if (typeof course.section === 'object' && 'name' in course.section) {
      return course.section.name;
    }
    
    return 'Section not loaded';
  };

  const retryFetch = () => {
    setLoading(true);
    setError('');
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      // Re-fetch data
      const fetchData = async () => {
        try {
          const coursesRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses?populate=teachers&populate=students&populate=school&populate=section.students`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          
          if (coursesRes.ok) {
            const coursesData: ApiResponse = await coursesRes.json();
            if (coursesData.success) {
              setCourses(Array.isArray(coursesData.data) ? coursesData.data : []);
              setError('');
            }
          }
        } catch (err) {
          console.error('Retry failed:', err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
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
              <h3 className="text-sm font-medium text-red-800">Error Loading Courses</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <div className="mt-4 space-x-2">
                <button
                  onClick={retryFetch}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                <Link
                  href={`/${loggedInUser?.school?._id || 'school'}/${loggedInUser?.userId || 'user'}/dashboard`}
                  className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (unauthorized) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="CurrentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <p className="mt-1 text-sm text-red-700">
                Administrator, faculty, or teacher privileges are required to access this page.
              </p>
              <div className="mt-4">
                <Link
                  href={`/${loggedInUser?.school?._id || 'school'}/${loggedInUser?.userId || 'user'}/dashboard`}
                  className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Course Management</h1>
        {canManageCourses() && (
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <FiPlus size={18} />
            Create New Course
          </button>
        )}
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <h2 className="text-xl font-semibold p-4 border-b">All Courses</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-3">Course Name</th>
                <th className="p-3">Section</th>
                <th className="p-3">Teachers</th>
                <th className="p-3">Students</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.length > 0 ? (
                courses.map((course) => (
                  <tr key={course._id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-medium">{course.name}</div>
                      {course.description && (
                        <div className="text-sm text-gray-500 truncate max-w-xs">
                          {course.description}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="text-sm text-gray-600">
                        {getSectionName(course)}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-sm">
                        <FiUser className="text-blue-500" />
                        <span>{getTeacherNames(course)}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 text-sm">
                        <FiUsers className="text-green-500" />
                        <span>{getStudentCount(course)} students</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        course.isActive === false 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {course.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <Link
                        href={`/${loggedInUser?.school?._id || 'school'}/${loggedInUser?.userId || 'user'}/dashboard/courses/${course._id}`}
                        className="inline-flex items-center px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        <FiEye size={14} className="mr-1" />
                        View
                      </Link>
                      {canEditCourse(course) && (
                        <Link
                          href={`/${loggedInUser?.school?._id || 'school'}/${loggedInUser?.userId || 'user'}/dashboard/courses/${course._id}/edit`}
                          className="inline-flex items-center px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
                        >
                          <FiEdit2 size={14} className="mr-1" />
                          Edit
                        </Link>
                      )}
                      {canDeleteCourse(course) && (
                        <button
                          onClick={() => confirmDelete(course)}
                          className="inline-flex items-center px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        >
                          <FiTrash2 size={14} className="mr-1" />
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={6}>
                    <div className="flex flex-col items-center py-8">
                      <FiBook className="text-4xl text-gray-400 mb-4" />
                      <p className="text-lg font-medium">No courses found</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {canManageCourses() 
                          ? 'Get started by creating your first course.' 
                          : 'No courses have been created yet.'
                        }
                      </p>
                      {canManageCourses() && (
                        <button
                          onClick={handleCreate}
                          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Create First Course
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deletingCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-96">
            <h2 className="text-xl font-bold mb-4 text-red-600">Confirm Deletion</h2>
            <p className="mb-4">
              Are you sure you want to delete the course <strong>{deletingCourse.name}</strong>?
            </p>
            {deletingCourse.code && (
              <p className="mb-4 text-sm text-gray-600">Code: {deletingCourse.code}</p>
            )}
            <p className="mb-4 text-sm text-red-600">
              This action cannot be undone. All course data will be permanently deleted.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeletingCourse(null)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}