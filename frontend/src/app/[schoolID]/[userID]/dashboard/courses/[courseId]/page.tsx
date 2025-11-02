'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FiUser, FiUsers, FiEdit2, FiArrowLeft, FiBook, FiMail, FiHome, FiHash } from 'react-icons/fi';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Student {
  _id: string;
  name: string;
  userId?: number;
  email?: string;
}

interface Teacher {
  _id: string;
  name: string;
  userId?: number;
  email?: string;
}

interface Course {
  _id: string;
  name: string;
  description?: string;
  code?: string;
  teachers: Array<Teacher | string>;
  section:
    | {
        _id: string;
        name: string;
        sectionCode: string;
        students?: Student[];
      }
    | string;
  school: string | { _id: string; name: string };
  createdBy?: string | { _id: string; name: string };
  createdAt?: string;
  isActive?: boolean;
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
  sectionCode: string;
  students?: Student[];
}

export default function CourseDetailPage() {
  const router = useRouter();
  const { schoolId, userID, courseId } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);

  const canEditCourse = () => {
    if (currentUser?.role === 'admin') return true;
    if (
      currentUser?.role === 'faculty' &&
      currentUser?.permissions?.includes('student_affairs')
    )
      return true;

    if (currentUser?.role === 'teacher') {
      const teacherIds =
        course?.teachers?.map((t) =>
          typeof t === 'string' ? t : t._id
        ) || [];
      return teacherIds.includes(currentUser._id);
    }

    return false;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        if (!token) {
          router.push('/login');
          return;
        }

        const userRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!userRes.ok) throw new Error('Failed to fetch user profile');

        const userData = await userRes.json();
        const user = userData.user || userData.data;
        setCurrentUser(user);

        // Fetch course details with section + students
        const courseRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (!courseRes.ok) {
          if (courseRes.status === 403) {
            setError('Access denied to this course');
            setLoading(false);
            return;
          }
          throw new Error('Failed to fetch course');
        }

        const courseData = await courseRes.json();
        const course = courseData.data || courseData;
        setCourse(course);

        // Fetch teacher details if they are stored as IDs
        if (course.teachers && course.teachers.length > 0) {
          const teacherPromises = course.teachers.map(async (teacher) => {
            if (typeof teacher === 'string') {
              const teacherRes = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/users/${teacher}`,
                { headers: { Authorization: `Bearer ${token}` } }
              );
              if (teacherRes.ok) {
                const teacherData = await teacherRes.json();
                return teacherData.data || teacherData;
              }
              return { _id: teacher, name: 'Unknown Teacher' };
            }
            return teacher;
          });
          
          const resolvedTeachers = await Promise.all(teacherPromises);
          setTeachers(resolvedTeachers);
        }

        if (course.section) {
          if (typeof course.section === 'object') {
            setSection(course.section);
          } else {
            const sectionRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/sections/${course.section}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (sectionRes.ok) {
              const sectionData = await sectionRes.json();
              setSection(sectionData.data || sectionData);
            }
          }
        }

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
      } catch (err) {
        console.error('Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [courseId, router]);

  const handleEditClick = () => {
    if (!canEditCourse()) {
      toast.error('You do not have permission to edit this course');
      return;
    }
    router.push(
      `/${schoolId}/${userID}/dashboard/courses/${courseId}/edit`
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-3 text-gray-600">Loading course details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <FiUser className="h-5 w-5 text-red-400 mt-0.5" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
        <div className="mt-6">
          <Link
            href={`/${schoolId}/${userID}/dashboard/courses`}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
          >
            <FiArrowLeft className="mr-2" />
            Back to Courses
          </Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <h3 className="text-sm font-medium text-yellow-800">
            Course not found
          </h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <button
              onClick={() =>
                router.push(`/${schoolId}/${userID}/dashboard/courses`)
              }
              className="flex items-center text-blue-600 hover:text-blue-800 transition-colors font-medium"
            >
              <FiArrowLeft className="mr-2" />
              Back to Courses
            </button>
            <p className="text-sm text-gray-500 mt-1">
              Logged in as: <span className="font-medium">{currentUser?.name}</span> ({currentUser?.role})
            </p>
          </div>

          {canEditCourse() && (
            <button
              onClick={handleEditClick}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
            >
              <FiEdit2 className="mr-2" />
              Edit Course
            </button>
          )}
        </div>

        {/* Course Header Card */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-8 overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  {course.name}
                </h1>
                {course.description && (
                  <p className="mt-2 text-gray-600 text-lg">{course.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.code && (
                    <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                      <FiHash className="mr-1" /> {course.code}
                    </span>
                  )}
                  {section && (
                    <span className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 text-sm font-medium rounded-full">
                      <FiBook className="mr-1" /> {section.name} ({section.sectionCode})
                    </span>
                  )}
                  {course.isActive === false && (
                    <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                {course.createdAt && (
                  <p className="mt-3 text-sm text-gray-500">
                    Created on: {new Date(course.createdAt).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                )}
              </div>
              {school && (
                <div className="text-right bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-end text-gray-600">
                    <FiHome className="mr-2" />
                    <span className="font-medium">{school.name}</span>
                  </div>
                  {school.fullName && (
                    <p className="text-xs text-gray-500 mt-1">
                      {school.fullName}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Teachers Section */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FiUser className="text-blue-600 text-xl" />
                  </div>
                  <h2 className="text-lg font-semibold ml-3">Teachers</h2>
                </div>
                <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full font-medium">
                  {teachers.length || 0}
                </span>
              </div>

              <div className="space-y-4">
                {teachers.length > 0 ? (
                  teachers.map((teacher, index) => (
                    <div
                      key={teacher._id || index}
                      className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <FiUser className="text-blue-600" />
                        </div>
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="font-medium text-gray-900">{teacher.name}</h3>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {teacher.userId && (
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <FiHash className="mr-1" /> ID: {teacher.userId}
                            </span>
                          )}
                          {teacher.email && (
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <FiMail className="mr-1" /> {teacher.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                    <FiUser className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                    <p>No teachers assigned to this course</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Students Section */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FiUsers className="text-green-600 text-xl" />
                  </div>
                  <h2 className="text-lg font-semibold ml-3">Students</h2>
                </div>
                <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-medium">
                  {section?.students?.length || 0}
                </span>
              </div>

              {section?.students && section.students.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {section.students.map((student) => (
                    <div
                      key={student._id}
                      className="flex items-center p-4 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <FiUser className="text-green-600" />
                        </div>
                      </div>
                      <div className="ml-4 flex-1">
                        <h3 className="font-medium text-gray-900">{student.name}</h3>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mt-1">
                          {student.userId && (
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <FiHash className="mr-1" /> ID: {student.userId}
                            </span>
                          )}
                          {student.email && (
                            <span className="inline-flex items-center text-xs text-gray-500">
                              <FiMail className="mr-1" /> {student.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <FiUsers className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                  <p>No students in this section yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}