'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function CreateUserPage() {
  const router = useRouter();
  const { schoolId, userID } = useParams(); // Route params
  const [formData, setFormData] = useState({
    name: '',
    userId: '',
    email: '',
    password: '',
    role: 'teacher', // Force teacher role
    school: '',
    // Teacher-specific fields
    salary: 0,
    permissions: [] as string[]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unauthorized, setUnauthorized] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);

  // ✅ Access check: Only admin or faculty with student_affairs permission
  const hasAccess = (user: any) => {
    if (!user) return false;

    // Admin has full access
    if (user.role === 'admin') return true;

    // Faculty need student_affairs permission
    if (user.role === 'faculty' && user.permissions?.includes('student_affairs')) {
      return true;
    }

    return false;
  };

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

        if (!hasAccess(data.user)) {
          setUnauthorized(true);
          setPageLoading(false);
          return;
        }

        const storedSchool = data.user.school?._id || data.user.school;
        if (storedSchool) {
          setFormData(prev => ({ ...prev, school: storedSchool }));
        }
        
        // Set available permissions based on user role
        if (data.user.role === 'admin') {
          setAvailablePermissions([
            'student_affairs',
            'academic_affairs',
            'financial_affairs',
            'library_management',
            'attendance_management'
          ]);
        } else {
          setAvailablePermissions(data.user.permissions || []);
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData({ ...formData, [e.target.name]: value === '' ? '' : Number(value) });
  };

  const handlePermissionChange = (permission: string) => {
    setFormData(prev => {
      const permissions = prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission];
      
      return { ...prev, permissions };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication required');

      // Prepare data according to your backend API
      const submitData = { 
        ...formData, 
        role: 'teacher',
        // Ensure userId is a number
        userId: Number(formData.userId)
      };

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
      if (!response.ok) throw new Error(data.msg || 'Failed to create user');

      router.push(`/${schoolId}/${userID}/dashboard/manage-teachers`);
    } catch (err: any) {
      setError(err.message);
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
                You need to be an <strong>admin</strong> or have <strong>student_affairs</strong> permission to access this page.
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
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create New Teacher</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="block mb-1">Teacher ID *</label>
          <input
            type="number"
            name="userId"
            value={formData.userId}
            onChange={handleNumberChange}
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
          <label className="block mb-1">Salary</label>
          <input
            type="number"
            name="salary"
            value={formData.salary}
            onChange={handleNumberChange}
            className="w-full p-2 border rounded"
            min={0}
            step="0.01"
          />
        </div>

        {availablePermissions.length > 0 && (
          <div>
            <label className="block mb-1">Permissions</label>
            <div className="space-y-2">
              {availablePermissions.map(permission => (
                <div key={permission} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`permission-${permission}`}
                    checked={formData.permissions.includes(permission)}
                    onChange={() => handlePermissionChange(permission)}
                    className="mr-2"
                  />
                  <label htmlFor={`permission-${permission}`} className="capitalize">
                    {permission.replace(/_/g, ' ')}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        <input type="hidden" name="role" value="teacher" />
        <input type="hidden" name="school" value={formData.school} />

        <div className="bg-blue-50 p-3 rounded">
          <p className="text-blue-800 text-sm">
            <strong>Note:</strong> Only teachers can be created on this page.
            {currentUser?.role === 'faculty' &&
              ' As a faculty with student_affairs permission, you can only create teacher accounts.'}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push(`/${schoolId}/${userID}/dashboard/manage-teachers`)}
            className="px-4 py-2 border rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
          >
            {loading ? 'Creating...' : 'Create Teacher'}
          </button>
        </div>
      </form>
    </div>
  );
}