'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FiArrowLeft, FiX, FiUser, FiTrash2, FiBook } from 'react-icons/fi';
import toast from 'react-hot-toast';

interface Course {
  _id: string;
  name: string;
  description: string;
  code?: string;
  teachers: Array<{ _id: string; name: string; userId?: number } | string>;
  students: Array<{ _id: string; name: string; userId?: number } | string>;
  school: string | { _id: string; name: string };
  section: string | { _id: string; name: string; sectionCode?: string };
  createdBy?: string | { _id: string; name: string };
  createdAt?: string;
  isActive?: boolean;
}

interface Teacher {
  _id: string;
  name: string;
  userId: number;
  email?: string;
  role: string;
}

interface Student {
  _id: string;
  name: string;
  userId: number;
  email?: string;
  role: string;
  class?: string;
}

interface User {
  _id: string;
  name: string;
  userId: number;
  email?: string;
  role: string;
  school?: string | { _id: string; name: string };
  permissions?: string[];
}

interface School {
  _id: string;
  name: string;
  fullName?: string;
}

interface Section {
  _id: string;
  name: string;
  sectionCode?: string;
}

export default function EditCourse() {
  const { schoolId, userID, courseId } = useParams();
  const router = useRouter();

  const [form, setForm] = useState({
    name: '',
    description: '',
    code: '',
    teacherIds: [] as string[],
    sectionId: '',
    isActive: true,
  });

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [teacherInput, setTeacherInput] = useState('');
  const [teacherValidation, setTeacherValidation] = useState<{ [key: string]: Teacher | null }>({});

  // Check user permissions
  const canEditThisCourse = (courseTeachers: any[], user: User | null) => {
    if (!user) return false;
    
    // 1. Admin users have full access
    if (user.role === 'admin') {
      return true;
    }
    
    // 2. Faculty users need student_affairs permission
    if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) {
      return true;
    }
    
    // 3. Teachers can only edit their own courses
    if (user.role === 'teacher') {
      const teacherIds = courseTeachers.map(t => typeof t === 'string' ? t : t._id);
      return teacherIds.includes(user._id);
    }
    
    return false;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        // Fetch user data first
        const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!userRes.ok) throw new Error('Failed to fetch user profile');
        
        const userData = await userRes.json();
        const user = userData.user || userData.data;
        setCurrentUser(user);

        // Fetch course details
        const courseRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}?populate=teachers&populate=school&populate=section`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!courseRes.ok) {
          const err = await courseRes.json();
          throw new Error(err.message || err.error || 'Failed to fetch course');
        }

        const courseData = await courseRes.json();
        const course = courseData.data || courseData;

        // Check if user can edit this course
        if (!canEditThisCourse(course.teachers || [], user)) {
          setError('You do not have permission to edit this course');
          setLoading(false);
          return;
        }

        // Set school info
        const rawSchool = course.school || user.school;
        if (typeof rawSchool === 'string') {
          const schoolRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/schools/${rawSchool}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (schoolRes.ok) {
            const schoolData = await schoolRes.json();
            setSchool(schoolData.data || schoolData);
          }
        } else {
          setSchool(rawSchool);
        }

        // Fetch sections for the school
        const sectionsRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/sections?school=${rawSchool._id || rawSchool}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        if (sectionsRes.ok) {
          const sectionsData = await sectionsRes.json();
          setSections(sectionsData.data || sectionsData);
        }

        // Extract teacher IDs and info
        const teacherIds = (course.teachers || []).map((t: any) => 
          typeof t === 'string' ? t : t._id
        );

        // Fetch teacher details for display
        const teacherDetails: Teacher[] = [];
        for (const teacher of course.teachers || []) {
          if (typeof teacher === 'object') {
            teacherDetails.push(teacher);
          } else {
            const teacherRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/users/${teacher}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (teacherRes.ok) {
              const teacherData = await teacherRes.json();
              teacherDetails.push(teacherData.user || teacherData.data);
            }
          }
        }

        setTeachers(teacherDetails);

        // Set form data
        setForm({
          name: course.name || '',
          description: course.description || '',
          code: course.code || '',
          teacherIds: teacherIds,
          sectionId: typeof course.section === 'string' ? course.section : course.section?._id || '',
          isActive: course.isActive !== false,
        });

        // Set teacher validation data
        const validationMap: { [key: string]: Teacher | null } = {};
        teacherDetails.forEach(teacher => {
          validationMap[teacher._id] = teacher;
        });
        setTeacherValidation(validationMap);

      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load course');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) fetchData();
  }, [courseId, router]);

  // Validate and add teacher by numeric user ID
  const addTeacherById = async () => {
    const teacherId = teacherInput.trim();
    if (!teacherId) {
      toast.error('Please enter a teacher User ID');
      return;
    }

    if (form.teacherIds.includes(teacherId)) {
      toast.error('This teacher is already added');
      setTeacherInput('');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      
      // Fetch teacher by numeric user ID
      const teacherRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/user-id/${teacherId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!teacherRes.ok) {
        throw new Error('Teacher not found');
      }

      const teacherData = await teacherRes.json();
      const teacher = teacherData.user || teacherData.data;

      // Validate that the user is a teacher
      if (teacher.role !== 'teacher') {
        toast.error('User is not a teacher');
        return;
      }

      // Validate that the teacher belongs to the same school
      const teacherSchoolId = typeof teacher.school === 'string'
        ? teacher.school
        : teacher.school?._id;
      
      const currentUserSchoolId = typeof currentUser?.school === 'string'
        ? currentUser?.school
        : currentUser?.school?._id;

      if (teacherSchoolId !== currentUserSchoolId) {
        toast.error('Teacher does not belong to your school');
        return;
      }

      // Add teacher to the form
      setForm(prev => ({
        ...prev,
        teacherIds: [...prev.teacherIds, teacher._id]
      }));

      // Store teacher info for display
      setTeacherValidation(prev => ({
        ...prev,
        [teacher._id]: teacher
      }));

      // Add to teachers list for display
      setTeachers(prev => [...prev, teacher]);

      setTeacherInput('');
      toast.success(`Teacher ${teacher.name} added successfully`);

    } catch (error: any) {
      console.error('Error adding teacher:', error);
      toast.error(error.message || 'Failed to add teacher. Please check the User ID.');
    }
  };

  // Remove teacher from the list
  const removeTeacher = (teacherId: string) => {
    setForm(prev => ({
      ...prev,
      teacherIds: prev.teacherIds.filter(id => id !== teacherId)
    }));

    setTeacherValidation(prev => {
      const newValidation = { ...prev };
      delete newValidation[teacherId];
      return newValidation;
    });

    setTeachers(prev => prev.filter(teacher => teacher._id !== teacherId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name.trim()) {
      toast.error('Course name is required');
      return;
    }

    if (!form.sectionId) {
      toast.error('Please select a section');
      return;
    }

    if (form.teacherIds.length === 0) {
      toast.error('Please add at least one teacher');
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('token');

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          code: form.code.trim(),
          teacherIds: form.teacherIds,
          sectionId: form.sectionId,
          isActive: form.isActive,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Course updated successfully');
        router.push(`/${schoolId}/${userID}/dashboard/courses/${courseId}`);
      } else {
        throw new Error(data.message || data.error || 'Failed to update course');
      }
    } catch (error: any) {
      console.error('Error updating course:', error);
      toast.error(error.message || 'Failed to update course');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md mb-6">
          <div className="flex items-start">
            <FiX className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
        <Link
          href={`/${schoolId}/${userID}/dashboard/courses`}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiArrowLeft className="mr-2" />
          Back to Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <Link
            href={`/${schoolId}/${userID}/dashboard/courses/${courseId}`}
            className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
          >
            <FiArrowLeft className="mr-2" />
            Back to Course
          </Link>
          <p className="text-sm text-gray-500 mt-1">
            Logged in as: {currentUser?.name} ({currentUser?.role})
          </p>
        </div>
        {school && (
          <div className="text-right">
            <p className="text-sm font-medium text-gray-600">{school.name}</p>
            {school.fullName && (
              <p className="text-xs text-gray-500">{school.fullName}</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold mb-6">Edit Course</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Course Name */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Course Name *
            </label>
            <input
              placeholder="Enter course name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={100}
            />
          </div>
          
          {/* Course Code */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Course Code
            </label>
            <input
              placeholder="Enter course code (optional)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              maxLength={20}
            />
          </div>
          
          {/* Course Description */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Description
            </label>
            <textarea
              placeholder="Enter course description"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
              Section *
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={form.sectionId}
              onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
              required
            >
              <option value="">Select a section</option>
              {sections.map((section) => (
                <option key={section._id} value={section._id}>
                  {section.name} {section.sectionCode && `(${section.sectionCode})`}
                </option>
              ))}
            </select>
          </div>

          {/* Active Status Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Course Status
              </label>
              <p className="text-sm text-gray-500">
                {form.isActive ? 'Active courses can accept students' : 'Inactive courses cannot accept new students'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                form.isActive ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  form.isActive ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Status indicator badge */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              form.isActive 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {form.isActive ? 'Active' : 'Inactive'}
            </span>
            <span className="text-sm text-gray-500">
              {form.isActive 
                ? '✓ Course is currently active' 
                : '✗ Course is currently inactive'}
            </span>
          </div>
          
          {/* Teacher Selection by User ID */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              Manage Teachers *
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Enter the numeric User ID of each teacher and click "Add Teacher"
            </p>
            
            <div className="flex gap-2 mb-4">
              <input
                type="number"
                placeholder="Enter teacher User ID (e.g., 1001)"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                value={teacherInput}
                onChange={(e) => setTeacherInput(e.target.value)}
                min="1000"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTeacherById();
                  }
                }}
              />
              <button
                type="button"
                onClick={addTeacherById}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Add Teacher
              </button>
            </div>
            
            {form.teacherIds.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Current Teachers:</p>
                {form.teacherIds.map(teacherId => {
                  const teacher = teacherValidation[teacherId];
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
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <FiUser className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <p className="text-gray-500 text-sm">No teachers assigned yet</p>
              </div>
            )}
          </div>
          
          {/* Form Actions */}
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <Link
              href={`/${schoolId}/${userID}/dashboard/courses/${courseId}`}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button 
              type="submit" 
              disabled={saving || !form.name.trim() || !form.sectionId || form.teacherIds.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}