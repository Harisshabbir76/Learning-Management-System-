'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

interface User {
  _id: string;
  name: string;
  userId: number;
  email?: string;
  role: string;
  school?: string | { _id: string; name: string; fullName?: string };
  permissions?: string[];
}

interface School {
  _id: string;
  name: string;
  fullName?: string;
}

interface Teacher {
  _id: string;
  name: string;
  userId: number;
  email?: string;
  role: string;
}

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
}

interface CourseFormData {
  name: string;
  description: string;
  teacherIds: string[];
  sectionId: string;
  isActive?: boolean;
}

export default function CreateCourse() {
  const router = useRouter();
  const pathname = usePathname();
  const pathSegments = pathname.split('/');
  const schoolId = pathSegments[1];
  const userID = pathSegments[2];

  const [form, setForm] = useState<CourseFormData>({ 
    name: '', 
    description: '', 
    teacherIds: [],
    sectionId: '',
    isActive: true
  });
  const [loading, setLoading] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [school, setSchool] = useState<School | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([]);

  // Check if user has course management permissions based on role model
  const canManageCourses = (user: User | null) => {
    if (!user) return false;
    
    // Admin users always have access
    if (user.role === 'admin') return true;
    
    // Faculty users need student_affairs permission
    if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) return true;
    
    // Teachers need manage_courses permission
    if (user.role === 'teacher' && user.permissions?.includes('manage_courses')) return true;
    
    return false;
  };

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setPageLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Fetch user data first to check role and permissions
        const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!userRes.ok) throw new Error('Failed to fetch user data');

        const userData = await userRes.json();
        const user = userData.user || userData.data;
        setCurrentUser(user);

        // Check if user has course management permission based on their role model
        if (!canManageCourses(user)) {
          setUnauthorized(true);
          setPageLoading(false);
          return;
        }

        const rawSchool = user?.school || userData.data?.school;
        const userSchoolId = typeof rawSchool === 'string'
          ? rawSchool
          : rawSchool?._id || rawSchool?.id;

        if (!userSchoolId) throw new Error('Invalid school ID');

        // Fetch school details
        const schoolRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/schools/${userSchoolId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!schoolRes.ok) throw new Error('School not found');
        const schoolData = await schoolRes.json();
        setSchool(schoolData.data || schoolData);

        // Fetch sections for the dropdown
        const sectionsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/sections`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (sectionsRes.ok) {
          const sectionsData = await sectionsRes.json();
          setSections(sectionsData.data || []);
        }

        // Fetch teachers for the dropdown
        const teachersRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users?role=teacher`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (teachersRes.ok) {
          const teachersData = await teachersRes.json();
          setTeachers(teachersData.data || []);
          setFilteredTeachers(teachersData.data || []);
        }

      } catch (error) {
        console.error('Error:', error);
        setUnauthorized(true);
        toast.error(error instanceof Error ? error.message : 'Failed to load data');
      } finally {
        setPageLoading(false);
      }
    };

    checkAccess();
  }, [router]);

  // Filter teachers based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredTeachers(teachers);
    } else {
      const filtered = teachers.filter(teacher =>
        teacher.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        teacher.userId.toString().includes(searchTerm)
      );
      setFilteredTeachers(filtered);
    }
  }, [searchTerm, teachers]);

  // Add teacher to the form
  const addTeacher = (teacher: Teacher) => {
    if (form.teacherIds.includes(teacher._id)) {
      toast.error('This teacher is already added');
      return;
    }

    setForm(prev => ({
      ...prev,
      teacherIds: [...prev.teacherIds, teacher._id]
    }));

    setSearchTerm('');
    setIsDropdownOpen(false);
    toast.success(`Teacher ${teacher.name} added successfully`);
  };

  // Remove teacher from the list
  const removeTeacher = (teacherId: string) => {
    setForm(prev => ({
      ...prev,
      teacherIds: prev.teacherIds.filter(id => id !== teacherId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast.error('Course name is required');
      return;
    }

    if (form.teacherIds.length === 0) {
      toast.error('Please add at least one teacher');
      return;
    }

    if (!form.sectionId) {
      toast.error('Please select a section');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication token missing. Please log in again.');
        router.push('/login');
        return;
      }

      const courseData = {
        name: form.name.trim(),
        description: form.description.trim(),
        teacherIds: form.teacherIds,
        sectionId: form.sectionId,
        isActive: form.isActive
      };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(courseData),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Course created successfully');
        router.push(`/${schoolId}/${userID}/dashboard/courses`);
      } else {
        // Handle authentication errors specifically
        if (res.status === 401 || res.status === 403) {
          toast.error('Authentication failed. Please log in again.');
          localStorage.removeItem('token');
          router.push('/login');
        } else {
          throw new Error(data.message || data.error || 'Failed to create course');
        }
      }
    } catch (error: any) {
      console.error('Error creating course:', error);
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        toast.error('Network error. Please check your connection.');
      } else {
        toast.error(error.message || 'Failed to create course');
      }
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (unauthorized) {
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
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <p className="mt-1 text-sm text-red-700">
                {currentUser?.role === 'faculty' 
                  ? 'Faculty members require "student_affairs" permission to create courses.'
                  : currentUser?.role === 'teacher'
                  ? 'Teachers require "manage_courses" permission to create courses.'
                  : 'Administrator privileges are required to create courses.'
                }
              </p>
              <div className="mt-4">
                <Link
                  href={`/${currentUser?.school?._id || 'school'}/${currentUser?.userId || 'user'}/dashboard`}
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">Create Course</h1>
          {school && <p className="text-gray-600">{school.fullName || school.name}</p>}
          <p className="text-sm text-gray-500 mt-1">
            Logged in as: {currentUser?.name} ({currentUser?.role})
            {currentUser?.permissions && currentUser.permissions.length > 0 && 
              ` [Permissions: ${currentUser.permissions.join(', ')}]`}
          </p>
        </div>
        <Link
          href={`/${schoolId}/${userID}/dashboard/courses`}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Back to Courses
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Course Name */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Course Name *
            </label>
            <input
              placeholder="Enter course name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={100}
            />
          </div>
          
          {/* Course Description */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Description
            </label>
            <textarea
              placeholder="Enter course description (optional)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              maxLength={500}
            />
            <p className="text-sm text-gray-500 mt-1">
              {form.description.length}/500 characters
            </p>
          </div>

          {/* Section Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Select Section *
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={form.sectionId}
              onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
              required
            >
              <option value="">Select a section</option>
              {sections.map((section) => (
                <option key={section._id} value={section._id}>
                  {section.name} ({section.sectionCode})
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Choose which section this course belongs to
            </p>
          </div>
          
          {/* Active Status (Only for admin) */}
          {currentUser?.role === 'admin' && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                Course is active
              </label>
            </div>
          )}
          
          {/* Teacher Selection Dropdown */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Add Teachers *
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Search and select teachers from the dropdown
            </p>
            
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="Search teachers by name, email, or ID..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
              />
              
              {isDropdownOpen && filteredTeachers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredTeachers.map((teacher) => (
                    <div
                      key={teacher._id}
                      className="px-4 py-2 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                      onClick={() => addTeacher(teacher)}
                    >
                      <div className="font-medium text-gray-900">{teacher.name}</div>
                      <div className="text-sm text-gray-600">
                        ID: {teacher.userId} • {teacher.email}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {form.teacherIds.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Added Teachers:</p>
                {form.teacherIds.map(teacherId => {
                  const teacher = teachers.find(t => t._id === teacherId);
                  return (
                    <div
                      key={teacherId}
                      className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-blue-800">
                          {teacher ? teacher.name : 'Loading...'}
                        </p>
                        <p className="text-sm text-blue-600">
                          User ID: {teacher?.userId || 'N/A'}
                          {teacher?.email && ` • ${teacher.email}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeTeacher(teacherId)}
                        className="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-100 transition-colors"
                        title="Remove teacher"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-gray-500 text-sm">
                  No teachers added yet. Search and select teachers from the dropdown above.
                </p>
              </div>
            )}
          </div>
          
          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button 
              type="button"
              onClick={() => router.push(`/${schoolId}/${userID}/dashboard/courses`)}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading || !form.name.trim() || form.teacherIds.length === 0 || !form.sectionId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating...
                </span>
              ) : (
                'Create Course'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}