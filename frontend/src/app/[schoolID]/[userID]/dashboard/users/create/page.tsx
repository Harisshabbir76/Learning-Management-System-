'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface RoleSpecificData {
  student?: {
    class?: string;
    fees?: number;
  };
  teacher?: {
    salary?: number;
    permissions?: string[];
    courses?: string[];
  };
  faculty?: {
    salary?: number;
    permissions?: string[];
  };
  admin?: {
    designation?: string;
    privileges?: string[];
  };
  parent?: {
    children?: string[];
  };
}

interface Section {
  _id: string;
  name: string;
  sectionCode: string;
  capacity: number;
  students: any[];
}

interface Course {
  _id: string;
  name: string;
  code: string;
}

interface PermissionOption {
  value: string;
  label: string;
  description: string;
}

interface StudentSearchResult {
  _id: string;
  userId: number;
  name: string;
  email: string;
}

export default function CreateUserPage() {
  const router = useRouter();
  const { schoolId, userID } = useParams();
  const [formData, setFormData] = useState({
    name: '',
    userId: '',
    email: '',
    password: '',
    role: 'student',
    school: ''
  });
  const [roleSpecificData, setRoleSpecificData] = useState<RoleSpecificData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  
  // New state for dropdowns and search
  const [sections, setSections] = useState<Section[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [permissionOptions, setPermissionOptions] = useState<PermissionOption[]>([]);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentSearchResults, setStudentSearchResults] = useState<StudentSearchResult[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<StudentSearchResult[]>([]);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      router.push('/login');
      return;
    }

    const fetchCurrentUser = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });

        if (!res.ok) throw new Error('Failed to fetch user profile');
        
        const data = await res.json();
        setCurrentUser(data.user);

        // Check if user is admin or faculty with student_affairs permission
        const userRole = data.user?.role;
        const userPermissions = data.user?.permissions || [];
        
        if (userRole !== 'admin' && !(userRole === 'faculty' && userPermissions.includes('student_affairs'))) {
          setUnauthorized(true);
          setPageLoading(false);
          return;
        }

        // Set school from user's school
        const storedSchool = data.user.school?._id || data.user.school;
        if (storedSchool) {
          setFormData(prev => ({ ...prev, school: storedSchool }));
          
          // Fetch sections, courses, and permissions for this school
          await fetchSections(storedToken, storedSchool);
          await fetchCourses(storedToken, storedSchool);
          await fetchPermissionOptions(storedToken);
        }
        
        setPageLoading(false);
      } catch (err) {
        console.error('Error fetching user:', err);
        setUnauthorized(true);
        setPageLoading(false);
      }
    };

    fetchCurrentUser();
  }, [router]);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  };

  const fetchSections = async (token: string, schoolId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sections?school=${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setSections(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
    }
  };

  const fetchCourses = async (token: string, schoolId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses?school=${schoolId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setCourses(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  const fetchPermissionOptions = async (token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/permissions/meta/available`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setPermissionOptions(data.permissions || []);
      }
    } catch (err) {
      console.error('Error fetching permission options:', err);
    }
  };

  const searchStudents = async () => {
    if (!studentSearchTerm.trim()) return;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users?role=student&search=${studentSearchTerm}&school=${formData.school}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      if (res.ok) {
        const data = await res.json();
        setStudentSearchResults(data.data || []);
      }
    } catch (err) {
      console.error('Error searching students:', err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name in formData) {
      setFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setRoleSpecificData(prev => ({
        ...prev,
        [formData.role]: {
          ...prev[formData.role as keyof RoleSpecificData],
          [name]: value
        }
      }));
    }
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    setFormData(prev => ({ ...prev, role: newRole }));
    setRoleSpecificData({});
    setSelectedStudents([]);
  };

  const handleNumberInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = value === '' ? '' : Number(value);
    
    if (name in formData) {
      setFormData(prev => ({ ...prev, [name]: numValue }));
    } else {
      setRoleSpecificData(prev => ({
        ...prev,
        [formData.role]: {
          ...prev[formData.role as keyof RoleSpecificData],
          [name]: numValue
        }
      }));
    }
  };

  const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    const currentPermissions = roleSpecificData[formData.role as keyof RoleSpecificData]?.permissions || [];
    
    let newPermissions;
    if (checked) {
      newPermissions = [...currentPermissions, value];
    } else {
      newPermissions = currentPermissions.filter(p => p !== value);
    }
    
    setRoleSpecificData(prev => ({
      ...prev,
      [formData.role]: {
        ...prev[formData.role as keyof RoleSpecificData],
        permissions: newPermissions
      }
    }));
  };

  const handleCourseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = e.target;
    const currentCourses = roleSpecificData[formData.role as keyof RoleSpecificData]?.courses || [];
    
    let newCourses;
    if (checked) {
      newCourses = [...currentCourses, value];
    } else {
      newCourses = currentCourses.filter(c => c !== value);
    }
    
    setRoleSpecificData(prev => ({
      ...prev,
      [formData.role]: {
        ...prev[formData.role as keyof RoleSpecificData],
        courses: newCourses
      }
    }));
  };

  const handleAddStudent = (student: StudentSearchResult) => {
    if (!selectedStudents.some(s => s._id === student._id)) {
      setSelectedStudents(prev => [...prev, student]);
      setRoleSpecificData(prev => ({
        ...prev,
        parent: {
          ...prev.parent,
          children: [...(prev.parent?.children || []), student._id]
        }
      }));
    }
    setStudentSearchTerm('');
    setStudentSearchResults([]);
  };

  const handleRemoveStudent = (studentId: string) => {
    setSelectedStudents(prev => prev.filter(s => s._id !== studentId));
    setRoleSpecificData(prev => ({
      ...prev,
      parent: {
        ...prev.parent,
        children: prev.parent?.children?.filter(id => id !== studentId) || []
      }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      // Prepare the complete data object
      const submitData: any = {
        ...formData,
        ...roleSpecificData[formData.role as keyof RoleSpecificData]
      };

      // For students, include the class at the top level (not nested)
      if (formData.role === 'student' && roleSpecificData.student?.class) {
        submitData.class = roleSpecificData.student.class;
        // Remove the nested class property
        if (submitData.student) {
          delete submitData.student.class;
        }

        // Check if selected section has capacity
        const selectedSection = sections.find(s => s._id === roleSpecificData.student?.class);
        if (selectedSection && selectedSection.students.length >= selectedSection.capacity) {
          throw new Error(`Selected section "${selectedSection.name}" is at full capacity (${selectedSection.capacity} students)`);
        }
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(submitData),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.msg || 'Failed to create user');
      }

      showNotification('User created successfully!', 'success');
      
      // Redirect after a short delay to show the success message
      setTimeout(() => {
        router.push(`/${schoolId}/${userID}/dashboard/users`);
      }, 1500);

    } catch (err: any) {
      console.error('Error creating user:', err);
      setError(err.message);
      showNotification(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderRoleSpecificFields = () => {
    switch (formData.role) {
      case 'student':
        return (
          <>
            <div>
              <label className="block mb-1">Class/Section *</label>
              <select
                name="class"
                value={roleSpecificData.student?.class || ''}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select a section</option>
                {sections.map(section => {
                  const isFull = section.students.length >= section.capacity;
                  return (
                    <option 
                      key={section._id} 
                      value={section._id}
                      disabled={isFull}
                      className={isFull ? 'text-red-500' : ''}
                    >
                      {section.name} ({section.sectionCode}) 
                      {isFull ? ` - FULL (${section.students.length}/${section.capacity})` : ` - (${section.students.length}/${section.capacity})`}
                    </option>
                  );
                })}
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Student will be automatically enrolled in this section
              </p>
            </div>
            <div>
              <label className="block mb-1">Fees</label>
              <input
                type="number"
                name="fees"
                value={roleSpecificData.student?.fees || ''}
                onChange={handleNumberInput}
                className="w-full p-2 border rounded"
                placeholder="e.g., 5000 (optional)"
                min="0"
              />
            </div>
          </>
        );

      case 'teacher':
        return (
          <>
            <div>
              <label className="block mb-1">Salary</label>
              <input
                type="number"
                name="salary"
                value={roleSpecificData.teacher?.salary || ''}
                onChange={handleNumberInput}
                className="w-full p-2 border rounded"
                placeholder="e.g., 30000 (optional)"
                min="0"
              />
            </div>
            <div>
              <label className="block mb-1">Permissions (optional)</label>
              <div className="space-y-2">
                {permissionOptions.map(permission => (
                  <label key={permission.value} className="flex items-center">
                    <input
                      type="checkbox"
                      value={permission.value}
                      checked={roleSpecificData.teacher?.permissions?.includes(permission.value) || false}
                      onChange={handlePermissionChange}
                      className="mr-2"
                    />
                    <span>
                      {permission.label} - {permission.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block mb-1">Courses (optional)</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {courses.map(course => (
                  <label key={course._id} className="flex items-center">
                    <input
                      type="checkbox"
                      value={course._id}
                      checked={roleSpecificData.teacher?.courses?.includes(course._id) || false}
                      onChange={handleCourseChange}
                      className="mr-2"
                    />
                    <span>
                      {course.name} ({course.code})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </>
        );

      case 'faculty':
        return (
          <>
            <div>
              <label className="block mb-1">Salary</label>
              <input
                type="number"
                name="salary"
                value={roleSpecificData.faculty?.salary || ''}
                onChange={handleNumberInput}
                className="w-full p-2 border rounded"
                placeholder="e.g., 40000 (optional)"
                min="0"
              />
            </div>
            <div>
              <label className="block mb-1">Permissions (optional)</label>
              <div className="space-y-2">
                {permissionOptions.map(permission => (
                  <label key={permission.value} className="flex items-center">
                    <input
                      type="checkbox"
                      value={permission.value}
                      checked={roleSpecificData.faculty?.permissions?.includes(permission.value) || false}
                      onChange={handlePermissionChange}
                      className="mr-2"
                    />
                    <span>
                      {permission.label} - {permission.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </>
        );

      case 'admin':
        return (
          <>
            <div>
              <label className="block mb-1">Designation</label>
              <input
                type="text"
                name="designation"
                value={roleSpecificData.admin?.designation || ''}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                placeholder="e.g., School Administrator (optional)"
              />
            </div>
            <div>
              <label className="block mb-1">Privileges (comma-separated, optional)</label>
              <input
                type="text"
                name="privileges"
                value={roleSpecificData.admin?.privileges?.join(', ') || ''}
                onChange={handleChange}
                className="w-full p-2 border rounded"
                placeholder="e.g., all_permissions, user_management"
              />
            </div>
          </>
        );

      case 'parent':
        return (
          <div className="space-y-4">
            <div>
              <label className="block mb-1">Search for Children by User ID (optional)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="flex-1 p-2 border rounded"
                  placeholder="Enter student User ID"
                  min="1000"
                />
                <button
                  type="button"
                  onClick={searchStudents}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Search
                </button>
              </div>
            </div>
            
            {studentSearchResults.length > 0 && (
              <div>
                <label className="block mb-1">Search Results</label>
                <div className="border rounded p-2 max-h-40 overflow-y-auto">
                  {studentSearchResults.map(student => (
                    <div key={student._id} className="flex justify-between items-center p-2 hover:bg-gray-50">
                      <span>
                        {student.name} (ID: {student.userId}, Email: {student.email})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddStudent(student)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {selectedStudents.length > 0 && (
              <div>
                <label className="block mb-1">Selected Children</label>
                <div className="border rounded p-2">
                  {selectedStudents.map(student => (
                    <div key={student._id} className="flex justify-between items-center p-2 hover:bg-gray-50">
                      <span>
                        {student.name} (ID: {student.userId})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStudent(student._id)}
                        className="px-2 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
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
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 
10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <p className="mt-1 text-sm text-red-700">
                Administrator or faculty with student affairs privileges are required to access this page.
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
    <div className="max-w-2xl mx-auto p-6">
      {notification.show && (
        <div className={`fixed top-4 right-4 z-50 transform transition-all duration-300 ease-in-out ${
          notification.show ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}>
          <div className={`rounded-lg shadow-lg p-4 min-w-80 border-l-4 ${
            notification.type === 'success' 
              ? 'bg-green-50 border-green-500 text-green-800' 
              : 'bg-red-50 border-red-500 text-red-800'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 
20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 
0 00-1.414-1.414L9 10.586 
7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L
10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="
text-sm font-medium">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification({ show: false, message: '', type: '' })}
                className="ml-auto pl-3 -mx-1.5 -my-1.5 rounded-lg focus:ring-2 focus:ring-green-400 p-1.5 inline-flex h-8 w-8 bg-green-50 hover:bg-green-100 text-green-500"
              >
                <span className="sr-only">Dismiss</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-
1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </
svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold mb-6">Create New User</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:
grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block mb-1">User ID *</label>
            <input
              type="number"
              name="userId"
              value={formData.userId}
              onChange={handleNumberInput}
              className="w-full p-2 border rounded"
              min={1000}
              max={999999}
              required
            />
          </div>

          <div>
            <label className="block mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div>
            <label className="block mb-1">Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              minLength={6}
              required
            />
          </div>

          <div>
            <label className="block mb-1">Role *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleRoleChange}
              className="w-full p-2 border rounded"
              required
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="faculty">Faculty</option>
              <option value="parent">Parent</option>
            </select>
          </div>
        </div>

        {/* Role-specific fields */}
        {formData.role && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 capitalize">{formData.role} Specific Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderRoleSpecificFields()}
            </div>
          </div>
        )}

        {/* Hidden input for school ID */}
        <input type="hidden" name="school" value={formData.school} />

        <div className="flex justify-end gap-2 pt-4">
          <button
            type="button"
            onClick={() => router.push(`/${schoolId}/${userID}/dashboard/users`)}
            className="px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-
700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}